const STATE_MAP = new Map<State, (arg: any) => void>();

export enum State {
  Entry,
  Register,
  List,
  Create,
  MSafeDetails,
  PendingCreate,
  InitCoinTransfer,
  PendingCoinTransfer,
}

export function registerState(state: State, cb: (arg?: any) => void) {
  console.log('set');
  STATE_MAP.set(state, cb);
}

export function setState(state: State, arg?: any) {
  console.log(STATE_MAP);
  console.log(state);
  const cb = STATE_MAP.get(state);
  if (!cb) {
    throw new Error("undefined state");
  }
  cb(arg);
}


