import { BCS, HexString, TxnBuilderTypes, Types } from "aptos";
import { getMSafeStatus } from "../cmd/common";
import { makeMigrateTxBuilder, toMigrateTx } from "../cmd/migration";
import { EventHandle, PaginationArgs } from "../moveTypes/moveEvent";
import {
  SimpleMap,
  TEd25519PublicKey,
  TEd25519Signature,
  TableWithLength,
  Vector,
} from "../moveTypes/moveTypes";
import { MigrationProofMessage } from "../types/MigrationMessage";
import { TypeMessage } from "../types/Transaction";
import { HexBuffer } from "../utils/buffer";
import { isHexEqual } from "../utils/check";
import { computeMultiSigAddress, sha3_256 } from "../utils/crypto";
import { formatAddress } from "../utils/parse";
import { Account } from "../web3/account";
import * as Aptos from "../web3/global";
import { DEPLOYER } from "../web3/global";
import {
  AptosEntryTxnBuilder,
  Options,
  Transaction,
} from "../web3/transaction";
import {
  FUNCTIONS,
  MODULES,
  assembleMultiSigTxn,
  getStructType,
} from "./common";
import {
  MSafeTransaction,
  MSafeTxnInfo,
  applyDefaultOptions,
} from "./msafe-txn";
import { assembleMultiSig } from "./sig-helper";

// Data stored in MomentumSafe.move

export type Info = {
  owners: Vector<Types.Address>;
  public_keys: Vector<TEd25519PublicKey>; // Vector of public_keys
  nonce: Types.U64;
  threshold: number;
  metadata: Types.HexEncodedBytes; // plain text / json / uri
};

export type Momentum = {
  info: Info;
  txn_book: TxnBook;
};

export type TxnBook = {
  // minimum nonce in the txn_book
  min_sequence_number: Types.U64;
  // maximum nonce in the txn_book
  max_sequence_number: Types.U64;
  tx_hashes: TableWithLength<Types.U64, Vector<Types.HashValue>>; // nonce => Vector<tx hash>
  // sequence number => a list of transactions (with the same sequence number)
  pendings: TableWithLength<Types.U64, TransactionType>; // Hash => Tx
};

export type TransactionType = {
  payload: Types.HexEncodedBytes;
  metadata: Types.HexEncodedBytes; // json or uri
  signatures: SimpleMap<TEd25519PublicKey, TEd25519Signature>; // public_key => signature
};

export type MomentumSafeEvent = {
  register_events: EventHandle<Info>;
  transaction_events: EventHandle<TransactionType>;
};

export type MomentumSafeInfo = {
  owners: HexString[];
  pubKeys: HexString[];
  creationNonce: number;
  threshold: number;
  curSN: bigint;
  nextSN: bigint;
  metadata: string;
  balance: bigint;
  pendingTxs: MSafeTxnInfo[];
  address: HexString;
  status: MSafeStatus;
};

export enum MSafeStatus {
  NORMAL = 0,
  MIGRATING = 1,
  MIGRATED = 2,
}

export class MomentumSafe {
  owners: HexString[];
  ownersPublicKeys: HexString[];
  threshold: number;
  creationNonce: bigint;
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;
  address: HexString;

  // TODO: pk, threshold, e.t.c is possible to be updated later
  // Do not construct directly through constructor. Use fromMomentumSafe instead
  protected constructor(
    owners: HexString[],
    ownerPKs: HexString[],
    threshold: number,
    nonce: bigint,
    address?: HexString
  ) {
    this.owners = owners;
    this.ownersPublicKeys = ownerPKs;
    this.threshold = threshold;
    this.creationNonce = nonce;
    const [pk, , computedAddress] = computeMultiSigAddress(
      ownerPKs,
      threshold,
      nonce
    );
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
    const owners = msafeData.info.owners.map((ownerStr) =>
      HexString.ensure(ownerStr)
    );
    const threshold = msafeData.info.threshold;
    const nonce = BigInt(msafeData.info.nonce);
    const ownerPubKeys = msafeData.info.public_keys.map((pk) =>
      HexString.ensure(pk)
    );
    return new MomentumSafe(owners, ownerPubKeys, threshold, nonce, address);
  }

