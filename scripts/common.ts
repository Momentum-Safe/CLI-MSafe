import {HexString} from "aptos";
import {MomentumSafe} from "../src/momentum-safe/momentum-safe";
import {isHexEqual} from "../src/utils/check";
import {MY_ACCOUNT} from "../src/web3/global";


export async function loadMomentumSafe(msafeAddr: HexString) {
  const msafe = await MomentumSafe.fromMomentumSafe(msafeAddr);
  if (!msafe.owners.find(owner => isHexEqual(owner, MY_ACCOUNT.address()))) {
    throw Error("My address is not the owner of the momentum safe");
  }
  return msafe;
}
