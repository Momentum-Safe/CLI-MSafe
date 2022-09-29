import {APTOS_TOKEN, AptosCoinTransferTxnBuilder, AptosEntryTxnBuilder, Transaction} from "../web3/transaction";
import {BCS, HexString, TransactionBuilder, TxnBuilderTypes} from "aptos";
import * as Aptos from '../web3/global';
import {Buffer} from "buffer/";
import {
  APTOS_FRAMEWORK_HS,
  DEPLOYER_HS,
  FUNCTIONS,
  HexBuffer,
  isHexEqual,
  MODULES,
  secToDate,
  STRUCTS,
  typeTagStructFromName
} from "./common";
import {sha3_256} from "../web3/crypto";

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = MINUTE_SECONDS * 60;
const DAY_SECONDS = HOUR_SECONDS * 24;
const WEEK_SECONDS = DAY_SECONDS * 7;
const MONTH_SECONDS = DAY_SECONDS * 30;
const YEAR_SECONDS = DAY_SECONDS *365;

const DEFAULT_UNIT_PRICE = 100;
const DEFAULT_REGISTER_MAX_GAS = 5000;
const DEFAULT_EXPIRATION = 3 * WEEK_SECONDS;


// TODO: replace with bigint
export type Options = {
  maxGas?: number,
  gasPrice?: number,
  expirationSec?: number, // target = time.now() + expiration
  sequenceNumber?: number,
  chainID?: number,
}

export type MSafeRegisterArgs = {
  metadata: string,
}

export type CoinTransferArgs = {
  coinType: string,
  to: HexString,
  amount: number
}

export type CoinRegisterArgs = {
  coinType: string,
}

export type APTTransferArgs = {
  to: HexString,
  amount: number, //TODO: replace with big number
}

export type RevertArgs = {
  sn: number, // The sn will override option.sequenceNumber
}

export type CustomInteractionArgs = {
  deployer: HexString,
  moduleName: string,
  fnName: string,
  typeArgs: string[],
  args: BCS.Bytes[], // encoded bytes
}

export enum MSafeTxnType {
  Unknown = "Unknown transaction",
  APTCoinTransfer = "Transfer APT",
  AnyCoinTransfer = "Transfer COIN",
  AnyCoinRegister = "Register COIN",
  AnyCoinMinter = "Mint COIN",
  Revert = "Revert transaction",
  CustomInteraction = "Custom module interaction",
}

export type FunArgs = CoinTransferArgs | CoinRegisterArgs | APTTransferArgs
  | RevertArgs | CustomInteractionArgs

export type MSafeTxnInfo = {
  txType: MSafeTxnType,
  hash: HexString,
  sender: HexString,
  sn: number,
  expiration: Date,
  chainID: number,
  gasPrice: bigint,
  maxGas: bigint,
  args: FunArgs,
  numSigs?: number,
}

// call momentum_safe::register
export async function makeMSafeRegisterTx(
  sender: HexString,
  args: MSafeRegisterArgs,
  opts: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const txn = txBuilder
    .addr(DEPLOYER_HS)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_REGISTER)
    .from(sender)
    .chainId(config.chainID!)
    .sequenceNumber(config.sequenceNumber!)
    .maxGas(BigInt(config.maxGas!))
    .gasPrice(BigInt(config.gasPrice!))
    .expiration(config.expirationSec!)
    .args([BCS.bcsSerializeStr(args.metadata)])
    .build();
  return new MSafeTransaction(txn.raw);
}

export async function makeMSafeAPTTransferTx(
  sender: HexString,
  args: APTTransferArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  const txBuilder = new AptosCoinTransferTxnBuilder();
  const txn = txBuilder
    .from(sender)
    .chainId(config.chainID!)
    .sequenceNumber(config.sequenceNumber!)
    .maxGas(BigInt(config.maxGas!))
    .gasPrice(BigInt(config.gasPrice!))
    .expiration(config.expirationSec!)
    .to(args.to)
    .amount(args.amount)
    .build();
  return new MSafeTransaction(txn.raw);
}

export async function makeMSafeAnyCoinRegisterTx(
  sender: HexString,
  args: CoinRegisterArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const structTag = typeTagStructFromName(args.coinType);
  const txn = txBuilder
    .addr(APTOS_FRAMEWORK_HS)
    .module(MODULES.MANAGED_COIN)
    .method(FUNCTIONS.COIN_REGISTER)
    .from(sender)
    .chainId(config.chainID!)
    .sequenceNumber(config.sequenceNumber!)
    .gasPrice(BigInt(config.gasPrice!))
    .maxGas(BigInt(config.maxGas!))
    .expiration(config.expirationSec!)
    .type_args([structTag])
    .args([])
    .build();
  return new MSafeTransaction(txn.raw);
}

