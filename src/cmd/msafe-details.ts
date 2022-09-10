// CLI for showing the details of momentum safe

import {HexString} from "aptos";
import {printMyMessage, printSeparator, shortString, registerState, State} from "./common";
import {MomentumSafe} from "../momentum-safe/momentum-safe";

export function registerMSafeDetails() {
  registerState(State.MSafeDetails, showMSafeDetails);
}

async function showMSafeDetails(c: {address: HexString}) {
  console.clear();
  await printMyMessage();

  const addr = c.address;
  const msafe = await MomentumSafe.fromMomentumSafe(addr);
  const info = await msafe.getMomentumSafeInfo();
  console.log(`Momentum Safe Info:`);
  console.log();
  console.log(`\tAddress:\t\t${msafe.address}`);
  console.log(`\tSignature required:\t${msafe.threshold} / ${msafe.ownersPublicKeys.length}`);
  console.log(`\tOwner public keys:`);
  info.pubKeys.forEach( pk => {
    console.log(`\t\t${shortString(pk.hex())}`);
  });
  printSeparator();
  console.log(`Pending transactions:`);
  console.log();

  for (const i = 0; i < info.pendingTxs.length; i++) {
    console.log;
  }
}

