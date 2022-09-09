import {MY_ACCOUNT} from "../web3/global";
import {Registry} from "../momentum-safe/registry";
import {printMyMessage} from "./common";
import {printSeparator, promptUntilString} from "./helper";
import {registerState, setState, State} from "./state";

export function registerList() {
  registerState(State.List, () => list());
}

async function list() {
  console.clear();
  await printMyMessage();

  const msafes = await Registry.getOwnedMomentumSafes(MY_ACCOUNT.address());

  let i = 1;

  if (msafes.pendings) {
    console.log("Pending creations");
    msafes.pendings.forEach( addr => {
      console.log(`\t${i})\t${addr}`);
      i = i + 1;
    });
    console.log();
  }

  if (msafes.msafes) {
    console.log("Existing msafe");
    console.log();
    msafes.msafes.forEach( addr => {
      console.log(`\t${i})\t${addr}`);
      i = i + 1;
    });
    console.log();
  }

  console.log("Operations");

  console.log(`\tb)\t back`);
  console.log(`\tr)\t refresh`);

  printSeparator();

  const selection = await promptUntilString("Input your selection\t",
    "Please input a valid selection\t",
    (s: string) => {
      if (s === 'b' || s === 'r') {
        return true;
      }
      return Number(s) >= 1 && Number(s) <= i-1;
    });

  if (selection === 'b') {
    setState(State.Entry);
  } else if (selection === 'r'){
    setState(State.List);
  } else {
    const selectID = Number(selection) - 1;
    if (selectID < msafes.pendings.length) {
      setState(State.PendingCreate, {address: msafes.pendings[selectID]});
    } else if (selectID < msafes.pendings.length + msafes.msafes.length) {
      // Replace here
    }
  }

}