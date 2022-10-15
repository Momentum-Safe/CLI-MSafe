import {
  executeCmdOptions,
  printMSafeMessage,
  printMyMessage,
  printSeparator,
  printTxDetails,
  promptForYN,
  registerState,
  setState,
  State
} from "./common";
import {MomentumSafe} from "../momentum-safe/momentum-safe";
import * as Aptos from "../web3/global";
import {HexString} from "aptos";
import {makeMSafeRevertTx} from "../momentum-safe/msafe-txn";
import {MY_ACCOUNT} from "../web3/global";
import {checkTxnEnoughSigsAndAssemble} from "./tx-details";
import {isHexEqual} from "../utils/check";


export function registerRevertTransaction() {
  registerState(State.RevertTransaction, revertTransaction);
}

async function revertTransaction(c: {address: HexString, txHash: HexString}) {
  console.clear();
  await printMyMessage();

  const addr = c.address;
  const txHash = c.txHash;
  const msafe = await MomentumSafe.fromMomentumSafe(addr);
  const info = await msafe.getMomentumSafeInfo();
  const balance = await Aptos.getBalanceAPT(addr);
  await printMSafeMessage(addr, info, balance);

  const tx = info.pendingTxs.find( tx => isHexEqual(tx.hash, txHash));
  if (!tx) {
    await executeCmdOptions('Transaction is no longer valid. Is transaction already executed?', [
      {shortage: 'b', showText: 'Back', handleFunc: () => setState(State.MSafeDetails, {address: addr})}
    ]);
    return;
  }

  console.log("Transaction to be reverted:");
  console.log();
  await printTxDetails(tx);
  printSeparator();

  const userBreak = await checkTxnEnoughSigsAndAssemble(msafe, (txHash as HexString));
  if (userBreak) {
    await executeCmdOptions(
      "User break the signature submission",
      [{shortage: 'b', showText: 'Back', handleFunc: () => setState(State.MSafeDetails, {address: addr})}],
    );
    return;
  }

  const userConfirm = promptForYN("Are you sure your want to revert the transaction?", true);

  if (!userConfirm) {
    await executeCmdOptions("Choose your next step:", [
      {shortage: 'b', showText: 'Back', handleFunc: () => setState(State.MSafeDetails, {address: addr})},
    ]);
    return;
  }

  const revertTx = await makeMSafeRevertTx(msafe.address, msafe.rawPublicKey, {sn: tx.sn});
  const {plHash: revertHash, pendingTx: txRes} = await msafe.initTransaction(MY_ACCOUNT, revertTx);
  console.log(`\tTransaction ${txRes.hash} submitted. Waiting for confirmation`);
  await Aptos.waitForTransaction(txRes.hash);
  console.log(`\tTransaction confirmed on chain.`);

  await executeCmdOptions('Choose your next step', [
    {shortage: 'v', showText: "View details", handleFunc: () =>
      { setState(State.PendingCoinTransfer, {address: addr, txHash: (revertHash as HexString).hex()}) }},
    {shortage: 'b', showText: "Back", handleFunc: () => {setState(State.MSafeDetails, {address: addr})}}
  ]);
}