import { expect } from 'chai';
import {isStringAddress, isStringHex, isStringTypeStruct} from "../../src/utils/check";

describe('isStringHex', () => {
  it('positive', () => {
    expect(isStringHex('0x1111')).to.be.true;
    expect(isStringHex('1111')).to.be.true;
    expect(isStringHex('0x0123456789abcdef')).to.be.true;
  });

  it('negative', () => {
    expect(isStringHex('0y123')).to.be.false;
    expect(isStringHex('1x123')).to.be.false;
    expect(isStringHex('123qwe')).to.be.false;
  });
});

describe('isStringAddress', () => {
  it('positive', () => {
    expect(isStringAddress('0x01')).to.be.true;
    expect(isStringAddress('0xbe836d132840c6380a97342a46e09c75ca30d1cbf561bc4161e20f71e644692c')).to.be.true;
    expect(isStringAddress('be836d132840c6380a97342a46e09c75ca30d1cbf561bc4161e20f71e644692c')).to.be.true;
  });

  it('negative', () => {
    expect(isStringAddress('0xfg')).to.be.false;
    expect(isStringAddress('be1836d132840c6380a97342a46e09c75ca30d1cbf561bc4161e20f71e644692cd')).to.be.false;
  });
});

describe('isStringTypeStruct', () => {
  it('positive', () => {
    expect(isStringTypeStruct('0x01::aptos_coin::AptosCoin')).to.be.true;
    expect(isStringTypeStruct('0x02::momentum_safe::Momentum')).to.be.true;
    expect(isStringTypeStruct('0x02::MomentumSafe::momentum_safe')).to.be.true;
  });

  it('negative', () => {
    expect(isStringTypeStruct('0x01::aptos_coin')).to.be.false;
    expect(isStringTypeStruct('aptos_coin::aptos_coin::AptosCoin')).to.be.false;
  });
});