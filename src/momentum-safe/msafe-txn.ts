import {
    AptosCoinTransferTxnBuilder,
    AptosEntryTxnBuilder, AptosScriptTxnBuilder,
    AptosTxnBuilder, IMultiSig,
    Options,
    Transaction, TxConfig
} from "../web3/transaction";
import {BCS, HexString, TransactionBuilder, TxnBuilderTypes, Types} from "aptos";
import * as Aptos from '../web3/global';
import {
  APTOS_FRAMEWORK_HS,
  FUNCTIONS,
  MODULES,
  STRUCTS
} from "./common";
import {IncludedArtifacts, MovePublisher, PackageMetadata} from "./move-publisher";
import {sha3_256} from "../utils/crypto";
import { sha3_256 as sha3Hash } from "@noble/hashes/sha3";
import {secToDate, splitFunctionComponents, typeTagStructFromName} from "../utils/parse";
import {isHexEqual} from "../utils/check";
import {DEPLOYER} from "../web3/global";
import fs from "fs";

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = MINUTE_SECONDS * 60;
const DAY_SECONDS = HOUR_SECONDS * 24;
const WEEK_SECONDS = DAY_SECONDS * 7;
// const MONTH_SECONDS = DAY_SECONDS * 30;
// const YEAR_SECONDS = DAY_SECONDS *365;

// Normally use < 6000 gas
const DEF_REGISTER_MAX_GAS = 12000n;
const DEFAULT_UNIT_PRICE = 1000n;
const DEFAULT_REGISTER_MAX_GAS = 50000n;
const DEFAULT_EXPIRATION = WEEK_SECONDS;


export type MSafeRegisterArgs = {
  metadata: string,
}

export type CoinTransferArgs = {
  coinType: string,
  to: HexString,
  amount: bigint
}

export type CoinRegisterArgs = {
  coinType: string,
}

export type APTTransferArgs = {
  to: HexString,
  amount: bigint,
}

export type RevertArgs = {
  sn: bigint, // The sn will override option.sequenceNumber
}

export type EntryFunctionArgs = {
  fnName: string,
  typeArgs: string[],
  args: BCS.Bytes[], // encoded bytes
}

export type ModuleCompilePublishArgs = {
  moveDir: string,
  artifacts: IncludedArtifacts,
  deployerAddressName: string, // address name in Move.toml
}

export type ModulePublishArgs = {
  moveDir: string,
}

export type ModulePublishInfo = {
  hash: HexString,
  metadata: PackageMetadata,
  byteCode: Buffer,
}

export type MoveScriptArgs = {
  moveScriptFile: string,
  typeArgs: string[],
  args: TxnBuilderTypes.TransactionArgument[],
}

export type MoveScriptInfo = {
  code: Uint8Array,
  codeHash: Uint8Array,
  typeArgs: string[],
  args: TxnBuilderTypes.TransactionArgument[], // encoded bytes
}

export enum MSafeTxnType {
  Unknown = "Unknown transaction",
  APTCoinTransfer = "Transfer APT",
  AnyCoinTransfer = "Transfer COIN",
  AnyCoinRegister = "Register COIN",
  Revert = "Revert transaction",
  EntryFunction = "Entry function",
  ModulePublish = "Module publish",
  MoveScript = "Move script",
}

// TODO: add module publish payload info
export type payloadInfo = CoinTransferArgs | CoinRegisterArgs | APTTransferArgs
  | RevertArgs | EntryFunctionArgs | ModulePublishInfo | MoveScriptInfo;

export type MSafeTxnInfo = {
  txType: MSafeTxnType,
  hash: HexString,
  sender: HexString,
  sn: bigint,
  expiration: Date,
  chainID: number,
  gasPrice: bigint,
  maxGas: bigint,
  args: payloadInfo,
  numSigs?: number,
}

// call momentum_safe::register
export async function makeMSafeRegisterTx(
  sender: IMultiSig,
  args: MSafeRegisterArgs,
  opts: Options,
): Promise<MSafeTransaction> {
  opts.estimateMaxGas = false; // Special use case for register transaction
  if (!opts.maxGas) {
    opts.maxGas = DEF_REGISTER_MAX_GAS;
  }
  const config = await applyDefaultOptions(sender.address, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const tx = await txBuilder
    .addr(DEPLOYER)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_REGISTER)
    .from(sender.address)
    .withTxConfig(config)
    .args([BCS.bcsSerializeStr(args.metadata)])
    .build(sender);
  // Note: We do not need to replace the max gas here.
  return new MSafeTransaction(tx.raw);
}

