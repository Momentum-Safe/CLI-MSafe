import {BCS, HexString, TxnBuilderTypes,} from "aptos";
import {Account} from "../web3/account";
import {Buffer} from "buffer/";
import {Transaction} from "../web3/types";

export const DEPLOYER = '0xe5a6f272ee8517ca39d83715d14cb733e285853e924c3a3b8d6d59d9acab50aa';
export const DEPLOYER_HS = HexString.ensure(DEPLOYER);

export const MAX_NUM_OWNERS = 32;

export const MODULES = {
  MOMENTUM_SAFE: 'momentum_safe',
  CREATOR: 'creator',
  REGISTRY: 'registry',
};

export const FUNCTIONS = {
  MSAFE_REGISTER: 'register',
  MSAFE_INIT_TRANSACTION: 'init_transaction',
  MSAFE_SUBMIT_SIGNATURE: 'submit_signature',

  CREATOR_INIT_WALLET: "init_wallet_creation",
  CREATOR_SUBMIT_SIG: "submit_signature",

  REGISTRY_REGISTER: "register",
};

export const RESOURCES = {
  MOMENTUM: `${DEPLOYER}::${MODULES.MOMENTUM_SAFE}::Momentum`,
  CREATOR: `${DEPLOYER}::${MODULES.CREATOR}::PendingMultiSigCreations`,
  REGISTRY: `${DEPLOYER}::${MODULES.REGISTRY}::OwnerMomentumSafes`
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
