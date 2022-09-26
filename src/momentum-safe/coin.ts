import * as Aptos from '../web3/global';
import {APTOS_FRAMEWORK_HS, MODULES, RESOURCES, STRUCTS} from "./common";
import {isStringResource} from "../utils/check";
import {setGlobal} from "../web3/global";
import {splitResourceComponents} from "../utils/parse";

export class Coin {

  protected constructor(
    public readonly name: string,
    public readonly symbol: string,
    public readonly decimals: number,
  ) {}

  static async new(coinType: string) {
    if (!isStringResource(coinType)) {
      throw new Error("invalid coinType: " + coinType);
    }
    const [addr, ,] = splitResourceComponents(coinType);
    const coinInfo = await Aptos.getAccountResource(addr, Coin.coinResourceTag(coinType));
    console.log(coinInfo);
  }

  static coinResourceTag(coinType: string): string {
    return `${APTOS_FRAMEWORK_HS}::${MODULES.COIN}::${STRUCTS.COIN_INFO}<${coinType}>`;
  }
}

async function test() {
  setGlobal({
    nodeURL: "https://fullnode.devnet.aptoslabs.com/v1",
    faucetURL: "https://faucet.devnet.aptoslabs.com/",
    privateKey: "0x5a0df2184c8c55f4950cdc6907d86735558bdcc4e2de3f03ce93cc934d2dbc5d",
    address: "abca607b56f41f02150914a088e3e2f26a291fe0db092dcad50d71a8d6355020",
  });
  await Coin.new("0x01::aptos_coin::AptosCoin");
  await Coin.new("0xabca607b56f41f02150914a088e3e2f26a291fe0db092dcad50d71a8d6355020::test_coin::TestCoin");
}