export async function makeMSafeAPTTransferTx(
  sender: IMultiSig,
  args: APTTransferArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const txBuilder = new AptosCoinTransferTxnBuilder();
  const tx = await txBuilder
    .from(sender.address)
    .chainId(config.chainID)
    .withTxConfig(config)
    .to(args.to)
    .amount(args.amount)
    .build(sender);

  return new MSafeTransaction(tx.raw);
}

export async function makeMSafeAnyCoinRegisterTx(
  sender: IMultiSig,
  args: CoinRegisterArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const structTag = typeTagStructFromName(args.coinType);
  const tx = await txBuilder
    .addr(APTOS_FRAMEWORK_HS)
    .module(MODULES.MANAGED_COIN)
    .method(FUNCTIONS.COIN_REGISTER)
    .from(sender.address)
    .withTxConfig(config)
    .type_args([structTag])
    .args([])
    .build(sender);

  return new MSafeTransaction(tx.raw);
}

export async function makeMSafeAnyCoinTransferTx(
  sender: IMultiSig,
  args: CoinTransferArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const structTag = typeTagStructFromName(args.coinType);

  const tx = await txBuilder
    .addr(APTOS_FRAMEWORK_HS)
    .module(MODULES.COIN)
    .method(FUNCTIONS.COIN_TRANSFER)
    .from(sender.address)
    .withTxConfig(config)
    .type_args([structTag])
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(args.to)),
      BCS.bcsSerializeUint64(args.amount),
    ])
    .build(sender);

  return new MSafeTransaction(tx.raw);
}

export async function makeMSafeRevertTx(
  sender: IMultiSig,
  args: RevertArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  // sequence number will override option sn
  config.sequenceNumber = args.sn;
  const txBuilder = new AptosEntryTxnBuilder();
  const tx = await txBuilder
    .addr(DEPLOYER)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_REVERT)
    .from(sender.address)
    .withTxConfig(config)
    .args([])
    .build(sender);
  return new MSafeTransaction(tx.raw);
}

export async function makeEntryFunctionTx(
  sender: IMultiSig,
  args: EntryFunctionArgs,
  opts?: Options
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const [deployer, moduleName, fnName] = splitFunctionComponents(args.fnName);
  const txBuilder = new AptosEntryTxnBuilder();
  const tx = await txBuilder
    .addr(deployer)
    .module(moduleName)
    .method(fnName)
    .from(sender.address)
    .withTxConfig(config)
    .type_args(args.typeArgs.map(ta => typeTagStructFromName(ta)))
    .args(args.args)
    .build(sender);

  return new MSafeTransaction(tx.raw);
}

export async function compileAndMakeModulePublishTx(
  sender: IMultiSig,
  args: ModuleCompilePublishArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const namedAddress = {
    addrName: args.deployerAddressName,
    addrValue: sender.address,
  };
  await MovePublisher.compile(args.moveDir, args.artifacts, namedAddress);
  const mp = await MovePublisher.fromMoveDir(args.moveDir);
  const tx = await mp.getDeployTransaction(sender, config);
  return new MSafeTransaction(tx.raw);
}

export async function makeModulePublishTx(
  sender: IMultiSig,
  args: ModulePublishArgs,
  opts?: Options
) {
  const config = await applyDefaultOptions(sender.address, opts);
  const mp = await MovePublisher.fromMoveDir(args.moveDir);
  const tx = await mp.getDeployTransaction(sender, config);
  return new MSafeTransaction(tx.raw);
}

export async function makeMoveScriptTx(
    sender: IMultiSig,
    args: MoveScriptArgs,
    opts?: Options
) {
  const config = await applyDefaultOptions(sender.address, opts);
  const moveCode = fs.readFileSync(args.moveScriptFile);
    const txBuilder = new AptosScriptTxnBuilder();
    const tx = await txBuilder
        .from(sender.address)
        .withTxConfig(config)
        .type_args(args.typeArgs)
        .args(args.args)
        .script(moveCode)
        .build(sender);
    return new MSafeTransaction(tx.raw);
}

