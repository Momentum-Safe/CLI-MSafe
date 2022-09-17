import {HexBuffer, HexStr, isHexEqual, SimpleMap} from "./common";
import {HexString, TxnBuilderTypes} from "aptos";
import {Account} from "../web3/account";

type SigAdded = {
  pubKey: HexString,
}

export function assembleMultiSig(
  pubKeys: HexString[],
  sigs: SimpleMap<HexStr>,
  acc: Account,
  sig: TxnBuilderTypes.Ed25519Signature
) {
  const msh = new MultiSigHelper(pubKeys, sigs);
  msh.addSig(acc.publicKey(), sig);
  return msh.assembleSignatures();
}

export class MultiSigHelper {
  /**
   * MultiSigHelper is the helper for multi-sig aggregation, query, and update
    */

  private pks: HexString[]; // pks might be updated in future implementation
  private sigs: Map<string, TxnBuilderTypes.Ed25519Signature>;

  constructor(pks: HexString[], sigs?: SimpleMap<HexStr>) {
    this.pks = pks;
    this.sigs = simpleMapToSigMap(sigs);
  }

  findIndex(target: HexString): number {
    const i = this.pks.findIndex( pk => {
      return isHexEqual(pk, target);
    });
    if (i === -1) {
      throw new Error('target public key not found');
    }
    return i;
  }

  isSigSubmitted(pk: HexString): boolean {
    return this.sigs.has(pk.hex());
  }

  numSigs(): number {
    return this.sigs.size;
  }

  updateSigs(newSigs: SimpleMap<HexStr>): SigAdded[] {
    const addedSigs: SigAdded[] = [];
    newSigs.data.forEach( entry => {
      const pk = HexString.ensure(entry.key);
      if (!this.isSigSubmitted(pk)) {
        addedSigs.push( {pubKey: pk} );
      }
    });
    this.sigs = simpleMapToSigMap(newSigs);
    return addedSigs;
  }

  addSig(pk: HexString, sig: TxnBuilderTypes.Ed25519Signature) {
    this.sigs.set(pk.hex(), sig);
  }

  assembleSignatures() {
    // construct bitmap and prepare the signature for sorting
    const bitmap: number[] = [];
    const sigsUnsorted: [number, TxnBuilderTypes.Ed25519Signature][] = [];
    this.sigs.forEach((value, key) => {
      const pkIndex = this.findIndex(HexString.ensure(key));
      bitmap.push(pkIndex);
      sigsUnsorted.push([pkIndex, value]);
    });
    // Signature need to be sorted with respect to the pkIndex
    const sigSorted = sigsUnsorted
      .sort((a, b) => a[0] - b[0])
      .map(v => v[1]);

    const parsedBitmap = TxnBuilderTypes.MultiEd25519Signature.createBitmap(bitmap);
    return new TxnBuilderTypes.MultiEd25519Signature(
      sigSorted, parsedBitmap,
    );
  }
}

function simpleMapToSigMap(smSigs: SimpleMap<HexStr> | undefined): Map<string, TxnBuilderTypes.Ed25519Signature> {
  const m = new Map<string, TxnBuilderTypes.Ed25519Signature>();
  if (smSigs) {
    smSigs.data.forEach( entry => {
      const pk = HexString.ensure(entry.key);
      const sig = new TxnBuilderTypes.Ed25519Signature(HexBuffer(entry.value));
      m.set(pk.hex(), sig);
    });
  }
  return m;
}
