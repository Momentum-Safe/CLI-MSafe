import {HexString, TxnBuilderTypes} from "aptos";
import {NUM_FUNCTION_COMPS, NUM_MODULE_COMPS, NUM_RESOURCE_COMPS} from "./const";

// TODO: add check for function names, module names, and resource name.

export function isStringHex(s: string): boolean {
  const re = /^(0x)?[0-9A-Fa-f]+$/g;
  return re.test(s);
}

export function isStringAddress(s: string): boolean {
  if (!isStringHex(s)) {
    return false;
  }
  try {
    const byteLength = HexString.ensure(s).toUint8Array().length;
    return byteLength <= 32; // SHA3_256 length
  } catch (e) {
    return false;
  }
}

export function isStringTypeStruct(s: string): boolean {
  try {
    TxnBuilderTypes.StructTag.fromString(s);
  } catch (e) {
    return false;
  }
  return true;
}

export function isStringPublicKey(s: string): boolean {
  if (!isStringHex(s)) {
    return false;
  }
  const byteLength = HexString.ensure(s).toUint8Array().length;
  return byteLength == TxnBuilderTypes.Ed25519PublicKey.LENGTH;
}

export function isStringFullModule(s: string): boolean {
  return isStringMoveComps(s, NUM_MODULE_COMPS);
}

export function isStringResource(s: string): boolean {
  return isStringMoveComps(s, NUM_RESOURCE_COMPS);
}

export function isStringFunction(s: string): boolean {
  return isStringMoveComps(s, NUM_FUNCTION_COMPS);
}

function isStringMoveComps(s: string, expectComps: number): boolean {
  const comps = s.split('::');
  if (comps.length != expectComps) {
    return false;
  }
  return isStringAddress(comps[0]);
}

export function isHexEqual(hex1: HexString | string, hex2: HexString | string): boolean {
  const hs1 = (hex1 instanceof HexString) ? hex1 : HexString.ensure(hex1);
  const hs2 = (hex2 instanceof HexString) ? hex2 : HexString.ensure(hex2);
  return hs1.toShortString() === hs2.toShortString();
}