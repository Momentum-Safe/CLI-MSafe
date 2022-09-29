import { APTOS_COIN, BCS, HexString, TxnBuilderTypes } from "aptos";
import { Buffer } from "buffer/";
import { Transaction } from "../web3/transaction";

export const DEPLOYER = '0x0e5d541b27f78bc505bc2a61aff4ba6c13a35a02911ac6c0f0f40dd16ca0d338';
export const DEPLOYER_HS = HexString.ensure(DEPLOYER);

export const APTOS_FRAMEWORK = '0x0000000000000000000000000000000000000000000000000000000000000001';
export const APTOS_FRAMEWORK_HS = HexString.ensure(APTOS_FRAMEWORK);


export const MAX_NUM_OWNERS = 32;
export const ADDRESS_HEX_LENGTH = 64;

export const MODULES = {
  MOMENTUM_SAFE: 'momentum_safe',
  CREATOR: 'creator',
  REGISTRY: 'registry',
  COIN: 'coin',
  MANAGED_COIN: 'managed_coin',
  APTOS_COIN: "aptos_coin",
  CODE: "code",
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

  PUBLISH_PACKAGE: "publish_package_txn",
};

export const STRUCTS = {
  MOMENTUM: "Momentum",
  MOMENTUM_TRANSACTION: "Transaction",
  CREATOR: "PendingMultiSigCreations",
  CREATOR_CREATION: "MomentumSafeCreation",
  REGISTRY: "OwnerMomentumSafes",
  APTOS_COIN: "AptosCoin",
  COIN_INFO: "CoinInfo"
};

export const RESOURCES = {
  MOMENTUM: `${DEPLOYER}::${MODULES.MOMENTUM_SAFE}::${STRUCTS.MOMENTUM}`,
  MOMENTUM_TRANSACTION: `${DEPLOYER}::${MODULES.MOMENTUM_SAFE}::${STRUCTS.MOMENTUM_TRANSACTION}`,
  CREATOR: `${DEPLOYER}::${MODULES.CREATOR}::${STRUCTS.CREATOR}`,
  CREATOR_CREATION: `${DEPLOYER}::${MODULES.CREATOR}::${STRUCTS.CREATOR_CREATION}`,
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

export type Table<K, V> = {
  handle: string
}

export type TableWithLength<K, V> = {
  inner: Table<K, V>,
  length: string,
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
  addrs.forEach(pk => {
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

export type Options = {
  maxGas?: bigint,
  gasPrice?: bigint,
  expirationSec?: number, // target = time.now() + expiration
  sequenceNumber?: bigint,
  chainID?: number,
}

// Parsed tx config from Options
export type TxConfig = {
  maxGas: bigint,
  gasPrice: bigint,
  expirationSec: number, // target = time.now() + expiration
  sequenceNumber: bigint,
  chainID: number,
}

