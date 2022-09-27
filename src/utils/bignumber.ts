import {BigNumber} from 'bignumber.js';

BigNumber.config({ EXPONENTIAL_AT: 1e+9 });


export function toDust(val: BigNumber | number | string, decimal: number): bigint {
  return bigNumberToBigInt(toDustBN(val, decimal));
}

export function fromDust(val: bigint | number | string, decimal: number): bigint {
  return bigNumberToBigInt(fromDustBN(val, decimal));
}

function fromDustBN(val: bigint | number | string, decimal: number): BigNumber {
  return toBigNumber(val).div(new BigNumber(10).pow(decimal));
}

function toDustBN(val: BigNumber | number | string, decimal: number): BigNumber {
  return toBigNumber(val).times(new BigNumber(10).pow(decimal));
}

export function bigNumberToBigInt(val: BigNumber | number | string): bigint {
  const str = toBigNumber(val).toString();
  return BigInt(str);
}

export function bigIntToBigNumber(val: bigint) {
  return BigNumber(val.toString());
}

function toBigNumber(val: BigNumber | bigint | number | string) {
  if (typeof val === 'number') {
    return BigNumber(val);
  }
  if (typeof val === 'string') {
    return BigNumber(val);
  }
  if (typeof val === 'bigint') {
    return bigIntToBigNumber(val);
  }
  return val;
}