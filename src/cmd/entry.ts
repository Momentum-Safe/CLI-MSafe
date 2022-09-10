import {promptUntilNumber, printMyMessage, executeCmdOptions, registerState, setState, State} from "./common";


export function registerEntry() {
  registerState(State.Entry, () => entry());
}

async function entry() {
  console.clear();
  await printMyMessage();

  await executeCmdOptions('Select a task?', [
    {shortage: 1, showText: 'View my MSafes', handleFunc: () => setState(State.List)},
    {shortage: 2, showText: 'Create a new MSafe', handleFunc: () => setState(State.Create)},
  ]);
}