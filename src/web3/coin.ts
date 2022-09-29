import * as Aptos from './global';
import {APTOS_FRAMEWORK_HS, MODULES, STRUCTS} from "../momentum-safe/common";
import {isStringResource} from "../utils/check";
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
    const coinInfo = await Aptos.getAccountResource(addr, Coin.coinResourceTag(coinType)) as any;
    return new Coin(
      coinInfo.data.name,
      coinInfo.data.symbol,
      coinInfo.data.decimals,
    );
  }

  static coinResourceTag(coinType: string): string {
    return `${APTOS_FRAMEWORK_HS.toShortString()}::${MODULES.COIN}::${STRUCTS.COIN_INFO}<${coinType}>`;
  }
}
