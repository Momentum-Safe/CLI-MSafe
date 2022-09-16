import {HexString, TxnBuilderTypes,} from "aptos";
import {Account} from "../web3/account";
import {Buffer} from "buffer/";

export const DEPLOYER = '0xe5a6f272ee8517ca39d83715d14cb733e285853e924c3a3b8d6d59d9acab50aa';
export const DEPLOYER_HS = HexString.ensure(DEPLOYER);

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

export function checkDuplicatePubKeys(pks: HexString[]) {
  const s = new Set();
  pks.forEach( pk => {
    if (s.has(pk.hex())) {
      throw new Error("duplicate public key found");
    }
    s.add(pk.hex());
  });
}