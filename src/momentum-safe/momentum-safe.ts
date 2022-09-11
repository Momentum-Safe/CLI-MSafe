import * as Aptos from "../web3/global";
import {HexString, TxnBuilderTypes, BCS} from 'aptos';
import {AptosCoinTransferTxnBuilder, AptosEntryTxnBuilder} from '../web3/txnBuilder';
import {Transaction} from "../web3/types";
import {Account} from '../web3/account';
import {vector, SimpleMap, HexStr, DEPLOYER, DEPLOYER_HS, HexBuffer, assembleSignatures} from './common';
import {computeMultiSigAddress, sha3_256} from "../web3/crypto";
import {Uint64} from "aptos/dist/transaction_builder/bcs";

// TODO: refactor naming
const MomentumSafeModule = 'MomentumSafe';
const momentumSafeResourceType = `${DEPLOYER}::${MomentumSafeModule}::Momentum`;
const initTransactionFn = 'init_transaction';
const submitSignatureFn = 'submit_signature';


// Data stored in MomentumSafe.move
type Momentum = {
  info: Info,
  txnBook: TxnBook,
}

type Info = {
  public_keys: vector<HexStr>, // vector of public_keys
  nonce: number,
  threshold: number,
  metadata: HexStr, // plain text / json / uri
}

type TxnBook = {
  tx_hashes: SimpleMap<vector<HexStr>>, // nonce => vector<tx hash>
  // sequence number => a list of transactions (with the same sequence number)
  pendings: SimpleMap<TransactionType>, // Hash => Tx
}

export type TransactionType = {
  nonce: string,
  payload: HexStr,
  metadata: HexStr, // json or uri
  signatures: SimpleMap<HexStr>, // public_key => signature
}

type TxnBrief = {
  sn: number,
  numSigs: number,
  hash: string,
  operation?: coinTransferTxBrief,
}

type coinTransferTxBrief = {
  to: HexString,
  amount: bigint,
  coin: string,
  expiration: Date,
}

export type CoinTransferTx = {
  sender: HexString,
  sn: number,
  expiration: Date,
  chainID: number,
  gasPrice: bigint,
  maxGas: bigint,
  moduleName: string,
  functionName: string,
  typeArgs: string,
  to: HexString,
  amount: bigint,
}

export type MomentumSafeInfo = {
  pubKeys: HexString[],
  creationNonce: number,
  threshold: number,
  curSN: number,
  metadata: string,
  balance: number,
  pendingTxs: TxnBrief[],
}

export class MomentumSafe {
  ownersPublicKeys: HexString[];
  threshold: number;
  creationNonce: number;
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;
  address: HexString;

  // TODO: pk, threshold, e.t.c is possible to be updated later
  constructor(ownerPKs: HexString[], threshold: number, nonce: number, address?: HexString) {
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
    const msafeData = await MomentumSafe.queryMSafeResource(address);
    const threshold  = msafeData.info.threshold;
    const nonce = msafeData.info.nonce;
    const ownerPubKeys = msafeData.info.public_keys.map( pk => HexString.ensure(pk));
    return new MomentumSafe(ownerPubKeys, threshold, nonce);
  }

  static async queryMSafeResource(address: HexString): Promise<Momentum> {
    const res = await Aptos.getAccountResource(address, momentumSafeResourceType);
    return res.data as Momentum;
  }

  async getResource(): Promise<Momentum> {
    return MomentumSafe.queryMSafeResource(this.address);
  }

  async initCoinTransfer(signer: Account, to: HexString, amount: bigint) {
    const tx = await this.makeCoinTransferTx(to, amount);
    const [rawTx, [sig]] = signer.getSigData(tx);
    const tmpHash = sha3_256(rawTx);

    const initTx = await this.makeCoinTransferInitTx(signer, rawTx, sig);
    const signedInitTx = signer.sign(initTx);

    const txRes = await Aptos.sendSignedTransactionAsync(signedInitTx);
    return [tmpHash, txRes];
  }

