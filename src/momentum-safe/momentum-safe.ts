import * as Aptos from "../web3/global";
import { HexString, TxnBuilderTypes, BCS, Types } from 'aptos';
import { AptosEntryTxnBuilder, Transaction } from '../web3/transaction';
import { Account } from '../web3/account';
import {
  MODULES,
  FUNCTIONS,
  assembleMultiSigTxn, getResourceTag,
} from './common';
import { assembleMultiSig } from './sig-helper';
import { computeMultiSigAddress, sha3_256 } from "../utils/crypto";
import { MSafeTransaction, MSafeTxnInfo } from "./msafe-txn";
import { formatAddress } from "../utils/parse";
import { isHexEqual } from "../utils/check";
import { HexBuffer } from "../utils/buffer";
import { DEPLOYER } from "../web3/global";
import { EventHandle, PaginationArgs } from "../moveTypes/moveEvent";
import { SimpleMap, TableWithLength, TEd25519PublicKey, TEd25519Signature, Vector } from "../moveTypes/moveTypes";


// Data stored in MomentumSafe.move

export type Info = {
  owners: Vector<Types.Address>,
  public_keys: Vector<TEd25519PublicKey>, // Vector of public_keys
  nonce: Types.U64,
  threshold: number,
  metadata: Types.HexEncodedBytes, // plain text / json / uri
}

export type Momentum = {
  info: Info,
  txn_book: TxnBook,
}

export type TxnBook = {
  // minimum nonce in the txn_book
  min_sequence_number: Types.U64,
  // maximum nonce in the txn_book
  max_sequence_number: Types.U64,
  tx_hashes: TableWithLength<Types.U64, Vector<Types.HashValue>>, // nonce => Vector<tx hash>
  // sequence number => a list of transactions (with the same sequence number)
  pendings: TableWithLength<Types.U64, TransactionType>, // Hash => Tx
}

export type TransactionType = {
  payload: Types.HexEncodedBytes,
  metadata: Types.HexEncodedBytes, // json or uri
  signatures: SimpleMap<TEd25519PublicKey, TEd25519Signature>, // public_key => signature
}

export type MomentumSafeEvent = {
  register_events: EventHandle<Info>,
  transaction_events: EventHandle<TransactionType>
}

export type MomentumSafeInfo = {
  owners: HexString[],
  pubKeys: HexString[],
  creationNonce: number,
  threshold: number,
  curSN: bigint,
  nextSN: bigint,
  metadata: string,
  balance: bigint,
  pendingTxs: MSafeTxnInfo[],
}

export class MomentumSafe {
  owners: HexString[];
  ownersPublicKeys: HexString[];
  threshold: number;
  creationNonce: number;
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;
  address: HexString;

  // TODO: pk, threshold, e.t.c is possible to be updated later
  // Do not construct directly through constructor. Use fromMomentumSafe instead
  protected constructor(
    owners: HexString[],
    ownerPKs: HexString[],
    threshold: number,
    nonce: number,
    address?: HexString
  ) {
    this.owners = owners;
    this.ownersPublicKeys = ownerPKs;
    this.threshold = threshold;
    this.creationNonce = nonce;
    const [pk, , computedAddress] = computeMultiSigAddress(ownerPKs, threshold, nonce);
    this.rawPublicKey = pk;
    if (address) {
      this.address = address;
    } else {
      this.address = computedAddress;
    }
  }

  static async fromMomentumSafe(address: HexString): Promise<MomentumSafe> {
    address = formatAddress(address);
    const msafeData = await MomentumSafe.queryMSafeResource(address);
    const owners = msafeData.info.owners.map(ownerStr => HexString.ensure(ownerStr));
    const threshold = msafeData.info.threshold;
    const nonce = msafeData.info.nonce;
    const ownerPubKeys = msafeData.info.public_keys.map(pk => HexString.ensure(pk));
    return new MomentumSafe(owners, ownerPubKeys, threshold, Number(nonce), address);
  }

