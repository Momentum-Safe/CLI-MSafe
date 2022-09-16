import {HexBuffer, HexStr, SimpleMap} from "./common";
import {HexString, TxnBuilderTypes} from "aptos";

type SigAdded = {
  pubKey: HexString,
}

export class MultiSigHelper {
  /**
   * MultiSigHelper is the helper for multi-sig aggregation, query, and update
    */

  private pks: HexString[]; // pks might be updated in future implementation
  private sigs: Map<HexString, TxnBuilderTypes.Ed25519Signature>;

  constructor(pks: HexString[], sigs?: SimpleMap<HexStr>) {
    this.pks = pks;
    this.sigs = simpleMapToSigMap(sigs);
  }

  findIndex(target: HexString): number {
    const i = this.pks.findIndex( pk => {
      return pk.hex() === target.hex();
    });
    if (i === -1) {
      throw new Error('target public key not found');
    }
    return i;
  }

  updateSigs(newSigs: SimpleMap<HexStr>): SigAdded[] {
    const addedSigs: SigAdded[] = [];
    newSigs.data.forEach( entry => {
      const pk = HexString.ensure(entry.key);
      if (!this.sigs.has(pk)) {
        addedSigs.push( {pubKey: pk} );
      }
    });
    this.sigs = simpleMapToSigMap(newSigs);
    return addedSigs;
  }

  addSig(pk: HexString, sig: TxnBuilderTypes.Ed25519Signature) {
    this.sigs.set(pk, sig);
  }

  assembleSignatures() {
    // construct bitmap and prepare the signature for sorting
    const bitmap: number[] = [];
    const sigsUnsorted: [number, TxnBuilderTypes.Ed25519Signature][] = [];
    this.sigs.forEach((value, key) => {
      const pkIndex = this.findIndex(key);
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

function simpleMapToSigMap(smSigs: SimpleMap<HexStr> | undefined): Map<HexString, TxnBuilderTypes.Ed25519Signature> {
  const m = new Map<HexString, TxnBuilderTypes.Ed25519Signature>();
  if (smSigs) {
    smSigs.data.forEach( entry => {
      const pk = HexString.ensure(entry.key);
      const sig = new TxnBuilderTypes.Ed25519Signature(HexBuffer(entry.value));
      m.set(pk, sig);
    });
  }
  return m;
}
