import {
  executeCmdOptions,
  printSeparator,
  promptForYN,
  promptUntilNumber,
  promptUntilString,
  isStringAddress,
} from "./common";
import {HexString} from "aptos";
import {MY_ACCOUNT} from "../web3/global";
import {CreationHelper} from "../momentum-safe/creation";
import * as Aptos from "../web3/global";
import {printMyMessage} from "./common";
import {registerState, setState, State} from "./common";
import {checkCreationEnoughSigsAndAssemble} from "./creation-details";

const MAX_OWNERS = 32;


export function registerCreation() {
  registerState(State.Create, () => initCreateMSafe());
}

async function initCreateMSafe() {
  console.clear();
  await printMyMessage();

  console.log("Creating a new MSafe wallet.");
  printSeparator();

  const numOwners = await promptUntilNumber(
    `What is the number of owners? (2-${MAX_OWNERS})\t\t\t`,
    `\tPlease input a valid number (2-${MAX_OWNERS}):\t`,
    (v: number) => v >= 2 && v <= MAX_OWNERS
  );

  // TODO: currently 1/x is not allowed. Extend the functionality later
  const threshold = await promptUntilNumber(
    `What is the confirmation threshold? (2-${numOwners})\t\t`,
    `\tPlease input a valid number (2-${numOwners}):\t`,
    (v: number) => v >= 2 && v <= numOwners
  );

  const initialBalance = await promptUntilNumber(
    "What's the amount of initial fund of MSafe? (>=2000)\t",
    "\tPlease input a valid number (>=2000)\t",
    v => v >= 2000,
  );

  const owners: HexString[] = [MY_ACCOUNT.address()];

  console.log(`\t1 th address (Self): \t${MY_ACCOUNT.address()}`);
  for (let i = 1; i < numOwners; i++) {
    const addr = await promptUntilString(
      `\t${i + 1} th address: \t\t`,
      `\tPlease provide a valid address\t\t`,
      isStringAddress,
    );
    owners.push(HexString.ensure(addr));
  }

  printSeparator();

  const creation = await CreationHelper.fromUserRequest(owners, threshold, BigInt(initialBalance));

  console.log(`Creating ${creation.threshold} / ${creation.ownerPubKeys.length} Momentum Safe wallet`);
  console.log(`\tAddress:\t${creation.address}`);
  console.log(`\tNonce:\t\t${creation.creationNonce}`);

  printSeparator();
  const userContinue = await promptForYN("Initiate wallet creation?", true);
  if (!userContinue) {
    setState(State.Entry);
  }

  console.log();
  const tx = await creation.initCreation(MY_ACCOUNT);
  console.log(`\tWallet creation transaction sent:\t${tx.hash}`);
  await Aptos.waitForTransaction(tx.hash);
  console.log(`\tTransaction confirmed, MomentumSafe creation initialized.`);

  printSeparator();

  // If there is already enough signatures collected, directly execute the
  // send transaction
  const userBreak = await checkCreationEnoughSigsAndAssemble(creation);
  if (userBreak) {
    await executeCmdOptions(
      "User breaks the signature submission",
      [{shortage: 'b', showText: 'Back', handleFunc: () => setState(State.List)}],
    );
  }

  await executeCmdOptions('Choose your next step', [
    {shortage: 'v', showText: 'View details', handleFunc: () =>
        setState(State.PendingCreate, {address: creation.address})},
    {shortage: 'b', showText: 'Back', handleFunc: () => setState(State.Entry)},
  ]);
}
