import {promptUntilNumber} from "./helper";
import {registerState, setState, State} from "./state";
import {printMyMessage} from "./common";


export function registerEntry() {
  registerState(State.Entry, () => entry());
}

async function entry(c?: any) {
  console.clear();
  await printMyMessage();

  console.log("Select a task?");
  console.log("\t1. View my MSafes");
  console.log("\t2. Create a new MSafe");
  const option = await promptUntilNumber('', '', v => v >= 1 && v <= 2);
  switch (option) {
    case 1:
      // do list
      setState(State.List);
      break;
    case 2:
      // do create
      setState(State.Create);
  }
}