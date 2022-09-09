import {HexString} from "aptos";
import {printMyMessage, shortString} from "./common";
import {CreationHelper} from "../momentum-safe/creation";
import {MY_ACCOUNT} from "../web3/global";
import {printSeparator, promptUntilString} from "./helper";
import {registerState, setState, State} from "./state";
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
    console.log(`pk ${i}:\t${shortString(pk)}`);
  });
  const isMeSigned = collectedSigs.find( pk => pk.hex() === MY_ACCOUNT.publicKey().hex()) !== undefined;

  printSeparator();
  if (isMeSigned) {
    console.log("Previously already signed. Waiting for other confirmations.");
  } else {
    console.log("Waiting for my signature. Sign?");
  }

  // TODO: extract this pattern and make a function
  if (!isMeSigned) {
    console.log("\ts)\tsign");
  }
  console.log("\tr)\trefresh");
  console.log("\tb)\tback");

  const option = await promptUntilString(
    "",
    "",
    v => {
      if (v === 'b' || v === 'r') {return true}
      if (!isMeSigned && v === 's') { return true}
      return false;
    }
  );

  if (option === 'b') {
    setState(State.List);
    return;
  } else if (option === 'r') {
    setState(State.PendingCreate, {address: creation.address});
    return;
  }

  printSeparator();

  const isReadyExecute = await creation.isReadyToSubmit(MY_ACCOUNT.publicKey());
  let tx: Gen.PendingTransaction;
  if (isReadyExecute) {
    tx = await creation.assembleAndSubmitTx(MY_ACCOUNT);
  } else {
    tx = await creation.submitSignature(MY_ACCOUNT);
  }
  console.log(`Transaction ${shortString(tx.hash)} submitted. Waiting for confirmation`);
  console.log(`Transaction confirmed on chain.`);

  printSeparator();

  console.log("\tr)\trefresh");
  console.log("\tb)\tback");

  const option2 = await promptUntilString(
    "",
    "",
    v => {
      if (v === 'b' || v === 'r') {return true}
      return false;
    }
  );

  if (option2 === 'b') {
    setState(State.List);
  } else if (option2 === 'r') {
    setState(State.PendingCreate, {address: creation.address});
  }
}