  async initTransaction(signer: Account, tx: MSafeTransaction, opts: Options) {
    const [rawTx, sig] = signer.getSigData(tx);
    const tmpHash = sha3_256(rawTx);

    const initTx = await this.makeInitTxTx(signer, rawTx, sig, opts);
    const signedInitTx = signer.sign(initTx);

    const txRes = await Aptos.sendSignedTransactionAsync(signedInitTx);
    return { plHash: tmpHash, pendingTx: txRes };
  }

  async isReadyToSubmit(txHash: string | HexString, extraPubKey?: HexString) {
    const tx = await this.findTx(txHash);
    const sigs = tx.signatures.data;
    let collectedSigs = sigs.length;

    if (extraPubKey) {
      const found =
        sigs.find((entry) => isHexEqual(entry.key, extraPubKey)) !== undefined;
      if (!found) {
        collectedSigs = collectedSigs + 1;
      }
    }
    return collectedSigs >= this.threshold;
  }

  async submitTxSignature(signer: Account, txHash: string, opts: Options) {
    const txType = await this.findTx(txHash);
    const sig = this.signTx(signer, txType);

    const tx = await this.makeSubmitSignatureTxn(
      signer,
      txHash,
      txType,
      sig,
      opts
    );
    const signedTx = signer.sign(tx);
    return await Aptos.sendSignedTransactionAsync(signedTx);
  }

  async assembleAndSubmitTx(signer: Account, txHash: HexString | string) {
    const txType = await this.findTx(txHash);
    const payload = txType.payload;
    const signatures = txType.signatures;
    const selfSignature = this.signTx(signer, txType);
    const multiSignature = assembleMultiSig(
      this.ownersPublicKeys,
      signatures,
      signer,
      selfSignature
    );

    if (MigrationProofMessage.isMigrationProofMessage(HexBuffer(payload))) {
      const signingTx = await makeMigrateTxBuilder(multiSignature, this);
      const transaction = await signingTx.build(Aptos.MY_ACCOUNT.account);
      const signedTransaction = Aptos.MY_ACCOUNT.sign(transaction);
      return await Aptos.sendSignedTransactionAsync(signedTransaction);
    } else {
      const bcsTxn = assembleMultiSigTxn(
        payload,
        this.rawPublicKey,
        multiSignature
      );
      return await Aptos.sendSignedTransactionAsync(bcsTxn);
    }
  }

  signTx(signer: Account, txType: TransactionType) {
    const payload = HexBuffer(txType.payload);
    const tx = TypeMessage.isTypeMessage(payload)
      ? TypeMessage.deserialize(payload)
      : Transaction.deserialize(payload);
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
    const payload = HexBuffer(txType.payload);

    if (MigrationProofMessage.isMigrationProofMessage(payload)) {
      return [txType, toMigrateTx(txType)];
    } else {
      const msafeTx = MSafeTransaction.deserialize(HexBuffer(txType.payload));
      const msafeTxInfo = msafeTx.getTxnInfo();
      return [txType, msafeTxInfo];
    }
  }

