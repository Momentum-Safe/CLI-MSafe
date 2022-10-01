import {
  executeCmdOptions,
  printSeparator,
  promptForYN, promptUntilBigNumber,
  promptUntilNumber,
  promptUntilString,

} from "./common";
import {HexString} from "aptos";
import {APT_COIN_INFO, MY_ACCOUNT} from "../web3/global";
import {CreationHelper} from "../momentum-safe/creation";
import * as Aptos from "../web3/global";
import {printMyMessage} from "./common";
import {registerState, setState, State} from "./common";
import {checkCreationEnoughSigsAndAssemble} from "./creation-details";
import {isStringAddress} from "../utils/check";
import {BigNumber} from "bignumber.js";
import {toDust} from "../utils/bignumber";

const MAX_OWNERS = 32;
const MIN_OWNERS = 2;
const MIN_CONFIRMATION = 1;
const MIN_INITIAL_FUND = BigNumber(0.001);


export function registerCreation() {
  registerState(State.Create, () => initCreateMSafe());
}

async function initCreateMSafe() {
  console.clear();
  await printMyMessage();

  console.log("Creating a new MSafe wallet.");
  printSeparator();

  const numOwners = await promptUntilNumber(
    `What is the number of owners? (${MIN_OWNERS}-${MAX_OWNERS})\t\t\t`,
    `\tPlease input a valid number (${MIN_OWNERS}-${MAX_OWNERS}):\t`,
    (v: number) => v >= MIN_OWNERS && v <= MAX_OWNERS
  );

  // TODO: currently 1/x is not allowed. Extend the functionality later
  const threshold = await promptUntilNumber(
    `What is the confirmation threshold? (${MIN_CONFIRMATION}-${numOwners})\t\t`,
    `\tPlease input a valid number (${MIN_CONFIRMATION}-${numOwners}):\t`,
    (v: number) => v >= MIN_CONFIRMATION && v <= numOwners
  );

  const initialBalanceBN = await promptUntilBigNumber(
    `What's the amount of initial fund of MSafe (Used for gas)? (>=${MIN_INITIAL_FUND} APT)\n\t\t\t\t\t\t\t`,
    `\tPlease input a valid number (>=${MIN_INITIAL_FUND})\t`,
    v => v >= MIN_INITIAL_FUND,
  );
  const initialBalance = toDust(initialBalanceBN, APT_COIN_INFO.decimals);

  const owners: HexString[] = [MY_ACCOUNT.address()];

  console.log(`\t1 th address (Self): \t${MY_ACCOUNT.address()}`);
  for (let i = 1; i < numOwners; i++) {
    const addr = await promptUntilString(
      `\t${i + 1} th address: \t`,
      `\tPlease provide a valid address\t`,
      isStringAddress,
    );
    owners.push(HexString.ensure(addr));
  }

  printSeparator();

  const creation = await CreationHelper.fromUserRequest(owners, threshold, initialBalance);

  console.log(`Creating ${creation.threshold} / ${creation.ownerPubKeys.length} Momentum Safe wallet`);
  console.log(`\tAddress:\t${creation.address}`);
  console.log(`\tNonce:\t\t${creation.creationNonce}`);

  printSeparator();
  const userContinue = await promptForYN("Initiate wallet creation?", true);
  if (!userContinue) {
    setState(State.List);
    return;
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
    return;
  }

  await executeCmdOptions('Choose your next step', [
    {shortage: 'v', showText: 'View details', handleFunc: () =>
        setState(State.PendingCreate, {address: creation.address})},
    {shortage: 'b', showText: 'Back', handleFunc: () => setState(State.List)},
  ]);
}
