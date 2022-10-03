import {AptosCoinTransferTxnBuilder, AptosEntryTxnBuilder, Transaction} from "../web3/transaction";
import {BCS, HexString, TransactionBuilder, TxnBuilderTypes} from "aptos";
import * as Aptos from '../web3/global';
import {Buffer} from "buffer/";
import {
  APTOS_FRAMEWORK_HS,
  FUNCTIONS,
  MODULES,
  Options,
  STRUCTS, TxConfig
} from "./common";
import {IncludedArtifacts, MovePublisher, PackageMetadata} from "./move-publisher";
import {sha3_256} from "../utils/crypto";
import { sha3_256 as sha3Hash } from "@noble/hashes/sha3";
import {secToDate, typeTagStructFromName} from "../utils/parse";
import {isHexEqual} from "../utils/check";
import {DEPLOYER} from "../web3/global";

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = MINUTE_SECONDS * 60;
const DAY_SECONDS = HOUR_SECONDS * 24;
const WEEK_SECONDS = DAY_SECONDS * 7;
// const MONTH_SECONDS = DAY_SECONDS * 30;
// const YEAR_SECONDS = DAY_SECONDS *365;

const DEFAULT_UNIT_PRICE = 100n;
const DEFAULT_REGISTER_MAX_GAS = 5000n;
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

export type CustomInteractionArgs = {
  deployer: HexString,
  moduleName: string,
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

export enum MSafeTxnType {
  Unknown = "Unknown transaction",
  APTCoinTransfer = "Transfer APT",
  AnyCoinTransfer = "Transfer COIN",
  AnyCoinRegister = "Register COIN",
  Revert = "Revert transaction",
  CustomInteraction = "Custom module interaction",
  ModulePublish = "Module publish",
}

// TODO: add module publish payload info
export type payloadInfo = CoinTransferArgs | CoinRegisterArgs | APTTransferArgs
  | RevertArgs | CustomInteractionArgs | ModulePublishInfo

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
  sender: HexString,
  args: MSafeRegisterArgs,
  opts: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const txn = txBuilder
    .addr(DEPLOYER)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_REGISTER)
    .from(sender)
    .chainId(config.chainID)
    .sequenceNumber(config.sequenceNumber)
    .maxGas(config.maxGas)
    .gasPrice(config.gasPrice)
    .expiration(config.expirationSec)
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
    .chainId(config.chainID)
    .sequenceNumber(config.sequenceNumber)
    .maxGas(config.maxGas)
    .gasPrice(config.gasPrice)
    .expiration(config.expirationSec)
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
    .chainId(config.chainID)
    .sequenceNumber(config.sequenceNumber)
    .gasPrice(config.gasPrice)
    .maxGas(config.maxGas)
    .expiration(config.expirationSec)
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
    .chainId(config.chainID)
    .sequenceNumber(config.sequenceNumber)
    .gasPrice(config.gasPrice)
    .maxGas(config.maxGas)
    .expiration(config.expirationSec)
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
    .addr(DEPLOYER)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_REVERT)
    .from(sender)
    .chainId(config.chainID)
    .sequenceNumber(config.sequenceNumber)
    .gasPrice(config.gasPrice)
    .maxGas(config.maxGas)
    .expiration(config.expirationSec)
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
    .chainId(config.chainID)
    .sequenceNumber(config.sequenceNumber)
    .gasPrice(config.gasPrice)
    .maxGas(config.maxGas)
    .expiration(config.expirationSec)
    .type_args(args.typeArgs.map(ta => typeTagStructFromName(ta)))
    .args(args.args)
    .build();
  return new MSafeTransaction(tx.raw);
}

export async function compileAndMakeModulePublishTx(
  sender: HexString,
  args: ModuleCompilePublishArgs,
  opts?: Options,
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender, opts);
  const namedAddress = {
    addrName: args.deployerAddressName,
    addrValue: sender,
  };
  await MovePublisher.compile(args.moveDir, args.artifacts, namedAddress);
  const mp = await MovePublisher.fromMoveDir(args.moveDir);
  const tx = mp.getDeployTransaction(sender, config);
  return new MSafeTransaction(tx.raw);
}

export async function makeModulePublishTx(sender: HexString, args: ModulePublishArgs, opts?: Options) {
  const config = await applyDefaultOptions(sender, opts);
  const mp = await MovePublisher.fromMoveDir(args.moveDir);
  const tx = mp.getDeployTransaction(sender, config);
  return new MSafeTransaction(tx.raw);
}

async function applyDefaultOptions(sender: HexString, opts?: Options): Promise<TxConfig> {
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
  };
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
      sn: tx.sequence_number,
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
    if (isModulePublishTxn(payload)) {
      return MSafeTxnType.ModulePublish;
    }
    return MSafeTxnType.CustomInteraction;
  }

  private getTxnFuncArgs(): payloadInfo {
    const payload = this.payload;

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

      case MSafeTxnType.CustomInteraction: {
        const [addr, moduleName, fnName] = getModuleComponents(payload);
        const tArgs = decodeTypeArgs(payload);
        const args = payload.value.args;
        return {
          deployer: addr,
          moduleName: moduleName,
          fnName: fnName,
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

export async function decodeCustomArgs(
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
    return decodeCustomArg(arg, filteredParams[i]);
  });
}

function decodeCustomArg(data: Uint8Array, paramType: string) {
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
      return ["address", HexString.fromUint8Array(deserializer.deserializeBytes())];
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

  return [toAddress, amount];
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
