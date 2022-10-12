import * as Aptos from './global';
import {APTOS_FRAMEWORK_HS, MODULES, STRUCTS} from "../momentum-safe/common";
import {isStringResource} from "../utils/check";
import {splitResourceComponents} from "../utils/parse";


const COIN_TYPE_REG = new Map<string, CoinType>();

export async function getCoinType(coinTypeStr: string) {
  if (COIN_TYPE_REG.has(coinTypeStr)) {
    return COIN_TYPE_REG.get(coinTypeStr)!;
  }
  const ct = await CoinType.fromMoveCoin(coinTypeStr);
  COIN_TYPE_REG.set(coinTypeStr, ct);
  return ct;
}

export class CoinType {

  protected constructor(
    public readonly coinType: string,
    public readonly name: string,
    public readonly symbol: string,
    public readonly decimals: number,
  ) {}

  static async fromMoveCoin(coinType: string) {
    if (!isStringResource(coinType)) {
      throw new Error("invalid coinType: " + coinType);
    }
    const [addr, ,] = splitResourceComponents(coinType);
    const coinInfo = await Aptos.getAccountResource(addr, CoinType.coinResourceTag(coinType)) as any;
    return new CoinType(
      coinType,
      coinInfo.data.name,
      coinInfo.data.symbol,
      coinInfo.data.decimals,
    );
  }

  static coinResourceTag(coinType: string): string {
    return `${APTOS_FRAMEWORK_HS.toShortString()}::${MODULES.COIN}::${STRUCTS.COIN_INFO}<${coinType}>`;
  }
}
