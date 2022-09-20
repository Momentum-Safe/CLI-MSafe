import {HexString} from "aptos";
import {
  CmdOption,
  executeCmdOptions,
  printMyMessage,
  printSeparator,
  printTxDetails,
  promptForYN,
  registerState,
  setState,
  State
} from "./common";
import {MomentumSafe, TransactionType} from "../momentum-safe/momentum-safe";
import * as Aptos from "../web3/global";
import {MY_ACCOUNT} from "../web3/global";
import * as Gen from 'aptos/src/generated';
import {MSafeTxnInfo, MSafeTxnType} from "../momentum-safe/msafe-txn";

export function registerTxDetails() {
  registerState(State.PendingCoinTransfer, txDetails);
}

async function txDetails(c: {address: HexString, txHash: string}) {
  const addr = c.address;
  const txHash = c.txHash;

  console.clear();
  await printMyMessage();

  const msafe = await MomentumSafe.fromMomentumSafe(addr);

  // TODO: better name and better encapsulation
  let txType: TransactionType;
  let txData: MSafeTxnInfo;
  try {
    [txType, txData] = await msafe.getTxDetails(txHash);
  } catch (e) {
    if (e instanceof Error && e.message.includes("Transaction is no longer valid")) {
      await executeCmdOptions(e.message + 'Is transaction already executed?', [
        {shortage: 'b', showText: 'Back', handleFunc: () => setState(State.MSafeDetails, {address: addr})}
      ]);
      return;
    }
    throw e;
  }

  console.log("Transaction details:");
  console.log();
  printTxDetails(txData);
  printSeparator();

  const userBreak = await checkTxnEnoughSigsAndAssemble(msafe, txHash);
  if (userBreak) {
    await executeCmdOptions(
      "User break the signature submission",
      [{shortage: 'b', showText: 'Back', handleFunc: () => setState(State.MSafeDetails, {address: addr})}],
    );
  }

  const collectedSigs = txType.signatures.data;
  console.log(`Collected signatures from public keys: ${collectedSigs.length} / ${msafe.threshold}`);
  collectedSigs.forEach ( (pk, i) => {
    console.log(`\tpk ${i}:\t${HexString.ensure(pk.key)}`);
  });
  const isMeSigned = collectedSigs.find( e => e.key === MY_ACCOUNT.publicKey().hex()) != undefined;

  // TODO: Extract and refactor
  printSeparator();
  let optionPromptStr: string;
  if (isMeSigned) {
    optionPromptStr = 'Already signed. Waiting for other confirmations.';
  } else {
    optionPromptStr = 'Waiting for my signature. Sign?';
  }
  let isReturn = true;
  const opts: CmdOption[] = [];
  if (!isMeSigned) {
    opts.push({shortage: 's', showText: 'Sign', handleFunc: () => { isReturn = false }});
  }
  if (txData.txType !== MSafeTxnType.Revert) {
    opts.push({
      shortage: 'rv',
      showText: 'ReVert',
      handleFunc: () => setState(State.RevertTransaction, {address: addr, txHash: txHash})
    });
  }

  opts.push(
    {shortage: 'r', showText: 'Refresh', handleFunc: () =>
        setState(State.PendingCoinTransfer, {address: addr, txHash: txHash})},
    {shortage: 'b', showText: 'Back', handleFunc: () =>
        setState(State.MSafeDetails, {address: addr})},
  );

  await executeCmdOptions(optionPromptStr, opts);
  if (isReturn) {return}

  console.log();

  const isReadyExecute = await msafe.isReadyToSubmit(txHash, MY_ACCOUNT.publicKey());
  let tx: Gen.PendingTransaction;
  if (isReadyExecute) {
    tx = await msafe.assembleAndSubmitTx(MY_ACCOUNT, txHash);
  } else {
    tx = await msafe.submitTxSignature(MY_ACCOUNT, txHash);
  }
  console.log(`\tTransaction ${tx.hash} submitted. Waiting for confirmation`);
  await Aptos.waitForTransaction(tx.hash);
  console.log(`\tTransaction confirmed on chain.`);

  printSeparator();

  await executeCmdOptions(
    'Choose your next step',
    [
      {shortage: 'r', showText: 'Refresh', handleFunc: () =>
        setState(State.PendingCoinTransfer, {address: addr, txHash: txHash})},
      {shortage: 'b', showText: 'Back', handleFunc: () =>
        setState(State.MSafeDetails, {address: addr})},
    ]
  );
}

export async function checkTxnEnoughSigsAndAssemble(msafe: MomentumSafe, txHash: string | HexString) {
  const hasEnoughSigs = await msafe.isReadyToSubmit(txHash);
  if (!hasEnoughSigs) {
    return false;
  }
  const opt = await promptForYN("Already collected enough signature. Submit?", true);
  if (!opt) {
    return true;
  }
  const tx = await msafe.assembleAndSubmitTx(MY_ACCOUNT, txHash);
  console.log(`\tTransaction ${tx.hash} submitted. Waiting for confirmation`);
  await Aptos.waitForTransaction(tx.hash);
  console.log(`\tTransaction confirmed on chain.`);

  printSeparator();
  return false;
}

