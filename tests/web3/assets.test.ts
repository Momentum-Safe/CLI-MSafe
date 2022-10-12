import * as config from "../config";
import {getAssetList, getCoinTypeFromCoinStore} from "../../src/web3/assets";
import {HexString} from "aptos";
import {assert} from "chai";

describe("getAssetList", () => {

  it("test1", async () => {
    await config.init();

    const assetList = await getAssetList(HexString.ensure("0x81d06264cfbe7d3b71a9a6f50a32e9e1bf545ddd64a8ed33aaf878c66e7675e4"));
    console.log(assetList);
  });
});

describe("getCoinTypeFromCoinStore", () => {

  it("match", () => {
    const res = getCoinTypeFromCoinStore("0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
    assert(res === '0x1::aptos_coin::AptosCoin');
  });
});

