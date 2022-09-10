// CLI for showing the details of momentum safe

import {HexString} from "aptos";
import {
  printMyMessage,
  printSeparator,
  shortString,
  registerState,
  State,
  executeCmdOptions,
  CmdOption, setState, printMSafeMessage
} from "./common";
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
  await printMSafeMessage(addr, info);

  let pmpText = '';
  if (info.pendingTxs.length != 0) {
    pmpText = 'Pending transactions:\n\n\t\t| SN\t| Action\t\t| Confirmation\t|';
  } else {
    pmpText = 'No pending transactions.';
  }
  const opts: CmdOption[] = [];
  info.pendingTxs.forEach( (tx, i) => {
    opts.push({
      shortage: i + 1,
      showText: `| ${tx.sn}\t| Transfer<${tx.operation!.coin}>(${shortString(tx.operation!.to)}, ${tx.operation!.amount})`,
      handleFunc: () => { /* TODO: add here */ },
    });
  });
  opts.push(
    {shortage: 'r', showText: 'Refresh', handleFunc: () =>
        setState(State.MSafeDetails, {address: c.address})},
    {shortage: 'b', showText: 'Back', handleFunc: () =>
        setState(State.List)},
    );
  await executeCmdOptions(pmpText, opts);
}


