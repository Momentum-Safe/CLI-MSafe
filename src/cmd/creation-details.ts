import {HexString} from "aptos";
import {CreationHelper} from "../momentum-safe/creation";
import {MY_ACCOUNT} from "../web3/global";
import {
  printSeparator,
  promptUntilString,
  registerState,
  setState,
  State,
  printMyMessage,
  shortString,
  CmdOption, executeCmdOptions
} from "./common";
import * as Gen from "aptos/src/generated";

interface creationDetailsArg {
  address: HexString,
}

export function registerCreationDetails() {
  registerState(State.PendingCreate, (a) => creationDetails(a));
}

async function creationDetails(rawArg: any) {
  const address = (rawArg as creationDetailsArg).address;

  console.clear();
  await printMyMessage();

  let creation: CreationHelper;
  try {
    creation = await CreationHelper.fromPendingCreation(address);
  } catch (e) {
    if (e instanceof Error && e.message.includes('cannot get creation data')) {
      console.log("Cannot get creation data. Is multi-sig already registered?");
      // TODO: Check with momentum safe and go to msafe detail page.
      printSeparator();
      console.log("\tb)\tback");
      await promptUntilString("", "", s => s === 'b');
      setState(State.List);
      return;
    } else {
      throw e;
    }
  }

  console.log(`Momentum Safe Address: ${creation.address.hex()}`);
  console.log();

  const collectedSigs = await creation.collectedSignatures();

  console.log(`Collected signatures from public keys: ${collectedSigs.length} / ${creation.threshold}`);
  collectedSigs.forEach( (pk, i) => {
    console.log(`pk ${i}:\t${pk}`);
  });
  const isMeSigned = collectedSigs.find( pk => pk.hex() === MY_ACCOUNT.publicKey().hex()) !== undefined;

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
  opts.push(
    {shortage: 'r', showText: 'Refresh', handleFunc: () =>
        setState(State.PendingCreate, {address: creation.address})},
    {shortage: 'b', showText: 'Back', handleFunc: () =>
        setState(State.List)}
    );

  await executeCmdOptions(optionPromptStr, opts);
  if (isReturn) {return}

  console.log();

  const isReadyExecute = await creation.isReadyToSubmit(MY_ACCOUNT.publicKey());
  let tx: Gen.PendingTransaction;
  if (isReadyExecute) {
    tx = await creation.assembleAndSubmitTx(MY_ACCOUNT);
  } else {
    tx = await creation.submitSignature(MY_ACCOUNT);
  }
  console.log(`\tTransaction ${tx.hash} submitted. Waiting for confirmation`);
  console.log(`\tTransaction confirmed on chain.`);

  printSeparator();

  await executeCmdOptions(
    'Choose your next step',
    [
      {shortage: 'r', showText: 'Refresh', handleFunc: () =>
        setState(State.PendingCreate, {address: creation.address})},
      {shortage: 'b', showText: 'Back', handleFunc: () =>
        setState(State.List)},
    ]
  );
}