  async initTransaction(signer: Account, tx: MSafeTransaction) {
    const [rawTx, sig] = signer.getSigData(tx);
    const tmpHash = sha3_256(rawTx);

    const initTx = await this.makeCoinTransferInitTx(signer, rawTx, sig);
    const signedInitTx = signer.sign(initTx);

    const txRes = await Aptos.sendSignedTransactionAsync(signedInitTx);
    return { plHash: tmpHash, pendingTx: txRes };
  }

  async isReadyToSubmit(txHash: string | HexString, extraPubKey?: HexString) {
    const tx = await this.findTx(txHash);
    const sigs = tx.signatures.data;
    let collectedSigs = sigs.length;

    if (extraPubKey) {
      const found = sigs.find(entry => isHexEqual(entry.key, extraPubKey)) !== undefined;
      if (!found) {
        collectedSigs = collectedSigs + 1;
      }
    }
    return collectedSigs >= this.threshold;
  }

  async submitTxSignature(signer: Account, txHash: string) {
    const txType = await this.findTx(txHash);
    const sig = this.signTx(signer, txType);

    const tx = await this.makeSubmitSignatureTxn(signer, txHash, txType, sig);
    const signedTx = signer.sign(tx);
    return await Aptos.sendSignedTransactionAsync(signedTx);
  }

  async assembleAndSubmitTx(signer: Account, txHash: HexString | string) {
    const txType = await this.findTx(txHash);
    const signatures = txType.signatures;
    const payload = txType.payload;

    const selfSignature = this.signTx(signer, txType);

    const multiSignature = assembleMultiSig(this.ownersPublicKeys, signatures, signer, selfSignature);
    const bcsTxn = assembleMultiSigTxn(payload, this.rawPublicKey, multiSignature);
    return await Aptos.sendSignedTransactionAsync(bcsTxn);
  }

  signTx(signer: Account, txType: TransactionType) {
    const tx = Transaction.deserialize(HexBuffer(txType.payload));
    const [, sig] = signer.getSigData(tx);
    return sig;
  }

  // TODO: do not query for resource
  async findTx(txHash: HexString | string): Promise<TransactionType> {
    const res = await this.getResource();
    return MomentumSafe.queryPendingTxByHash(res, txHash);
  }

  // TODO: do not query for resource
  // TODO: better API for TransactionType
  // TODO: make tx a separate class
  async getTxDetails(txHash: string): Promise<[TransactionType, MSafeTxnInfo]> {
    const txType = await this.findTx(txHash);
    const curSN = await Aptos.getSequenceNumber(this.address);
    if (!MomentumSafe.isTxValid(txType, curSN)) {
      throw new Error("Transaction is no longer valid: low sequence number.");
    }
    const msafeTx = MSafeTransaction.deserialize(HexBuffer(txType.payload));
    const msafeTxInfo = msafeTx.getTxnInfo();
    return [txType, msafeTxInfo];
  }

