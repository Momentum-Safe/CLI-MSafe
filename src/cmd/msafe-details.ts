// CLI for showing the details of momentum safe

import colors from "ansicolor";
import { HexString } from "aptos";
import { MSafeStatus } from "../momentum-safe/momentum-safe";
import {
  CmdOption,
  State,
  executeCmdOptions,
  getMSafeInfo,
  printMsafeDetails,
  printMyMessage,
  registerState,
  setState,
} from "./common";
export function registerMSafeDetails() {
  registerState(State.MSafeDetails, showMSafeDetails);
}

async function showMSafeDetails(c: { address: HexString }) {
  console.clear();
  await printMyMessage();
  const info = await getMSafeInfo(c.address);
  await printMsafeDetails(info);

  let pmpText: string;
  if (info.status === MSafeStatus.MIGRATED) {
    pmpText = colors.yellow("MSafe already migrated");
  } else if (info.pendingTxs.length != 0) {
    pmpText =
      "Pending transactions:\n\n\t\t| SN\t| Action\t\t\t| Confirmation\t|";
  } else {
    pmpText = "No pending transactions.";
  }
  const opts: CmdOption[] = [];

  if (info.status !== MSafeStatus.MIGRATED) {
    info.pendingTxs.forEach((tx, i) => {
      opts.push({
        shortage: i + 1,
        // TODO: Refactor this field.
        showText: `| ${tx.sn}\t| ${tx.txType}\t\t| ${tx.numSigs!} / ${
          info.threshold
        }`,
        handleFunc: () => {
          setState(State.PendingCoinTransfer, {
            address: c.address,
            txHash: tx.hash,
          });
        },
      });
    });
    opts.push(
      {
        shortage: "n",
        showText: "New transaction",
        handleFunc: () =>
          setState(State.InitCoinTransfer, { address: c.address }),
      },
      {
        shortage: "m",
        showText: "Migrate",
        handleFunc: () => setState(State.Migrate, { address: c.address }),
        visible: () => info.status === MSafeStatus.NORMAL,
      },
      {
        shortage: "r",
        showText: "Refresh",
        handleFunc: () => setState(State.MSafeDetails, { address: c.address }),
      }
    );
  }

  opts.push({
    shortage: "b",
    showText: "Back",
    handleFunc: () => setState(State.List),
  });
  await executeCmdOptions(pmpText, opts);
}
