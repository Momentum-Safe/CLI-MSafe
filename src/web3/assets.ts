import * as Aptos from "./global";
import {HexString} from "aptos";
import {CoinType, getCoinType} from "./coinType";
import {BigNumber} from "bignumber.js";
import {fromDust} from "../utils/bignumber";


type ParsedAsset = {
  coinType: CoinType,
  frozen: boolean,
  rawValue: bigint,
  parsedValue: BigNumber,
}


export async function getAssetList(address: HexString): Promise<ParsedAsset[]> {
  const resources = await Aptos.client().getAccountResources(address);

  const assets: ParsedAsset[] = [];

  for (let i = 0; i != resources.length; i += 1) {
    const res = resources[i];
    const coinTypeStr = getCoinTypeFromCoinStore(res.type);
    if (!coinTypeStr) {
      continue;
    }
    const coinType = await getCoinType(coinTypeStr);
    const value = (res.data as any).coin.value;

    const parsedValue = fromDust(value, coinType.decimals);
    assets.push({
      coinType,
      frozen: (res.data as any).frozen,
      rawValue: value,
      parsedValue: parsedValue,
    });
  }
  return assets;
}

export function getCoinTypeFromCoinStore(coinStoreType: string) {
  const reg = /^0x1::coin::CoinStore<(\S+)>$/g;
  const match = reg.exec(coinStoreType);
  if (!match) {
    return "";
  }
  return match[1];
}