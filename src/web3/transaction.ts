import {AptosAccount, BCS, HexString, TransactionBuilder, TxnBuilderTypes,} from "aptos";
import * as Aptos from "./global";
import {assembleMultiSigTxn} from "../momentum-safe/common";

const COIN_MODULE = "0x1::coin";
const TRANSFER_METHOD = "transfer";
export const APTOS_TOKEN = "0x1::aptos_coin::AptosCoin";

// TODO: Use prophecy and gas analysis
const DEFAULT_MAX_GAS = 50000n;
const DEFAULT_GAS_PRICE = 1000n;
const DEFAULT_EXPIRATION = 3600;

// Set the default minimum max gas
const MIN_MAX_GAS = 1000n;
const MAX_MAX_GAS = 2000000n;

const MAX_GAS_MULTI = 150n;
const MAX_GAS_DENOM = 100n;

export abstract class AptosTxnBuilder {
  private _fromAddress: HexString | undefined;
  private _sequenceNumber: bigint | undefined;
  private _chainId: number | undefined;
  private _maxGas: bigint | undefined;
  private _gasPrice: bigint | undefined;
  private _expiration: number | undefined;
  private _estimateGasPrice: boolean | undefined;
  private _estimateMaxGas: boolean | undefined;

  abstract payload(): TxnBuilderTypes.TransactionPayload;

  abstract validateAndFix(): void;

  from(from: HexString): this {
    this._fromAddress = from;
    return this;
  }

  sequenceNumber(sn: bigint): this {
    this._sequenceNumber = sn;
    return this;
  }

  chainId(cid: number): this {
    this._chainId = cid;
    return this;
  }

  maxGas(mg: bigint): this {
    this._maxGas = mg;
    return this;
  }

  gasPrice(gp: bigint): this {
    this._gasPrice = gp;
    return this;
  }

  // exp is the expiration in seconds
  expiration(exp: number): this {
    this._expiration = exp;
    return this;
  }

  estimateGasPrice(val: boolean): this {
    this._estimateGasPrice = val;
    return this;
  }

  estimateMaxGas(val: boolean): this {
    this._estimateMaxGas = val;
    return this;
  }

  withTxConfig(config: TxConfig): this {
    return this.maxGas(config.maxGas)
      .gasPrice(config.gasPrice)
      .expiration(config.expirationSec)
      .sequenceNumber(config.sequenceNumber)
      .chainId(config.chainID)
      .estimateMaxGas(config.estimateMaxGas)
      .estimateGasPrice(config.estimateGasPrice);
  }

  async build(sender: AptosAccount | IMultiSig): Promise<Transaction> {
    this._validateAndFix();
    this.validateAndFix();

    await this.estimateMaxGasAndPrice(sender);
    const raw = this.makeRawTransaction();
    return new Transaction(raw);
  }

  private _validateAndFix() {
    if (this._fromAddress === undefined) {
      throw new Error('When building transaction, from address must be specified');
    }
    if (this._sequenceNumber === undefined) {
      throw new Error('When building transaction, sequence number must be specified');
    }
    if (this._chainId === undefined) {
      throw new Error('When building transaction, chain ID must be specified');
    }
    if (this._maxGas === undefined) {
      this._maxGas = DEFAULT_MAX_GAS;
    }
    if (this._gasPrice === undefined) {
      this._gasPrice = DEFAULT_GAS_PRICE;
    }
    if (this._expiration === undefined) {
      this._expiration = DEFAULT_EXPIRATION;
    }
  }

  private async estimateMaxGasAndPrice(sender: AptosAccount | IMultiSig) {
    if (this._estimateGasPrice) {
      this._gasPrice = await Aptos.estimateGasPrice();
    }
    if (this._estimateMaxGas) {
      this._maxGas = MAX_MAX_GAS;

      const addr = sender instanceof AptosAccount? sender.address(): sender.address;
      const bal = await Aptos.getBalance(addr);
      const maxAllowedGas = bal / this._gasPrice!;
      if (this._maxGas > maxAllowedGas) {
        this._maxGas = maxAllowedGas;
      }
      if (sender instanceof AptosAccount) {
        this._maxGas = await this.buildTemp().estimateMaxGas(sender);
      } else {
        this._maxGas = await this.buildTemp().estimateMultiSigMaxGas(sender);
      }
    }
  }

  private buildTemp(): Transaction {
    this._validateAndFix();
    this.validateAndFix();
    const raw = this.makeRawTransaction();
    return new Transaction(raw);
  }

  private makeRawTransaction(): TxnBuilderTypes.RawTransaction {
    return new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(this._fromAddress as HexString),
      this.getSequenceNumber(),
      this.payload(),
      this._maxGas!,
      this._gasPrice!,
      this.getTargetExpiration(),
      this.getChainId(),
    );
  }

  private getSequenceNumber(): bigint {
    return this._sequenceNumber!;
  }

  // Current time plus expiration
  private getTargetExpiration(): bigint {
    return BigInt(Math.floor(Date.now() / 1000) + this._expiration!);
  }

  private getChainId(): TxnBuilderTypes.ChainId {
    return new TxnBuilderTypes.ChainId(this._chainId as number);
  }
}

export class AptosCoinTransferTxnBuilder extends AptosTxnBuilder {
  private _toAddress: HexString | undefined;
  private _amount: bigint | undefined;

  amount(n: bigint): this {
    this._amount = n;
    return this;
  }

  to(to: HexString): this {
    this._toAddress = to;
    return this;
  }

  validateAndFix() {
    if (this._toAddress === undefined) {
      throw new Error('When building transaction, to address must be specified');
    }
    if (this._amount === undefined) {
      throw new Error('When building transaction, amount must be specified');
    }
  }

