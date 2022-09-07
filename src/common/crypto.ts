import {TxnBuilderTypes, HexString, BCS} from "aptos";
import {Buffer} from "buffer/"; // the trailing slash is important!


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
  pubKey.writeUInt32LE(nonce, 0);
  return new TxnBuilderTypes.Ed25519PublicKey(pubKey);
}
