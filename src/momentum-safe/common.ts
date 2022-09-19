import {APTOS_COIN, BCS, HexString, TxnBuilderTypes} from "aptos";
import {Buffer} from "buffer/";
import {APTOS_TOKEN, Transaction} from "../web3/transaction";

export const DEPLOYER = '0x648877a0d16c79403eec543d588856f4e6edfe114564a7b37aadafe509ab9c14';
export const DEPLOYER_HS = HexString.ensure(DEPLOYER);

export const APTOS_FRAMEWORK = '0x0000000000000000000000000000000000000000000000000000000000000001';
export const APTOS_FRAMEWORK_HS = HexString.ensure(APTOS_FRAMEWORK);


export const MAX_NUM_OWNERS = 32;
export const ADDRESS_HEX_LENGTH = 64;

export const MODULES = {
  MOMENTUM_SAFE: 'momentum_safe',
  CREATOR: 'creator',
  REGISTRY: 'registry',
  COIN: 'managed_coin',
  APTOS_COIN: "aptos_coin",
};

export const FUNCTIONS = {
  MSAFE_REGISTER: 'register',
  MSAFE_INIT_TRANSACTION: 'init_transaction',
  MSAFE_SUBMIT_SIGNATURE: 'submit_signature',
  MSAFE_REVERT: 'do_nothing',

  CREATOR_INIT_WALLET: "init_wallet_creation",
  CREATOR_SUBMIT_SIG: "submit_signature",

  COIN_TRANSFER: "transfer",
  COIN_REGISTER: "register",
  COIN_MINT: "mint",

  REGISTRY_REGISTER: "register",
};

export const STRUCTS = {
  MOMENTUM: "Momentum",
  CREATOR: "PendingMultiSigCreations",
  REGISTRY: "OwnerMomentumSafes",
  APTOS_COIN: "AptosCoin",
};

export const RESOURCES = {
  MOMENTUM: `${DEPLOYER}::${MODULES.MOMENTUM_SAFE}::${STRUCTS.MOMENTUM}`,
  CREATOR: `${DEPLOYER}::${MODULES.CREATOR}::${STRUCTS.CREATOR}`,
  REGISTRY: `${DEPLOYER}::${MODULES.REGISTRY}::${STRUCTS.REGISTRY}`,
  APTOS_COIN: `${APTOS_COIN}::${MODULES.COIN}::${STRUCTS.APTOS_COIN}`,
};

export type vector<T> = T[]

export type HexStr = string

export type Element<V> = {
  key: string,
  value: V
}

export type SimpleMap<V> = {
  data: Element<V>[]
}

export function assembleMultiSigTxn(
  payload: string,
  pubKey: TxnBuilderTypes.MultiEd25519PublicKey,
  sig: TxnBuilderTypes.MultiEd25519Signature,
): Uint8Array {
  const authenticator = new TxnBuilderTypes.TransactionAuthenticatorMultiEd25519(pubKey, sig);
  const signingTx = Transaction.deserialize(HexBuffer(payload));
  const signedTx = new TxnBuilderTypes.SignedTransaction(signingTx.raw, authenticator);
  return BCS.bcsToBytes(signedTx);
}

export function HexBuffer(hex: string): Buffer {
  return Buffer.from(hex.startsWith('0x') ? hex.slice(2) : hex, 'hex');
}

export function hasDuplicateAddresses(addrs: HexString[]): boolean {
  const s = new Set();
  addrs.forEach( pk => {
    if (s.has(pk.hex())) {
      return true;
    }
    s.add(pk.hex());
  });
  return false;
}

export function serializeOwners(addrs: HexString[]): BCS.Bytes {
  const bcsAddress = (addr: HexString) => TxnBuilderTypes.AccountAddress.fromHex(addr);

  const serializer = new BCS.Serializer();
  BCS.serializeVector(addrs.map(owner => bcsAddress(owner)), serializer);
  return serializer.getBytes();
}

export function isHexEqual(hex1: HexString | string, hex2: HexString | string): boolean {
  const hs1 = (hex1 instanceof HexString)? hex1: HexString.ensure(hex1);
  const hs2 = (hex2 instanceof HexString)? hex2: HexString.ensure(hex2);
  return hs1.toShortString() === hs2.toShortString();
}

// Add zeros if size is not 32
export function formatAddress(s: HexString | string): HexString {
  let hexStr = s instanceof HexString? s.hex(): s.startsWith('0x')? s.substring(2): s;
  if (hexStr.length < ADDRESS_HEX_LENGTH) {
    hexStr = ''.concat('0'.repeat(ADDRESS_HEX_LENGTH - hexStr.length), hexStr);
  }
  return HexString.ensure(hexStr);
}

export function secToDate(sec: BCS.Uint64) {
  const ms = Number(sec) * 1000;
  return new Date(ms);
}

export function typeTagStructFromName(name: string) {
  const structTag = TxnBuilderTypes.StructTag.fromString(name);
  return new TxnBuilderTypes.TypeTagStruct(structTag);
}

