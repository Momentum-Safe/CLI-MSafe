import {printMSafeMessage, printMyMessage, registerState, State} from "./common";
import {MomentumSafe} from "../momentum-safe/momentum-safe";
import {HexString} from "aptos";

function registerInitCoinTransfer() {
  registerState(State.InitCoinTransfer, initCoinTransfer);
}

async function initCoinTransfer(c: {address: HexString}) {
  console.clear();
  await printMyMessage();

  const addr = c.address;
  const msafe = await MomentumSafe.fromMomentumSafe(addr);
  const info = await msafe.getMomentumSafeInfo();
  await printMSafeMessage(addr, info);


}