  payload(): TxnBuilderTypes.TransactionPayload {
    const token = new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(APTOS_TOKEN));
    const scriptFn = TxnBuilderTypes.EntryFunction.natural(
      COIN_MODULE, TRANSFER_METHOD, [token],
      [
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this._toAddress as HexString)),
        BCS.bcsSerializeUint64(this._amount!),
      ],
    );
    return new TxnBuilderTypes.TransactionPayloadEntryFunction(scriptFn);
  }
}

export class AptosEntryTxnBuilder extends AptosTxnBuilder {
  private _contract!: HexString;
  private _module!: string;
  private _method!: string;
  private _type_args: any[] = [];
  private _args: any[] = [];

  addr(_contract: HexString): this {
    this._contract = _contract;
    return this;
  }

  module(_module: string): this {
    this._module = _module;
    return this;
  }

  method(_method: string): this {
    this._method = _method;
    return this;
  }

  args(_args: any[]): this {
    this._args = _args;
    return this;
  }

  type_args(_type_args: any[]): this {
    this._type_args = _type_args;
    return this;
  }

  validateAndFix() {
    if (this._module === undefined) {
      throw new Error('When building transaction, module name must be specified');
    }
    if (this._method === undefined) {
      throw new Error('When building transaction, method name must be specified');
    }
    if (this._contract === undefined) {
      throw new Error('When building transaction, contract address must be specified');
    }
  }

  payload(): TxnBuilderTypes.TransactionPayload {
    return new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${this._contract.toString()}::${this._module}`,
        this._method,
        this._type_args,
        this._args,
      ),
    );
  }
}

export type GasOption = {
  gasUnit: bigint,
  maxGas: bigint,
}


export class Transaction {
  raw: TxnBuilderTypes.RawTransaction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    this.raw = raw;
  }

  static deserialize(rawTx: Buffer): Transaction {
    const deserializer = new BCS.Deserializer(rawTx.slice(32)); // skip prefix, see TransactionBuilder.getSigningMessage
    return new Transaction(TxnBuilderTypes.RawTransaction.deserialize(deserializer));
  }

  getSigningMessage() {
    return TransactionBuilder.getSigningMessage(this.raw);
  }

  async estimateMultiSigMaxGas(sender: IMultiSig) {
    const res = await simulateMultiSigTx(sender.rawPublicKey, this.raw);
    if (!res) {
      throw Error("empty result from simulation");
    }
    if (!(res[0].success)) {
      if (res[0].vm_status.includes("SEQUENCE_NUMBER_TOO_NEW")) {
        return DEFAULT_MAX_GAS;
      }
      throw Error("simulation with error:" + res[0].vm_status);
    }
    if (BigInt(res[0].gas_used) > MAX_MAX_GAS) {
      throw Error("gas exceed max allowed");
    }
    let gas = BigInt(res[0].gas_used) * MAX_GAS_MULTI / MAX_GAS_DENOM;

    if (gas < MIN_MAX_GAS) {
      gas = MIN_MAX_GAS;
    }
    if (gas > MAX_MAX_GAS) {
      gas = MAX_MAX_GAS;
    }
    return gas;
  }

  async estimateMaxGas(sender: AptosAccount) {
    const res = await Aptos.client().simulateTransaction(sender, this.raw);
    if (!res) {
      throw Error("empty result from simulation");
    }
    if (!(res[0].success)) {
      throw Error("simulation with error:" + res[0].vm_status);
    }
    let gas = BigInt(res[0].gas_used) * MAX_GAS_MULTI / MAX_GAS_DENOM;
    if (gas < MIN_MAX_GAS) {
      gas = MIN_MAX_GAS;
    }
    return gas;
  }
}

async function simulateMultiSigTx(
  rawPK: TxnBuilderTypes.MultiEd25519PublicKey,
  txn: TxnBuilderTypes.RawTransaction,
) {
  const signingMessage = TransactionBuilder.getSigningMessage(txn);
  const sig = makeInvalidMultiSigForSimulation(rawPK);
  const bcsTxn = assembleMultiSigTxn(signingMessage, rawPK, sig);
  return Aptos.client().submitBCSSimulation(bcsTxn, {
    estimateGasUnitPrice: true,
    estimateMaxGasAmount: true
  });
}

function makeInvalidMultiSigForSimulation(rawMultiPubKey: TxnBuilderTypes.MultiEd25519PublicKey) {
  const threshold = rawMultiPubKey.threshold;
  const bitmap: number[] = [];
  const invalidSigs: TxnBuilderTypes.Ed25519Signature[] = [];
  for (let i = 0; i != threshold; i = i + 1) {
    bitmap.push(i);
    const invalidSigBytes = new Uint8Array(TxnBuilderTypes.Ed25519Signature.LENGTH);
    invalidSigs.push(new TxnBuilderTypes.Ed25519Signature(invalidSigBytes));
  }
  const parsedBitMap = TxnBuilderTypes.MultiEd25519Signature.createBitmap(bitmap);

  return new TxnBuilderTypes.MultiEd25519Signature(
    invalidSigs, parsedBitMap,
  );
}

export type Options = {
  maxGas?: bigint,
  gasPrice?: bigint,
  expirationSec?: number, // target = time.now() + expiration
  sequenceNumber?: bigint,
  chainID?: number,
  estimateGasPrice?: boolean,
  estimateMaxGas?: boolean,
}

// Parsed tx config from Options
export type TxConfig = {
  maxGas: bigint,
  gasPrice: bigint,
  expirationSec: number, // target = time.now() + expiration
  sequenceNumber: bigint,
  chainID: number,
  estimateGasPrice: boolean,
  estimateMaxGas: boolean,
}

export interface IMultiSig {
  address: HexString,
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey,
}