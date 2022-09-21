// TODO: make use of this ABI parser.

import {BCS, HexString} from "aptos";
import * as Aptos from "../web3/global";

export class PublicABIParser {
  addr: HexString;
  module: string;
  fullName: string;

  constructor(contractAddr: HexString, moduleName: string) {
    this.addr = contractAddr;
    this.module = moduleName;
    this.fullName = `${contractAddr}::${moduleName}`;
  }

  async init() {
    const moduleData = await Aptos.getAccountModule(this.addr, this.module);
    if (!moduleData.abi) {
      throw new Error(`${this.fullName} has no ABI exposed`);
    }
    if (!moduleData.abi.exposed_functions) {
      throw new Error(`${this.fullName} has no exposed function`);
    }
    const peFns =moduleData.abi.exposed_functions.filter(
      fn => fn.visibility === 'public' && fn.is_entry
    );
  }
}

const ARGUMENT_TYPE_REG = new Map<string, Argument>();

interface Argument {
  typeName: string;
  bcsEncode(): BCS.Bytes;
}

abstract class bigintArg {
  typeName = 'abstract bigint';
  value: bigint | undefined;

  protected constructor(s: string) {
    this.value = BigInt(s);
  }
}

export class U128Arg {
  typeName = "U128";
  value: bigint | undefined;

  bcsEncode(): BCS.Bytes {
    return BCS.bcsSerializeU128(this.value!);
  }
}

export class U64Arg {
  typeName = 'U64';
  value: bigint | undefined;

  bcsEncode(): BCS.Bytes {
    return BCS.bcsSerializeUint64(this.value!);
  }
}

abstract class NumberArg {
  typeName = 'abstract number';
  value: number | undefined;

  protected constructor(s: string) {
    this.value = Number(s);
  }
}

export class U8Arg extends NumberArg {
  typeName = 'U8';

  bcsEncode(): BCS.Bytes {
    return BCS.bcsSerializeU8(this.value!);
  }
}

export class U16Arg extends NumberArg {
  typeName = 'U16';

  bcsEncode(): BCS.Bytes {
    return BCS.bcsSerializeU16(this.value!);
  }
}

export class U32Arg extends NumberArg {
  typeName = 'U32';

  bcsEncode(): BCS.Bytes {
    return BCS.bcsSerializeU32(this.value!);
  }
}