  private async makeInitTxTx(
    signer: Account,
    payload: TxnBuilderTypes.SigningMessage,
    signature: TxnBuilderTypes.Ed25519Signature,
    opts: Options
  ) {
    // TODO: do not query for resource again;
    const txBuilder = new AptosEntryTxnBuilder();
    const pkIndex = this.getIndex(signer.publicKey());
    const config = await applyDefaultOptions(signer.address(), opts);

    return txBuilder
      .addr(DEPLOYER)
      .module(MODULES.MOMENTUM_SAFE)
      .method(FUNCTIONS.MSAFE_INIT_TRANSACTION)
      .from(signer.address())
      .withTxConfig(config)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeU8(pkIndex),
        BCS.bcsSerializeBytes(payload),
        BCS.bcsToBytes(signature),
      ])
      .build(signer.account);
  }

  async makeSubmitSignatureTxn(
    signer: Account,
    txHash: string,
    tx: TransactionType,
    sig: TxnBuilderTypes.Ed25519Signature,
    opts: Options
  ) {
    const pkIndex = this.getIndex(signer.publicKey());
    const txBuilder = new AptosEntryTxnBuilder();
    const config = await applyDefaultOptions(signer.address(), opts);

    return txBuilder
      .addr(DEPLOYER)
      .module(MODULES.MOMENTUM_SAFE)
      .method(FUNCTIONS.MSAFE_SUBMIT_SIGNATURE)
      .from(signer.address())
      .withTxConfig(config)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeU8(pkIndex),
        BCS.bcsSerializeBytes(HexBuffer(txHash)),
        BCS.bcsToBytes(sig),
      ])
      .build(signer.account);
  }

  private static async queryMSafeResource(
    address: HexString
  ): Promise<Momentum> {
    const res = await Aptos.getAccountResource(
      address,
      getStructType("MOMENTUM").toMoveStructTag()
    );
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
    const status = await getMSafeStatus(this.address);
    for (
      let nonce = sn;
      nonce <= BigInt(data.txn_book.max_sequence_number);
      nonce++
    ) {
      const nonce_hashes = await MomentumSafe.queryPendingTxHashBySN(
        data,
        nonce
      );
      const txs = await Promise.all(
        nonce_hashes.map((hash) =>
          MomentumSafe.queryPendingTxByHash(data, hash)
        )
      );
      txs
        .filter((tx) => MomentumSafe.isTxValid(tx, sn))
        .forEach((tx) => {
          const payload = HexBuffer(tx.payload);
          if (MigrationProofMessage.isMigrationProofMessage(payload)) {
            pendings.push(toMigrateTx(tx));
          } else {
            const msafeTx = MSafeTransaction.deserialize(payload);
            pendings.push(msafeTx.getTxnInfo(tx.signatures.data.length));
          }
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
      owners: data.info.owners.map((owner) => formatAddress(owner)),
      pubKeys: data.info.public_keys.map((pk) => HexString.ensure(pk)),
      creationNonce: Number(data.info.nonce),
      threshold: data.info.threshold,
      curSN: sn,
      nextSN: nextSN,
      metadata: data.info.metadata as string,
      balance: balance,
      pendingTxs: pendings,
      address: this.address,
      status,
    };
  }

  private static isTxValid(txType: TransactionType, curSN: bigint): boolean {
    const payload = HexBuffer(txType.payload);
    if (TypeMessage.isTypeMessage(payload)) {
      return (
        TypeMessage.deserialize(payload).raw.inner.sequence_number >= curSN
      );
    }
    const tx = Transaction.deserialize(HexBuffer(txType.payload));
    return (
      tx.raw.sequence_number >= curSN &&
      tx.raw.expiration_timestamp_secs >= new Date().getUTCSeconds()
    );
  }

  private getIndex(target: HexString): number {
    const i = this.ownersPublicKeys.findIndex((pk) => {
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

  static async getMomentumSafeEvent(
    owner: HexString
  ): Promise<MomentumSafeEvent> {
    const eventStruct = await Aptos.getAccountResource(
      owner,
      getStructType("MOMENTUM_EVENT").toMoveStructTag()
    );
    return eventStruct.data as any;
  }

  static async filterRegisterEvent(
    eventStruct: MomentumSafeEvent,
    option: PaginationArgs
  ) {
    return Aptos.filterEvent(eventStruct.register_events, option);
  }

  static async filterTransactionEvent(
    eventStruct: MomentumSafeEvent,
    option: PaginationArgs
  ) {
    return Aptos.filterEvent(eventStruct.transaction_events, option);
  }

  static async queryPendingTxHashBySN(
    momentum: Momentum,
    sn: bigint
  ): Promise<Vector<string>> {
    return Aptos.client().getTableItem(
      momentum.txn_book.tx_hashes.inner.handle,
      {
        key_type: "u64",
        value_type: "vector<vector<u8>>",
        key: sn.toString(),
      }
    );
  }

  static async queryPendingTxByHash(
    momentum: Momentum,
    txID: string | HexString
  ): Promise<TransactionType> {
    return Aptos.client().getTableItem(
      momentum.txn_book.pendings.inner.handle,
      {
        key_type: "vector<u8>",
        value_type: getStructType("MOMENTUM_TRANSACTION").toMoveStructTag(),
        key: txID.toString(),
      }
    );
  }
}
