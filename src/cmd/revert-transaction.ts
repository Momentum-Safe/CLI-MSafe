import { HexString } from "aptos";
import { MomentumSafe } from "../momentum-safe/momentum-safe";
import { makeMSafeRevertTx } from "../momentum-safe/msafe-txn";
import { isHexEqual } from "../utils/check";
import * as Aptos from "../web3/global";
import { MY_ACCOUNT } from "../web3/global";
import {
  executeCmdOptions,
  getMSafeInfo,
  printMsafeDetails,
  printMyMessage,
  printSeparator,
  printTxDetails,
  promptForYN,
  registerState,
  setState,
  State,
} from "./common";
import { checkTxnEnoughSigsAndAssemble } from "./tx-details";

export function registerRevertTransaction() {
  registerState(State.RevertTransaction, revertTransaction);
}

async function revertTransaction(c: { address: HexString; txHash: HexString }) {
  console.clear();
  await printMyMessage();
  const msafe = await MomentumSafe.fromMomentumSafe(c.address);
  const info = await getMSafeInfo(c.address);
  await printMsafeDetails(info);

  const tx = info.pendingTxs.find((tx) => isHexEqual(tx.hash, c.txHash));
  if (!tx) {
    await executeCmdOptions(
      "Transaction is no longer valid. Is transaction already executed?",
      [
        {
          shortage: "b",
          showText: "Back",
          handleFunc: () =>
            setState(State.MSafeDetails, { address: c.address }),
        },
      ]
    );
    return;
  }

  console.log("Transaction to be reverted:");
  console.log();
  await printTxDetails(tx);
  printSeparator();

  const userBreak = await checkTxnEnoughSigsAndAssemble(
    msafe,
    c.txHash as HexString
  );
  if (userBreak) {
    await executeCmdOptions("User break the signature submission", [
      {
        shortage: "b",
        showText: "Back",
        handleFunc: () => setState(State.MSafeDetails, { address: c.address }),
      },
    ]);
    return;
  }

  const userConfirm = promptForYN(
    "Are you sure your want to revert the transaction?",
    true
  );

  if (!userConfirm) {
    await executeCmdOptions("Choose your next step:", [
      {
        shortage: "b",
        showText: "Back",
        handleFunc: () => setState(State.MSafeDetails, { address: c.address }),
      },
    ]);
    return;
  }
  const opt = {
    estimateGasPrice: true,
    estimateMaxGas: true,
  };
  const revertTx = await makeMSafeRevertTx(msafe, { sn: tx.sn }, opt);
  const { plHash: revertHash, pendingTx: txRes } = await msafe.initTransaction(
    MY_ACCOUNT,
    revertTx,
    {
      estimateGasPrice: true,
      estimateMaxGas: true,
    }
  );
  console.log(
    `\tTransaction ${txRes.hash} submitted. Waiting for confirmation`
  );
  await Aptos.waitForTransaction(txRes.hash);
  console.log(`\tTransaction confirmed on chain.`);

  await executeCmdOptions("Choose your next step", [
    {
      shortage: "v",
      showText: "View details",
      handleFunc: () => {
        setState(State.PendingCoinTransfer, {
          address: c.address,
          txHash: (revertHash as HexString).hex(),
        });
      },
    },
    {
      shortage: "b",
      showText: "Back",
      handleFunc: () => {
        setState(State.MSafeDetails, { address: c.address });
      },
    },
  ]);
}
