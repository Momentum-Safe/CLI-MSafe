import {Coin} from "../../src/web3/coin";
import * as config from '../config';

const APT_COIN = "0x01::aptos_coin::AptosCoin";

describe('Coin',  async () => {
  await config.init();

  it('new positive', async () => {
    const coin = await Coin.new(APT_COIN);
  });
});