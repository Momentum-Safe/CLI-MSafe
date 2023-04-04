import {BCS, HexString, TxnBuilderTypes} from "aptos";
import {NUM_FUNCTION_COMPS, NUM_MODULE_COMPS, NUM_RESOURCE_COMPS} from "./const";
import {ADDRESS_HEX_LENGTH} from "../momentum-safe/common";


export function splitModuleComponents(s: string): [HexString, string] {
  const comps = s.split('::');
  if (comps.length !== NUM_MODULE_COMPS) {
    throw new Error("invalid full module name");
  }
  return [HexString.ensure(comps[0]), comps[1]];
}

export function splitResourceComponents(s: string): [HexString, string, string] {
  const comps = s.split('::');
  if (comps.length !== NUM_RESOURCE_COMPS) {
    throw new Error("invalid full resource name");
  }
  return [HexString.ensure(comps[0]), comps[1], comps[2]];
}

export function splitFunctionComponents(s: string): [HexString, string, string] {
  const comps = s.split('::');
  if (comps.length != NUM_FUNCTION_COMPS) {
    throw new Error("invalid full function name");
  }
  return [HexString.ensure(comps[0]), comps[1], comps[2]];
}

/**
 * Return the short hex string representation of the input value.
 * If the hex is greater than 15, the result will be first 8 and last 5 of
 * the input hex.
 *
 * @param val: Input hex
 */
export function formatHexToShort(val: HexString | string): string {
  const hs = (val instanceof HexString)? val: HexString.ensure(val);
  const ss = hs.toShortString();
  if (ss.length < 15) {
    return ss;
  } else {
    return `${ss.substring(0, 8)}...${ss.substring(ss.length - 5)}`;
  }
}

// Add zeros if size is not 32
export function formatAddress(s: HexString | string): HexString {
  let hexStr = s instanceof HexString ? s.hex() : s.startsWith('0x') ? s.substring(2) : s;
  if (hexStr.length < ADDRESS_HEX_LENGTH) {
    hexStr = `0x${hexStr.padStart(ADDRESS_HEX_LENGTH, "0")}`;
  }
  return HexString.ensure(hexStr);
}

export function typeTagStructFromName(name: string) {
  const structTag = TxnBuilderTypes.StructTag.fromString(name);
  return new TxnBuilderTypes.TypeTagStruct(structTag);
}

export function secToDate(sec: BCS.Uint64) {
  const ms = Number(sec) * 1000;
  return new Date(ms);
}

const regExSimpleStruct = /(0x[a-fA-F0-9]+)(::[^:,\s]+::[^:,\s]+)/;
const regExCompoundStruct = /(0x[a-fA-F0-9]+::[^:,\s]+::[^:,\s]+)/g;

export function formatToFullType(typeName: string) {
  return typeName.replace(regExCompoundStruct, (match, p1) => {
    return formatToFullSimpleType(p1);
  });
}

export function formatToFullSimpleType(typeName: string) {
  if (!isSimpleStruct(typeName)) {
    throw new Error(`Invalid type struct: ${typeName}`);
  }
  return typeName.replace(
    regExSimpleStruct,
    (match, p1, p2) => `${formatAddress(p1).toString()}${p2}`
  );
}

export function isSimpleStruct(val: string) {
  const match = regExSimpleStruct.exec(val);

  return !!match;
}