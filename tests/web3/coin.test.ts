import {Coin} from "../../src/web3/coin";
import * as config from '../config';
import {assert} from "chai";

const APT_COIN = "0x01::aptos_coin::AptosCoin";

describe('Coin',  async () => {
  await config.init();

  it('new positive', async () => {
    const coin = await Coin.new(APT_COIN);
    assert(coin.decimals === 8);
    assert(coin.name === 'APT');
    assert(coin.symbol === 'APT');
  });
});