  async isReadyToSubmit(txHash: string, extraPubKey: HexString) {
    const tx = await this.findTx(txHash);
    const sigs = tx.signatures.data;

    const found = sigs.find(entry => entry.key === extraPubKey.hex()) !== undefined;
    let collectedSigs = sigs.length;
    if (!found) {
      collectedSigs = collectedSigs + 1;
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

  async assembleAndSubmitTx(signer: Account, txHash: string) {
    const txType = await this.findTx(txHash);
    const signatures = txType.signatures.data;
    const payload = txType.payload;

    const selfSignature = this.signTx(signer, txType);

    const multiSignature = assembleSignatures(this.ownersPublicKeys, signatures, signer, selfSignature);
    const authenticator = new TxnBuilderTypes.TransactionAuthenticatorMultiEd25519(this.rawPublicKey, multiSignature);
    const signingTx = Transaction.deserialize(HexBuffer(payload));
    const signedTx = new TxnBuilderTypes.SignedTransaction(signingTx.raw, authenticator);
    const bcsTx = BCS.bcsToBytes(signedTx);
    return await Aptos.sendSignedTransactionAsync(bcsTx);
  }

  signTx(signer: Account, txType: TransactionType) {
    const tx = Transaction.deserialize(HexBuffer(txType.payload));
    const [, [sig]] = signer.getSigData(tx);
    return sig;
  }

  // TODO: do not query for resource
  async findTx(txHash: string) {
    const res = await this.getResource();
    return res.txnBook.pendings.data.find(entry => entry.key === txHash)!.value;
  }

  // TODO: do not query for resource
  // TODO: better API for TransactionType
  // TODO: make tx a separate class
  async getTxDetails(txHash: string): Promise<[TransactionType, CoinTransferTx]> {
    const txType = await this.findTx(txHash);
    const curSN = await Aptos.getSequenceNumber(this.address);
    if (!MomentumSafe.isTxValid(txType, curSN)) {
      throw new Error("Transaction is no longer valid: low sequence number.");
    }
    const txData = MomentumSafe.decodeCoinTransferTx(txType.payload);
    return [txType, txData];
  }

  private async makeCoinTransferInitTx(
    signer: Account,
    payload: TxnBuilderTypes.SigningMessage,
    signature: TxnBuilderTypes.Ed25519Signature
  ) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer.address());
    // TODO: do not query for resource again;
    const multiSN = await this.getMSafeNextSequenceNumber();
    const txBuilder = new AptosEntryTxnBuilder();
    const pkIndex = this.getIndex(signer.publicKey());

    return txBuilder
      .contract(DEPLOYER_HS)
      .module(MomentumSafeModule)
      .method(initTransactionFn)
      .from(signer.address())
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeUint64(multiSN),
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
      .contract(DEPLOYER_HS)
      .module(MomentumSafeModule)
      .method(submitSignatureFn)
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

  async getMomentumSafeInfo(): Promise<MomentumSafeInfo> {
    const data = await MomentumSafe.queryMSafeResource(this.address);
    const balance = await Aptos.getBalance(this.address);
    const sn = await Aptos.getSequenceNumber(this.address);
    const pendings: TxnBrief[] = [];
    data.txnBook.pendings.data.forEach( tx => {
      if (MomentumSafe.isTxValid(tx.value, sn)) {
        const decodedTx = MomentumSafe.decodeCoinTransferTx(tx.value.payload);
        pendings.push({
          sn: Number(tx.value.nonce),
          numSigs: tx.value.signatures.data.length,
          hash: tx.key,
          operation: MomentumSafe.coinTransferTxToTxBrief(decodedTx),
        });
      }
    });
    pendings.sort( (a, b) => {
      if (a.sn != b.sn) {
        return a.sn - b.sn;
      } else {
        return a.operation!.expiration.getUTCSeconds() - b.operation!.expiration.getUTCSeconds();
      }
    });
    return {
      pubKeys: data.info.public_keys.map(pk => HexString.ensure(pk)),
      creationNonce: data.info.nonce,
      threshold: data.info.threshold,
      curSN: sn,
      metadata: data.info.metadata as string,
      balance: balance,
      pendingTxs: pendings,
    };
  }

  private static isTxValid(tx: TransactionType, curSN: number): boolean {
    // Add expiration
    return Number(tx.nonce) >= curSN;
  }

  private async makeCoinTransferTx(to: HexString, amount: bigint) {
    const sn = await this.getMSafeNextSequenceNumber();
    const chainID = await Aptos.getChainId();
    const txBuilder = new AptosCoinTransferTxnBuilder();
    return txBuilder
      .from(this.address)
      .to(to)
      .amount(Number(amount))
      .sequenceNumber(sn)
      .chainId(chainID)
      .build();
  }

  // TODO: do not query for resource in this function
  private async getMSafeNextSequenceNumber() {
    const res = await this.getResource();
    let maxNonce = await Aptos.getSequenceNumber(this.address);
    res.txnBook.pendings.data.forEach( entry => {
      if (Number(entry.value.nonce) + 1 > maxNonce) {
        maxNonce = Number(entry.value.nonce) + 1;
      }
    });
    return maxNonce;
  }

  private getIndex(target: HexString): number {
    const i = this.ownersPublicKeys.findIndex( pk => {
      return pk.hex() === target.hex();
    });
    if (i == -1) {
      throw new Error("target pk not found in momentum safe");
    }
    return i;
  }

  // TODO: refactor this
  private static decodeCoinTransferTx(payload: string): CoinTransferTx {
    const tx = Transaction.deserialize(HexBuffer(payload)).raw;
    const txPayload = tx.payload;
    if (!(txPayload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction)) {
      throw new Error('unknown transaction payload');
    }
    const address = (arr: Uint8Array) => HexString.fromUint8Array(arr);
    const moduleName = `${address(txPayload.value.module_name.address.address).hex()}:${txPayload.value.module_name.name.value}`;
    const fnName = txPayload.value.function_name.value;
    const typeArgs: string[] = [];
    txPayload.value.ty_args.forEach( tyArg => {
      if (tyArg instanceof TxnBuilderTypes.TypeTagStruct) {
        typeArgs.push(`${address(tyArg.value.address.address).hex()}::${tyArg.value.module_name.value}::${tyArg.value.name.value}`);
      }
    });
    let toAddress: HexString;
    let amount: bigint;
    txPayload.value.args.forEach( (arg, i) => {
      switch (i) {
        case 0: {
          const addressBytes = TxnBuilderTypes.AccountAddress.deserialize(new BCS.Deserializer(arg));
          toAddress = address(addressBytes.address);
          break;
        }
        case 1: {
          amount = (new BCS.Deserializer(arg)).deserializeU64();
        }
      }
    });
    return {
      sender: HexString.fromUint8Array(tx.sender.address),
      sn: Number(tx.sequence_number),
      expiration: MomentumSafe.secToDate(tx.expiration_timestamp_secs),
      chainID: tx.chain_id.value,
      gasPrice: tx.gas_unit_price,
      maxGas: tx.max_gas_amount,
      moduleName: moduleName,
      functionName: fnName,
      typeArgs: typeArgs[0],
      to: toAddress!,
      amount: amount!,
    };
  }

  private static secToDate(sec: Uint64) {
    const ms = Number(sec) * 1000;
    return new Date(ms);
  }

  private static coinTransferTxToTxBrief(tx: CoinTransferTx): coinTransferTxBrief {
    return {
      to: tx.to,
      amount: tx.amount,
      coin: tx.typeArgs,
      expiration: tx.expiration,
    };
  }
}




