import {
  executeCmdOptions,
  isStringAddress,
  printMSafeMessage,
  printMyMessage, printSeparator, promptForYN,
  promptUntilNumber,
  promptUntilString,
  registerState, setState,
  State,
} from "./common";
import {MomentumSafe} from "../momentum-safe/momentum-safe";
import {HexString} from "aptos";
import * as Aptos from '../web3/global';
import {MY_ACCOUNT} from "../web3/global";

export function registerInitCoinTransfer() {
  registerState(State.InitCoinTransfer, initCoinTransfer);
}

async function initCoinTransfer(c: {address: HexString}) {
  console.clear();
  await printMyMessage();

  const addr = c.address;
  const msafe = await MomentumSafe.fromMomentumSafe(addr);
  const info = await msafe.getMomentumSafeInfo();
  const balance = await Aptos.getBalance(addr);
  await printMSafeMessage(addr, info, balance);

  console.log("Init coin transfer (APT)");

  console.log();
  const toAddressStr = await promptUntilString(
    '\tTo address:\t',
    '\tAddress not valid:\t',
    isStringAddress,
  );
  const toAddress = HexString.ensure(toAddressStr);

  const amountStr = await promptUntilNumber(
    '\tAmount:\t\t',
    "\tAmount not valid:\t",
    val => Number(val) > 0, // TODO: test number
  );
  const amount = Number(amountStr);

  printSeparator();

  // Print confirmation
  console.log("Transaction confirmation:");
  console.log();
  console.log("\tAction:\t\tCoin Transfer");
  console.log("\tCoin Type:\t0x1::aptos_coin::AptosCoin");
  console.log(`\tTo address:\t${toAddress}`);
  console.log(`\tAmount:\t\t${amount}`);
  printSeparator();

  const userConfirmed = await promptForYN("Transaction information correct?", true);
  if (!userConfirmed) {
    setState(State.MSafeDetails, {address: addr});
    return;
  }

  // Submit transaction
  const res = await msafe.initCoinTransfer(MY_ACCOUNT, toAddress, BigInt(amount));
  console.log();
  console.log(`\tTransaction ${res.hash} submitted to blockchain`);
  await Aptos.waitForTransaction(res.hash);
  console.log(`\tTransaction confirmed on chain.`);

  printSeparator();

  await executeCmdOptions('Choose your next step', [
    {shortage: 'v', showText: "View details", handleFunc: () => { /* TODO: add state here */ }},
    {shortage: 'b', showText: "Back", handleFunc: () => {setState(State.MSafeDetails, {address: addr})}}
    ]);
}