export async function makeMSafeAnyCoinTransferTx(
  sender: HexString,
  args: CoinTransferArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const structTag = typeTagStructFromName(args.coinType);

  const txn = txBuilder
    .addr(APTOS_FRAMEWORK_HS)
    .module(MODULES.COIN)
    .method(FUNCTIONS.COIN_TRANSFER)
    .from(sender)
    .chainId(config.chainID!)
    .sequenceNumber(config.sequenceNumber!)
    .gasPrice(BigInt(config.gasPrice!))
    .maxGas(BigInt(config.maxGas!))
    .expiration(config.expirationSec!)
    .type_args([structTag])
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(args.to)),
      BCS.bcsSerializeUint64(args.amount),
    ])
    .build();
  return new MSafeTransaction(txn.raw);
}

export async function makeMSafeRevertTx(
  sender: HexString,
  args: RevertArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  // sequence number will override option sn
  config.sequenceNumber = args.sn;
  const txBuilder = new AptosEntryTxnBuilder();
  const txn = txBuilder
    .addr(DEPLOYER_HS)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_REVERT)
    .from(sender)
    .chainId(config.chainID!)
    .sequenceNumber(config.sequenceNumber!)
    .gasPrice(BigInt(config.gasPrice!))
    .maxGas(BigInt(config.maxGas!))
    .expiration(config.expirationSec!)
    .args([])
    .build();
  return new MSafeTransaction(txn.raw);
}

export async function makeCustomInteractionTx(
  sender: HexString,
  args: CustomInteractionArgs,
  opts?: Options
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const tx = txBuilder
    .addr(args.deployer)
    .module(args.moduleName)
    .method(args.fnName)
    .from(sender)
    .chainId(config.chainID!)
    .sequenceNumber(config.sequenceNumber!)
    .gasPrice(BigInt(config.gasPrice!))
    .maxGas(BigInt(config.maxGas!))
    .expiration(config.expirationSec!)
    .type_args(args.typeArgs.map(ta => typeTagStructFromName(ta)))
    .args(args.args)
    .build();
  return new MSafeTransaction(tx.raw);
}

async function applyDefaultOptions(sender: HexString, opts?: Options) {
  if (!opts) {
    opts = {};
  }
  if (!opts.maxGas) {
    opts.maxGas = DEFAULT_REGISTER_MAX_GAS;
  }
  if (!opts.gasPrice) {
    opts.gasPrice = DEFAULT_UNIT_PRICE;
  }
  if (!opts.expirationSec) {
    opts.expirationSec = DEFAULT_EXPIRATION;
  }
  if (!opts.sequenceNumber) {
    opts.sequenceNumber = await Aptos.getSequenceNumber(sender);
  }
  if (!opts.chainID) {
    opts.chainID = await Aptos.getChainId();
  }
  return opts;
}

export class MSafeTransaction extends Transaction {
  txType: MSafeTxnType;
  payload: TxnBuilderTypes.TransactionPayloadEntryFunction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    super(raw);
    if (!(raw.payload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction)) {
      throw new Error("unknown transaction payload type");
    }
    this.payload = raw.payload;
    this.txType = MSafeTransaction.getTxnType(raw.payload);
  }

  static deserialize(rawTx: Buffer): MSafeTransaction {
    const tx = Transaction.deserialize(rawTx);
    return new MSafeTransaction(tx.raw);
  }

  getTxnInfo(numSigs?: number): MSafeTxnInfo {
    const tx = this.raw;
    return{
      txType: this.txType,
      hash: sha3_256(TransactionBuilder.getSigningMessage(tx)),
      sender: HexString.fromUint8Array(tx.sender.address),
      sn: Number(tx.sequence_number),
      expiration: secToDate(tx.expiration_timestamp_secs),
      chainID: tx.chain_id.value,
      gasPrice: tx.gas_unit_price,
      maxGas: tx.max_gas_amount,
      args: this.getTxnFuncArgs(),
      numSigs: numSigs,
    };
  }

  private static getTxnType(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): MSafeTxnType {
    if (isCoinTransferTxn(payload)) {
      if (isAptosCoinType(payload)) {
        return MSafeTxnType.APTCoinTransfer;
      }
      return MSafeTxnType.AnyCoinTransfer;
    }
    if (isCoinRegisterTx(payload)) {
      return MSafeTxnType.AnyCoinRegister;
    }
    if (isRevertTxn(payload)) {
      return MSafeTxnType.Revert;
    }
    return MSafeTxnType.Unknown;
  }

  private getTxnFuncArgs(): FunArgs {
    const payload = this.payload;

    switch (this.txType) {
      case MSafeTxnType.APTCoinTransfer: {
        const [toAddress, amount] = decodeCoinTransferArgs(payload);
        const res: APTTransferArgs = {
          to: toAddress,
          amount: Number(amount),
        };
        return res;
      }

      case MSafeTxnType.AnyCoinTransfer: {
        const coinType = decodeAptosCoinType(payload);
        const [toAddress, amount] = decodeCoinTransferArgs(payload);
        const res: CoinTransferArgs = {
          coinType: coinType,
          to: toAddress,
          amount: Number(amount),
        };
        return res;
      }

      case MSafeTxnType.AnyCoinRegister: {
        const coinType = decodeAptosCoinType(payload);
        const res: CoinRegisterArgs = {
          coinType: coinType,
        };
        return res;
      }

      case MSafeTxnType.Revert: {
        const sn = this.raw.sequence_number;
        const res: RevertArgs = {sn: Number(sn)};
        return res;
      }

      default:
        throw new Error("unhandled transaction type");
    }
  }
}

