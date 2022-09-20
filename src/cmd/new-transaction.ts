import {
  executeCmdOptions,
  isStringAddress,
  isStringTypeStruct,
  printMSafeMessage,
  printMyMessage,
  printSeparator, printTxDetails,
  promptForYN,
  promptUntilNumber,
  promptUntilString,
  registerState,
  setState,
  State,
} from "./common";
import {MomentumSafe} from "../momentum-safe/momentum-safe";
import {HexString} from "aptos";
import * as Aptos from '../web3/global';
import {MY_ACCOUNT} from '../web3/global';
import {checkTxnEnoughSigsAndAssemble} from "./tx-details";
import {
  APTTransferArgs,
  CoinRegisterArgs,
  CoinTransferArgs,
  FunArgs, makeMSafeAnyCoinRegisterTx, makeMSafeAnyCoinTransferTx,
  makeMSafeAPTTransferTx,
  MSafeTransaction, MSafeTxnInfo,
  MSafeTxnType, RevertArgs
} from "../momentum-safe/msafe-txn";

export function registerInitCoinTransfer() {
  registerState(State.InitCoinTransfer, newTransaction);
}

async function newTransaction(c: {address: HexString}) {
  console.clear();
  await printMyMessage();

  const addr = c.address;
  const msafe = await MomentumSafe.fromMomentumSafe(addr);
  const info = await msafe.getMomentumSafeInfo();
  const balance = await Aptos.getBalance(addr);
  await printMSafeMessage(addr, info, balance);

  const sn = await msafe.getNextSN();
  const tx = await promptForNewTransaction(msafe.address, sn);
  printSeparator();

  printTxConfirmation(tx.getTxnInfo());
  printSeparator();

  const userConfirmed = await promptForYN("Transaction information correct?", true);
  if (!userConfirmed) {
    setState(State.MSafeDetails, {address: addr});
    return;
  }

  // Submit transaction
  const {plHash: txHash, pendingTx: res} = await msafe.initTransaction(MY_ACCOUNT, tx);
  const myHash = (res as any).hash;
  console.log();
  console.log(`\tTransaction ${myHash} submitted to blockchain`);
  await Aptos.waitForTransaction(myHash);
  console.log(`\tTransaction confirmed on chain.`);

  printSeparator();

  const userBreak = await checkTxnEnoughSigsAndAssemble(msafe, (txHash as HexString));
  if (userBreak) {
    await executeCmdOptions(
      "User break the signature submission",
      [{shortage: 'b', showText: 'Back', handleFunc: () => setState(State.MSafeDetails, {address: addr})}],
    );
  }
  await executeCmdOptions('Choose your next step', [
    {shortage: 'v', showText: "View details", handleFunc: () =>
      { setState(State.PendingCoinTransfer, {address: addr, txHash: (txHash as HexString).hex()}) }},
    {shortage: 'b', showText: "Back", handleFunc: () => {setState(State.MSafeDetails, {address: addr})}}
    ]);
}

async function promptForNewTransaction(sender: HexString, sn: number): Promise<MSafeTransaction> {
  let txType = MSafeTxnType.Unknown;
  await executeCmdOptions(
    "Please choose your transaction type",
    [
      {shortage: 1, showText: MSafeTxnType.APTCoinTransfer, handleFunc: () => txType = MSafeTxnType.APTCoinTransfer},
      {shortage: 2, showText: MSafeTxnType.AnyCoinTransfer, handleFunc: () => txType = MSafeTxnType.AnyCoinTransfer},
      {shortage: 3, showText: MSafeTxnType.AnyCoinRegister, handleFunc: () => txType = MSafeTxnType.AnyCoinRegister},
    ]
  );

  printSeparator();

  console.log(`Start ${txType}`);
  console.log();

  return await promptAndBuildTx(sender, txType, sn);
}

async function promptAndBuildTx(sender: HexString, txType: MSafeTxnType, sn: number): Promise<MSafeTransaction> {
  switch (txType) {
    case MSafeTxnType.APTCoinTransfer:
      return await promptAndBuildAPTCoinTransfer(sender, sn);
    case MSafeTxnType.AnyCoinTransfer:
      return await promptAndBuildAnyCoinTransfer(sender, sn);
    case MSafeTxnType.AnyCoinRegister:
      return await promptAndBuildForAnyCoinRegister(sender, sn);
    default:
      throw new Error("Invalid type");
  }
}

async function promptAndBuildAPTCoinTransfer(sender: HexString, sn: number): Promise<MSafeTransaction> {
  const toAddressStr = await promptUntilString(
    '\tTo address:\t',
    '\tAddress not valid:\t',
    isStringAddress,
  );
  const toAddress = HexString.ensure(toAddressStr);

  const amountStr = await promptUntilNumber(
    '\tAmount:\t\t',
    "\tAmount not valid:\t",
    val => Number(val) > 0,
  );
  const amount = Number(amountStr);
  const txArgs: APTTransferArgs = {to: toAddress, amount: amount};
  return await makeMSafeAPTTransferTx(sender, txArgs, {sequenceNumber: sn});
}

async function promptAndBuildAnyCoinTransfer(sender: HexString, sn: number): Promise<MSafeTransaction> {
  const coinType = await promptUntilString(
    '\tCoin type:\t',
    '\tCoin type not valid:\t',
    isStringTypeStruct,
  );

  const toAddressStr = await promptUntilString(
    '\tTo address:\t',
    '\tAddress not valid:\t',
    isStringAddress,
  );
  const toAddress = HexString.ensure(toAddressStr);

  const amountStr = await promptUntilNumber(
    '\tAmount:\t\t',
    "\tAmount not valid:\t",
    val => Number(val) > 0,
  );
  const amount = Number(amountStr);
  const txArgs: CoinTransferArgs = {
    coinType: coinType,
    to: toAddress,
    amount: amount,
  };
  return await makeMSafeAnyCoinTransferTx(sender, txArgs, {sequenceNumber: sn});
}

async function promptAndBuildForAnyCoinRegister(sender: HexString, sn: number): Promise<MSafeTransaction> {
  const coinType = await promptUntilString(
    '\tCoin type:\t',
    '\tCoin type not valid:\t',
    isStringTypeStruct,
  );
  const txArgs: CoinRegisterArgs = {coinType: coinType};
  return await makeMSafeAnyCoinRegisterTx(sender, txArgs, {sequenceNumber: sn});
}

function printTxConfirmation(txData: MSafeTxnInfo) {
  console.log("Transaction confirmation:");
  console.log();
  printTxDetails(txData);
}