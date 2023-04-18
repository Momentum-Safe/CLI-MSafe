import {HexString, TxnBuilderTypes} from "aptos";
import {NUM_FUNCTION_COMPS, NUM_MODULE_COMPS, NUM_RESOURCE_COMPS} from "./const";
import {formatToFullType, hasSimpleStruct} from "./parse";

// TODO: add check for function names, module names, and resource name.

export function isStringHex(s: string): boolean {
  const re = /^(0x)?[0-9A-Fa-f]+$/g;
  return re.test(s);
}

export function isStringAddress(s: string): boolean {
  if (!isStringHex(s)) {
    return false;
  }
  if (s.includes('0x')) {
    return s.length <= 66;
  } else {
    return s.length <= 64;
  }
}

export function isStringTypeStruct(s: string): boolean {
  if (!hasSimpleStruct(s)) {
    return false;
  }
  try {
    formatToFullType(s);
  } catch (e) {
    console.log(e);
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