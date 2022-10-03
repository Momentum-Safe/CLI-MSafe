import {
  TxnBuilderTypes,
  HexString,
  BCS
} from "aptos";
import {Buffer} from "buffer/"; // the trailing slash is important!
import { sha3_256 as sha3Hash } from "@noble/hashes/sha3";
import * as Aptos from "../web3/global";
import {HexBuffer} from "./buffer";


// MomentumSafe public key is a blend of owners and a nonce (as address)
export function computeMultiSigAddress(owners: string[] | Uint8Array[] | HexString[], threshold: number, nonce: number):
  [TxnBuilderTypes.MultiEd25519PublicKey, HexString, HexString] {

  const publicKeys: TxnBuilderTypes.Ed25519PublicKey[] = owners.map( (owner) => {
    return parsePubKey(owner);
  });
  publicKeys.push(noncePubKey(nonce));
  const multiPubKey = new TxnBuilderTypes.MultiEd25519PublicKey(
    publicKeys, threshold,
  );
  const authKey = TxnBuilderTypes.AuthenticationKey.fromMultiEd25519PublicKey(
    multiPubKey
  );
  return [
    multiPubKey,
    HexString.fromUint8Array(multiPubKey.toBytes()),
    authKey.derivedAddress()
  ];
}


function parsePubKey(publicKey: string | Uint8Array | HexString): TxnBuilderTypes.Ed25519PublicKey {
  let pkBytes: BCS.Bytes;
  if (typeof publicKey === 'string') {
    pkBytes = HexString.ensure(publicKey).toUint8Array();
  } else if (publicKey instanceof HexString) {
    pkBytes = publicKey.toUint8Array();
  } else {
    pkBytes = publicKey;
  }
  return new TxnBuilderTypes.Ed25519PublicKey(pkBytes);
}


function noncePubKey(nonce: number) {
  const pubKey = Buffer.alloc(TxnBuilderTypes.Ed25519PublicKey.LENGTH);
  const deployerBuf = HexBuffer(Aptos.DEPLOYER);
  deployerBuf.copy(pubKey, 0, 0, 16);
  pubKey.writeUInt32LE(nonce, 16);
  return new TxnBuilderTypes.Ed25519PublicKey(pubKey);
}


export function deriveAuthKey(publicKey: HexString): HexString {
  const hash = sha3Hash.create();
  hash.update(publicKey.toUint8Array());
  hash.update("\x00");
  return HexString.fromUint8Array(hash.digest());
}

// Used to calculate the temporary hash of the transaction payload
export function sha3_256(payload: Uint8Array): HexString {
  const hash = sha3Hash.create();
  hash.update(payload);
  return HexString.fromUint8Array(hash.digest());
}
