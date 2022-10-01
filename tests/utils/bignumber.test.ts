import {expect} from "chai";
import {bigNumberToBigInt, fromDust, toDust} from "../../src/utils/bignumber";
import {BigNumber} from "bignumber.js";


describe('big number', () => {
  it('fromDust', () => {
    expect(fromDust(10000000, 1).eq(BigNumber(1000000))).to.be.true;
    expect(fromDust(10000000, 2).eq(BigNumber(100000))).to.be.true;
    expect(fromDust(10000000, 7).eq(BigNumber(1))).to.be.true;
    expect(fromDust(10000000, 10).eq(BigNumber(0.001))).to.be.true;
    expect(fromDust(10000000, 13).eq(BigNumber(0.000001))).to.be.true;
  });

  it('toDust', () => {
    expect(toDust(0.001, 3) == BigInt(1)).to.be.true;
    expect(toDust(0.001, 5) == BigInt(100)).to.be.true;
    expect(toDust(1, 18) == BigInt("1000000000000000000")).to.be.true;
  });

  it('toDust failed', () => {
    try {
      toDust(0.001, 0);
      expect(true, "promise shall fail").eq(false);
    } catch (e) {
      expect((e as any).message === 'Cannot convert 0.001 to a BigInt');
    }
  });

  it('bigNumberToBigInt', () => {

    it ('positive', () => {
      expect(bigNumberToBigInt("1e18")).eq(BigInt("1000000000000000000"));
      expect(bigNumberToBigInt("1e24")).eq(BigInt("1000000000000000000000000"));
    });

    it ('error', () => {
      expect(bigNumberToBigInt("1e-1")).to.throw('Cannot convert 0.1 to a BigInt');
    });
  });
});