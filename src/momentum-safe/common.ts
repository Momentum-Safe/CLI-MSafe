import {HexString, TxnBuilderTypes,} from "aptos";
import {Account} from "../web3/account";
import {Buffer} from "buffer/";

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

// TODO: Refactor this.
export function assembleSignatures(
  ownerPubKeys: HexString[],
  existingSigs: Element<string>[],
  acc: Account,
  sig: TxnBuilderTypes.Ed25519Signature
) {
  const bitmap: number[] = [];
  const signaturesUnsorted: [number, TxnBuilderTypes.Ed25519Signature][] = [];
  existingSigs.forEach(({key: pubKey, value: signature}) => {
    const pk_index = ownerPubKeys.findIndex((sa) => sa.hex() == pubKey);
    bitmap.push(pk_index);
    signaturesUnsorted.push(
      [pk_index, new TxnBuilderTypes.Ed25519Signature(HexBuffer(signature))]
    );
  });
  const extra_index = ownerPubKeys.findIndex((sa) => sa.hex() == acc.publicKey().hex());
  signaturesUnsorted.push([extra_index, sig]);
  bitmap.push(extra_index);
  const signatureSorted = signaturesUnsorted
    .sort((a, b) => a[0] - b[0])
    .map(v => v[1]);
  const parsedBitmap = TxnBuilderTypes.MultiEd25519Signature.createBitmap(bitmap);
  return new TxnBuilderTypes.MultiEd25519Signature(
    signatureSorted, parsedBitmap,
  );
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