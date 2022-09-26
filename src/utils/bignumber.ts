import {BigNumber} from 'bignumber.js';

BigNumber.config({ EXPONENTIAL_AT: 1e+9 });


export function fromDust(val: BigNumber | number | string, decimal: number): BigNumber {
  return toBigInt(val).div(new BigNumber(10).pow(decimal));
}

export function toDust(val: BigNumber | number | string, decimal: number): BigNumber {
  return toBigInt(val).times(new BigNumber(10).pow(decimal));
}

export function bigNumberToBigInt(val: BigNumber | number | string): bigint {
  const str = toBigInt(val).toString();
  return BigInt(str);
}

function toBigInt(val: BigNumber | number | string) {
  if (typeof val === 'number') {
    return BigNumber(val);
  }
  if (typeof val === 'string') {
    return BigNumber(val);
  }
  return val;
}