import {DEPLOYED} from "../../deployed";
import {getDeployedAddrFromNodeURL} from "../../src/web3/config";
import {expect} from "chai";
import {HexString} from "aptos";
import {isHexEqual} from "../../src/utils/check";


describe('getDeployedAddrFromNodeURL', () => {
  it('testnet', () => {
    expect(isHexEqual(getDeployedAddrFromNodeURL('testnet'),
      HexString.ensure(DEPLOYED.testnet))).to.be.true;

    expect(isHexEqual(getDeployedAddrFromNodeURL('https://fullnode.testnet.aptoslabs.com/v1'),
      HexString.ensure(DEPLOYED.testnet))).to.be.true;
  });

  it('devnet', () => {
    expect(isHexEqual(getDeployedAddrFromNodeURL('devnet'),
      HexString.ensure(DEPLOYED.devnet))).to.be.true;

    expect(isHexEqual(getDeployedAddrFromNodeURL('https://fullnode.devnet.aptoslabs.com/v1'),
      HexString.ensure(DEPLOYED.devnet))).to.be.true;
  });
});