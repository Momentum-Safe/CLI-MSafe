import * as Aptos from "../web3/global";
import {HexString, TxnBuilderTypes, BCS} from 'aptos';
import {AptosEntryTxnBuilder, Transaction} from '../web3/transaction';
import {Account} from '../web3/account';
import {
  vector,
  SimpleMap,
  HexStr,
  DEPLOYER_HS,
  HexBuffer,
  RESOURCES,
  MODULES, FUNCTIONS, assembleMultiSigTxn, isHexEqual, formatAddress
} from './common';
import {assembleMultiSig} from './sig-helper';
import {computeMultiSigAddress, sha3_256} from "../web3/crypto";
import {MSafeTransaction, MSafeTxnInfo, Options} from "./msafe-txn";


// Data stored in MomentumSafe.move
type Momentum = {
  info: Info,
  txn_book: TxnBook,
}

type Info = {
  owners: vector<string>,
  public_keys: vector<HexStr>, // vector of public_keys
  nonce: number,
  threshold: number,
  metadata: HexStr, // plain text / json / uri
}

type TxnBook = {
  min_sequence_number: string,
  max_sequence_number: string,
  tx_hashes: SimpleMap<vector<HexStr>>, // nonce => vector<tx hash>
  // sequence number => a list of transactions (with the same sequence number)
  pendings: SimpleMap<TransactionType>, // Hash => Tx
}

export type TransactionType = {
  payload: HexStr,
  metadata: HexStr, // json or uri
  signatures: SimpleMap<HexStr>, // public_key => signature
}

export type MomentumSafeInfo = {
  owners: HexString[],
  pubKeys: HexString[],
  creationNonce: number,
  threshold: number,
  curSN: number,
  metadata: string,
  balance: number,
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
  constructor(
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
    const threshold  = msafeData.info.threshold;
    const nonce = msafeData.info.nonce;
    const ownerPubKeys = msafeData.info.public_keys.map( pk => HexString.ensure(pk));
    return new MomentumSafe(owners, ownerPubKeys, threshold, nonce, address);
  }

  async initTransaction(signer: Account, tx: MSafeTransaction) {
    const [rawTx, sig] = signer.getSigData(tx);
    const tmpHash = sha3_256(rawTx);

    const initTx = await this.makeCoinTransferInitTx(signer, rawTx, sig);
    const signedInitTx = signer.sign(initTx);

    const txRes = await Aptos.sendSignedTransactionAsync(signedInitTx);
    return {plHash: tmpHash, pendingTx: txRes};
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
  async findTx(txHash: HexString | string) {
    const res = await this.getResource();
    return res.txn_book.pendings.data.find(entry => isHexEqual(entry.key, txHash))!.value;
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
      .addr(DEPLOYER_HS)
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
      .addr(DEPLOYER_HS)
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
    const res = await Aptos.getAccountResource(address, RESOURCES.MOMENTUM);
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
    data.txn_book.pendings.data.forEach( e => {
      const tx = e.value;
      if (MomentumSafe.isTxValid(tx, sn)) {
        const decodedTx = MSafeTransaction.deserialize(HexBuffer(tx.payload));
        pendings.push(decodedTx.getTxnInfo(e.value.signatures.data.length));
      }
    });
    pendings.sort( (a, b) => {
      if (a.sn != b.sn) {
        return a.sn - b.sn;
      } else {
        return a.expiration.getUTCSeconds() - b.expiration.getUTCSeconds();
      }
    });
    return {
      owners: data.info.owners.map(owner => formatAddress(owner)),
      pubKeys: data.info.public_keys.map(pk => HexString.ensure(pk)),
      creationNonce: data.info.nonce,
      threshold: data.info.threshold,
      curSN: sn,
      metadata: data.info.metadata as string,
      balance: balance,
      pendingTxs: pendings,
    };
  }

  private static isTxValid(txType: TransactionType, curSN: number): boolean {
    // Add expiration
    const tx = Transaction.deserialize(HexBuffer(txType.payload));
    return Number(tx.raw.sequence_number) >= curSN;
  }

  private getIndex(target: HexString): number {
    const i = this.ownersPublicKeys.findIndex( pk => {
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
    return Number(momentum.txn_book.max_sequence_number) + 1;
  }
}




