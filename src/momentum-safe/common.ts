import {HexString, TxnBuilderTypes,} from "aptos";
import {Account} from "../web3/account";
import {Buffer} from "buffer/";

export const DEPLOYER = 'f9399f083d60ff754c63571fd47b0014fffbec92d646e913cccbc633c0094818';
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