  private async makeCoinTransferInitTx(
    signer: Account,
    payload: TxnBuilderTypes.SigningMessage,
    signature: TxnBuilderTypes.Ed25519Signature
  ) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer.address());
    // TODO: do not query for resource again;
    const txBuilder = new AptosEntryTxnBuilder();
    const pkIndex = this.getIndex(signer.publicKey());

    return txBuilder
      .addr(DEPLOYER)
      .module(MODULES.MOMENTUM_SAFE)
      .method(FUNCTIONS.MSAFE_INIT_TRANSACTION)
      .from(signer.address())
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeUint64(pkIndex),
        BCS.bcsSerializeBytes(payload),
        BCS.bcsToBytes(signature),
      ])
      .build();
  }

  async makeSubmitSignatureTxn(
    signer: Account,
    txHash: string,
    tx: TransactionType,
    sig: TxnBuilderTypes.Ed25519Signature
  ) {
    const pkIndex = this.getIndex(signer.publicKey());
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer.address());
    const txBuilder = new AptosEntryTxnBuilder();

    return txBuilder
      .addr(DEPLOYER)
      .module(MODULES.MOMENTUM_SAFE)
      .method(FUNCTIONS.MSAFE_SUBMIT_SIGNATURE)
      .from(signer.address())
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeUint64(pkIndex),
        BCS.bcsSerializeBytes(HexBuffer(txHash)),
        BCS.bcsToBytes(sig),
      ])
      .build();
  }

  private static async queryMSafeResource(address: HexString): Promise<Momentum> {
    const res = await Aptos.getAccountResource(address, getResourceTag('MOMENTUM'));
    return res.data as Momentum;
  }

  private async getResource(): Promise<Momentum> {
    return MomentumSafe.queryMSafeResource(this.address);
  }

  async getMomentumSafeInfo(): Promise<MomentumSafeInfo> {
    const data = await MomentumSafe.queryMSafeResource(this.address);
    const balance = await Aptos.getBalance(this.address);
    const sn = await Aptos.getSequenceNumber(this.address);
    const pendings: MSafeTxnInfo[] = [];
    for (let nonce = sn; nonce <= BigInt(data.txn_book.max_sequence_number); nonce++) {
      const nonce_hashes = await MomentumSafe.queryPendingTxHashBySN(data, nonce);
      const txs = await Promise.all(nonce_hashes.map(hash => MomentumSafe.queryPendingTxByHash(data, hash)));
      txs.filter(tx => MomentumSafe.isTxValid(tx, sn)).forEach(tx => {
        const msafeTx = MSafeTransaction.deserialize(HexBuffer(tx.payload));
        pendings.push(msafeTx.getTxnInfo(tx.signatures.data.length));
      });
    }
    const nextSN = this.getNextSequenceNumberFromResourceData(data);
    pendings.sort((a, b) => {
      if (a.sn != b.sn) {
        return Number(a.sn - b.sn);
      } else {
        return a.expiration.getUTCSeconds() - b.expiration.getUTCSeconds();
      }
    });
    return {
      owners: data.info.owners.map(owner => formatAddress(owner)),
      pubKeys: data.info.public_keys.map(pk => HexString.ensure(pk)),
      creationNonce: Number(data.info.nonce),
      threshold: data.info.threshold,
      curSN: sn,
      nextSN: nextSN,
      metadata: data.info.metadata as string,
      balance: balance,
      pendingTxs: pendings,
    };
  }

  private static isTxValid(txType: TransactionType, curSN: bigint): boolean {
    // Add expiration
    const tx = Transaction.deserialize(HexBuffer(txType.payload));
    return tx.raw.sequence_number >= curSN
      && tx.raw.expiration_timestamp_secs >= new Date().getUTCSeconds();
  }

  private getIndex(target: HexString): number {
    const i = this.ownersPublicKeys.findIndex(pk => {
      return isHexEqual(pk, target);
    });
    if (i == -1) {
      throw new Error("target pk not found in momentum safe");
    }
    return i;
  }

  async getNextSN() {
    const momentum = await this.getResource();
    return this.getNextSequenceNumberFromResourceData(momentum);
  }

  private getNextSequenceNumberFromResourceData(momentum: Momentum) {
    return BigInt(momentum.txn_book.max_sequence_number) + 1n;
  }

  static async getMomentumSafeEvent(owner: HexString): Promise<MomentumSafeEvent> {
    const eventStruct = await Aptos.getAccountResource(owner, getResourceTag('MOMENTUM_EVENT'));
    return eventStruct.data as any;
  }

  static async filterRegisterEvent(eventStruct: MomentumSafeEvent, option: PaginationArgs) {
    return Aptos.filterEvent(eventStruct.register_events, option);
  }

  static async filterTransactionEvent(eventStruct: MomentumSafeEvent, option: PaginationArgs) {
    return Aptos.filterEvent(eventStruct.transaction_events, option);
  }

  static async queryPendingTxHashBySN(momentum: Momentum, sn: bigint): Promise<Vector<string>> {
    return Aptos.client().getTableItem(momentum.txn_book.tx_hashes.inner.handle, {
      key_type: 'u64',
      value_type: 'vector<vector<u8>>',
      key: sn.toString()
    });
  }

  static async queryPendingTxByHash(momentum: Momentum, txID: string | HexString): Promise<TransactionType> {
    return Aptos.client().getTableItem(momentum.txn_book.pendings.inner.handle, {
      key_type: 'vector<u8>',
      value_type: getResourceTag('MOMENTUM_TRANSACTION'),
      key: txID.toString()
    });
  }
}