function isCoinTransferTxn(payload: TxnBuilderTypes.TransactionPayloadEntryFunction) {
  const [deployer, module, fnName] = getModuleComponents(payload);

  return isHexEqual(deployer, APTOS_FRAMEWORK_HS)
    && module === MODULES.COIN
    && fnName === FUNCTIONS.COIN_TRANSFER;
}

function isCoinRegisterTx(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): boolean {
  const [deployer, module, fnName] = getModuleComponents(payload);

  return isHexEqual(deployer, APTOS_FRAMEWORK_HS)
    && module === MODULES.MANAGED_COIN
    && fnName === FUNCTIONS.COIN_REGISTER;
}

function isAptosCoinType(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): boolean {
  const tArgs = payload.value.ty_args;
  if (tArgs.length !== 1) {
    return false;
  }
  const coinType = tArgs[0];
  if (!(coinType instanceof TxnBuilderTypes.TypeTagStruct)) {
    return false;
  }
  const coinTypeAddr = HexString.fromUint8Array(coinType.value.address.address);
  return isHexEqual(coinTypeAddr, APTOS_FRAMEWORK_HS)
    && coinType.value.module_name.value === MODULES.APTOS_COIN
    && coinType.value.name.value === STRUCTS.APTOS_COIN;
}

function isRevertTxn(payload: TxnBuilderTypes.TransactionPayloadEntryFunction) {
  const [deployer, module, fnName] = getModuleComponents(payload);

  return isHexEqual(deployer, DEPLOYER_HS)
    && module === MODULES.MOMENTUM_SAFE
    && fnName === FUNCTIONS.MSAFE_REVERT;
}

// Return address, module, and function name
function getModuleComponents(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): [HexString, string, string] {
  const moduleName = payload.value.module_name;
  const deployer = moduleName.address.address;
  const module = moduleName.name.value;
  const fnName = payload.value.function_name.value;
  return [
    HexString.fromUint8Array(deployer),
    module,
    fnName,
  ];
}

function decodeAptosCoinType(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): string {
  const tArgs = payload.value.ty_args;
  if (tArgs.length !== 1) {
    throw new Error("length is not 1");
  }
  const coinType = tArgs[0];
  if (!(coinType instanceof TxnBuilderTypes.TypeTagStruct)) {
    throw new Error("not type tag struct");
  }
  return parseTypeStructTag(coinType);
}

// parse the type struct tag to printable message
function parseTypeStructTag(typeTag: TxnBuilderTypes.TypeTagStruct) {
  const deployer = typeTag.value.address.address;
  const moduleName = typeTag.value.module_name.value;
  const structName = typeTag.value.name.value;
  const deployerDisplay = HexString.fromUint8Array(deployer);
  return `${deployerDisplay}::${moduleName}::${structName}`;
}

function decodeCoinTransferArgs(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): [HexString, bigint] {
  const args = payload.value.args;
  if (args.length != 2) {
    throw new Error(`Number arguments not expected: ${payload.value.args.length}/2`);
  }
  const toArg = args[0];
  const aptosAddress = TxnBuilderTypes.AccountAddress.deserialize(new BCS.Deserializer(toArg));
  const toAddress = HexString.fromBuffer(aptosAddress.address);

  const amountArg = args[1];
  const amount = (new BCS.Deserializer(amountArg)).deserializeU64();

  return [toAddress, amount.valueOf()];
}