export async function applyDefaultOptions(sender: HexString, opts?: Options): Promise<TxConfig> {
  if (!opts) {
    opts = {};
  }
  const maxGas = opts.maxGas? opts.maxGas: DEFAULT_REGISTER_MAX_GAS;
  const gasPrice = opts.gasPrice? opts.gasPrice: DEFAULT_UNIT_PRICE;
  const expirationSec = opts.expirationSec? opts.expirationSec: DEFAULT_EXPIRATION;

  let sequenceNumber: bigint;
  if (opts.sequenceNumber !== undefined) {
    sequenceNumber = opts.sequenceNumber;
  } else {
    sequenceNumber = await Aptos.getSequenceNumber(sender);
  }

  let chainID: number;
  if (opts.chainID !== undefined) {
    chainID = opts.chainID;
  } else {
    chainID = await Aptos.getChainId();
  }
  return {
    maxGas: maxGas,
    gasPrice: gasPrice,
    expirationSec: expirationSec,
    sequenceNumber: sequenceNumber,
    chainID: chainID,
    estimateGasPrice: !!(opts.estimateGasPrice),
    estimateMaxGas: !!(opts.estimateMaxGas),
  };
}

export class MSafeTransaction extends Transaction {
  txType: MSafeTxnType;
  payload: TxnBuilderTypes.TransactionPayload;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    super(raw);
    if (!(raw.payload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction || raw.payload instanceof TxnBuilderTypes.TransactionPayloadScript)) {
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
      sn: tx.sequence_number,
      expiration: secToDate(tx.expiration_timestamp_secs),
      chainID: tx.chain_id.value,
      gasPrice: tx.gas_unit_price,
      maxGas: tx.max_gas_amount,
      args: this.getTxnFuncArgs(),
      numSigs: numSigs,
    };
  }

  private static getTxnType(payload: TxnBuilderTypes.TransactionPayload): MSafeTxnType {
    if(payload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction) {
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
      if (isModulePublishTxn(payload)) {
        return MSafeTxnType.ModulePublish;
      }
      return MSafeTxnType.EntryFunction;
    } else if (payload instanceof TxnBuilderTypes.TransactionPayloadScript) {
      return MSafeTxnType.MoveScript;
    }
    return MSafeTxnType.Unknown;
  }

  private getTxnFuncArgs(): payloadInfo {
    if(this.payload instanceof TxnBuilderTypes.TransactionPayloadScript) {
      return decodeMoveScriptInfo(this.payload);
    }
    const payload = this.payload  as TxnBuilderTypes.TransactionPayloadEntryFunction;

    switch (this.txType) {
      case MSafeTxnType.APTCoinTransfer: {
        const [toAddress, amount] = decodeCoinTransferArgs(payload);
        return {
          to: toAddress,
          amount: amount,
        };
      }

      case MSafeTxnType.AnyCoinTransfer: {
        const coinType = decodeCoinType(payload);
        const [toAddress, amount] = decodeCoinTransferArgs(payload);
        return {
          coinType: coinType,
          to: toAddress,
          amount: amount,
        };
      }

      case MSafeTxnType.AnyCoinRegister: {
        const coinType = decodeCoinType(payload);
        return {
          coinType: coinType,
        };
      }

      case MSafeTxnType.Revert: {
        const sn = this.raw.sequence_number;
        return {sn: BigInt(sn)};
      }

      case MSafeTxnType.EntryFunction: {
        const [addr, moduleName, fnName] = getModuleComponents(payload);
        const tArgs = decodeTypeArgs(payload);
        const args = payload.value.args;
        return {
          fnName: `${addr}::${moduleName}::${fnName}`,
          typeArgs: tArgs,
          args: args,
        };
      }

      case MSafeTxnType.ModulePublish: {
        return decodeModulePublishArgs(payload);
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

  return isHexEqual(deployer, DEPLOYER)
    && module === MODULES.MOMENTUM_SAFE
    && fnName === FUNCTIONS.MSAFE_REVERT;
}

function isModulePublishTxn(payload: TxnBuilderTypes.TransactionPayloadEntryFunction) {
  const [deployer, module, fnName] = getModuleComponents(payload);

  return isHexEqual(deployer, APTOS_FRAMEWORK_HS)
    && module === MODULES.CODE
    && fnName === FUNCTIONS.PUBLISH_PACKAGE;
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

function decodeTypeArgs(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): string[] {
  const tArgs = payload.value.ty_args;
  return tArgs.map( tArg => decodeTypeTag(tArg) );
}

function decodeTypeTag(tArg: TxnBuilderTypes.TypeTag): string {
  if (tArg instanceof TxnBuilderTypes.TypeTagStruct) {
    return parseTypeStructTag(tArg);
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagU8) {
    return "u8";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagU64) {
    return "u64";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagU128) {
    return "u128";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagAddress) {
    return "address";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagBool) {
    return "bool";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagVector) {
    const innerType = decodeTypeTag(tArg);
    return `vector<${innerType}>`;
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagSigner) {
    return "&signer";
  }
  throw new Error("unknown type tag");
}

export async function decodeEntryFunctionArgs(
  deployer: HexString,
  moduleName: string,
  fnName: string,
  args: BCS.Bytes[]
) {
  const params = await getFunctionABI(deployer, moduleName, fnName);
  const filteredParams = params.filter(param => param != 'signer' && param != '&signer');
  if (filteredParams.length != args.length) {
    throw new Error("argument size does not match param size");
  }
  return args.map((arg, i) => {
    return decodeEntryFunctionArg(arg, filteredParams[i]);
  });
}

function decodeEntryFunctionArg(data: Uint8Array, paramType: string) {
  const deserializer = new BCS.Deserializer(data);

  switch (paramType) {
    case "&signer": {
      return ["&signer", "&signer"];
    }
    case "signer": {
      return ["signer", "signer"];
    }
    case ("u128"): {
      return ["u128", deserializer.deserializeU128()];
    }
    case ("u64"): {
      return ["u64", deserializer.deserializeU64()];
    }
    case ("u32"): {
      return ["u32", deserializer.deserializeU32()];
    }
    case ("u16"): {
      return ["u16", deserializer.deserializeU16()];
    }
    case ("u8"): {
      return ["u8", deserializer.deserializeU8()];
    }
    case ("bool"): {
      return ["bool", deserializer.deserializeBool()];
    }
    case ("address"): {
      return ["address", HexString.fromUint8Array(
        deserializer.deserializeFixedBytes(TxnBuilderTypes.AccountAddress.LENGTH))];
    }
    case ("vector<u8>"): {
      return ["vector<u8>", HexString.fromUint8Array(deserializer.deserializeBytes())];
    }
    case ("0x1::string::String"): {
      return ["string", deserializer.deserializeStr()];
    }
    default:
      return [paramType, HexString.fromUint8Array(data).hex()];
  }
}

export async function getFunctionABI(contract: HexString, moduleName: string, fnName: string){
  const moduleData = await Aptos.getAccountModule(contract, moduleName);
  if (!moduleData.abi) {
    throw new Error(`${contract}::${moduleName} has no ABI exposed`);
  }
  if (!moduleData.abi.exposed_functions) {
    throw new Error(`${contract}::${moduleName} has no exposed function`);
  }
  const abi = moduleData.abi.exposed_functions.find(fn => fn.name === fnName);
  if (!abi) {
    throw new Error(`${contract}::${moduleName}::${fnName} not found`);
  }
  return abi.params.map(param => String(param));
}

function decodeCoinType(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): string {
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
  if (typeTag.value.type_args.length === 0) {
    return `${deployerDisplay}::${moduleName}::${structName}`;
  }

  const tArgsDisplay = typeTag.value.type_args.map(tArg => decodeTypeTag(tArg));
  return `${deployerDisplay}::${moduleName}::${structName}<${tArgsDisplay.join(', ')}>`;
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

  return [toAddress, amount];
}

function decodeMoveScriptInfo(payload: TxnBuilderTypes.TransactionPayloadScript): MoveScriptInfo {
  return {
    code: payload.value.code,
    codeHash: sha3_256(payload.value.code).toUint8Array(),
    typeArgs: payload.value.ty_args.map(tArg => decodeTypeTag(tArg)),
    args: payload.value.args as any,
  };
}

function decodeModulePublishArgs(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): ModulePublishInfo {
  const args = payload.value.args;
  if (args.length != 2) {
    throw new Error("unexpected argument size for publish_module_tx");
  }
  const bcsMetadata = (new BCS.Deserializer(args[0])).deserializeBytes();
  const codes = Buffer.from(args[1]);
  const metadata = PackageMetadata.deserialize(new BCS.Deserializer(bcsMetadata));
  return {
    hash: getModulePublishHash(bcsMetadata, codes),
    metadata: metadata,
    byteCode: codes,
  };
}

function getModulePublishHash(metadataRaw: Uint8Array, codes: Uint8Array): HexString {
  const hash = sha3Hash.create();
  hash.update(metadataRaw);
  hash.update(codes);
  return HexString.fromUint8Array(hash.digest());
}
