import {Buffer} from "buffer/";
import {HexString} from "aptos";

export function HexBuffer(hex: HexString | string): Buffer {
  if (typeof hex === 'string') {
    return Buffer.from(hex.startsWith('0x') ? hex.slice(2) : hex, 'hex');
  }
  return Buffer.from(hex.hex());
}