import {CoinType} from "../../src/web3/coinType";
import * as config from '../config';
import {assert} from "chai";

const APT_COIN = "0x01::aptos_coin::AptosCoin";

describe('CoinType',  () => {

  it('new positive', async () => {
    await config.init();

    const coin = await CoinType.fromMoveCoin(APT_COIN);
    assert(coin.decimals === 8);
    assert(coin.name === 'Aptos Coin');
    assert(coin.symbol === 'APT');
  });
});