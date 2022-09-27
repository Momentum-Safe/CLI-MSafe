// CLI for showing the details of momentum safe

import {HexString} from "aptos";
import {
  printMyMessage,
  registerState,
  executeCmdOptions,
  State,
  setState,
  printMSafeMessage,
  CmdOption,
} from "./common";
import * as Aptos from '../web3/global';
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
  const balance = await Aptos.getBalance(addr);
  await printMSafeMessage(addr, info, balance);

  let pmpText: string;
  if (info.pendingTxs.length != 0) {
    pmpText = 'Pending transactions:\n\n\t\t| SN\t| Action\t\t\t| Confirmation\t|';
  } else {
    pmpText = 'No pending transactions.';
  }
  const opts: CmdOption[] = [];
  info.pendingTxs.forEach( (tx, i) => {
    opts.push({
      shortage: i + 1,
      // TODO: Refactor this field.
      showText: `| ${tx.sn}\t| ${tx.txType}\t\t| ${tx.numSigs!} / ${info.threshold}`,
      handleFunc: () => { setState(State.PendingCoinTransfer, {address: addr, txHash: tx.hash}) },
    });
  });
  opts.push(
    {shortage: 'n', showText: 'New transaction', handleFunc: () =>
        setState(State.InitCoinTransfer, {address: c.address})},
    {shortage: 'r', showText: 'Refresh', handleFunc: () =>
        setState(State.MSafeDetails, {address: c.address})},
    {shortage: 'b', showText: 'Back', handleFunc: () =>
        setState(State.List)},
    );
  await executeCmdOptions(pmpText, opts);
}


