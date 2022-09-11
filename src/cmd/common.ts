import readline from "readline-sync";
import clear from 'clear';
import * as Aptos from "../web3/global";
import {HexString, TxnBuilderTypes} from "aptos";
import {MomentumSafeInfo} from "../momentum-safe/momentum-safe";

const SEPARATOR_LENGTH = 20;

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

export async function prompt(s: string): Promise<string> {
  return new Promise((resolve) => {
    return resolve(readline.question(s));
  });
}

export async function promptUntilNumber(pmp: string, npmp: string, validate: (v: number) => boolean): Promise<number> {
  let res = await promptForNumber(pmp);
  while (!validate(res)) {
    res = await promptForNumber(npmp);
  }
  return res;
}

export async function promptForNumber(s: string): Promise<number> {
  const valStr = await prompt(s);
  if (valStr.length == 0) {
    return -1;
  }
  return Number(valStr);
}

export async function promptUntilString(pmp: string, npmp: string, validate: (s: string) => boolean): Promise<string> {
  let res = await prompt(pmp);
  while (!validate(res)) {
    res = await prompt(npmp);
  }
  return res;
}

export async function promptForYN(s: string, defVal: boolean): Promise<boolean> {
  const clause = ynClause(defVal);
  let res = await prompt(`${s} ${clause}\t`);
  while (!validateYN(res)) {
    res = await prompt(`${s} ${clause}\t`);
  }
  return getValueYN(res, defVal);
}

function ynClause(defVal: boolean): string {
  if (defVal) {
    return `[Y/n]`;
  } else {
    return `[y/N]`;
  }
}

function validateYN(s: string): boolean {
  const sl = s.toLowerCase();
  return sl === '' || sl === 'y' || sl === 'n' || sl === 'yes' || sl === 'no';
}

function getValueYN(s: string, defVal: boolean): boolean {
  switch (s.toLowerCase()) {
    case 'y':
    case 'yes':
      return true;
    case 'n':
    case 'no':
      return false;
    case '':
      return defVal;
  }
  return false;
}

export async function step(index: number, name: string, f: () => Promise<void>) {
  clear();
  console.log('='.repeat(process.stdout.columns));
  console.log(`Step ${index} - ${name}`);
  console.log('-'.repeat(process.stdout.columns));
  await prompt('');
  await f();
  console.log('');
  console.log('='.repeat(process.stdout.columns));
  await prompt('next...');
}

export function printSeparator() {
  console.log();
  console.log("-".repeat(SEPARATOR_LENGTH));
  console.log();
}

export async function printMyMessage() {
  console.log('='.repeat(process.stdout.columns));
  console.log("My Aptos account");
  console.log();
  console.log(`My Address: \t${Aptos.MY_ACCOUNT.address()}`);
  console.log(`My PubKey: \t${Aptos.MY_ACCOUNT.publicKey()}`);
  console.log(`My Balance: \t${await Aptos.getBalance(Aptos.MY_ACCOUNT.address())}`);
  console.log("-".repeat(process.stdout.columns));
  console.log();
}

export function printMSafeMessage(address: HexString, info: MomentumSafeInfo, balance: number) {
  console.log(`Momentum Safe Info:`);
  console.log();
  console.log(`Address:\t\t${address}`);
  console.log(`Threshold:\t\t${info.threshold}`);
  console.log(`Owners:\t\t\t${info.pubKeys.length}`);
  info.pubKeys.forEach( (pk, i) => {
    console.log(`\t\t\t(${i+1}/${info.pubKeys.length}) ${pk.hex()}`);
  });
  console.log(`Balance:\t\t${balance}`);
  console.log("-".repeat(process.stdout.columns));
  console.log();
}

export function shortString(val: HexString | string) {
  if (typeof val === 'string' && val.length < 15) {
    return val;
  } else if (val instanceof HexString && val.toShortString().length < 15) {
    return val.hex();
  }
  const s = typeof val === 'string'? val: val.hex();
  return `${s.substring(0, 8)}...${s.substring(s.length-5)}`;
}

export interface CmdOption {
  shortage: number | string;
  showText: string;
  handleFunc: () => void;
}

export async function executeCmdOptions(pmp: string, options: CmdOption[]) {
  const coh = new CmdOptionHelper(pmp, options);
  await coh.execute();
}

class CmdOptionHelper {

  pmp: string;
  m: Map<number|string, CmdOption>;
  options: CmdOption[];

  constructor(pmp: string, options: CmdOption[]) {
    this.options = options;
    this.pmp = pmp;
    this.m = new Map();
    options.forEach( opt => {
      if (this.m.has(opt.shortage)) {
        throw new Error("duplicate option");
      }
      this.m.set(opt.shortage, opt);
    });
  }

  async execute() {
    this.printOptions();
    const opt = await this.prompt();
    opt.handleFunc();
  }

  private printOptions() {
    console.log(this.pmp);
    console.log();
    this.options.forEach( opt => {
      console.log(`\t${opt.shortage})\t${opt.showText}`);
    });
    console.log();
  }

  private async prompt(): Promise<CmdOption> {
    let res: CmdOption;
    await promptUntilString(
      'Please input your option:\t',
      'Please input a valid option:\t',
      s => {
        if (this.m.has(s)){
          res = this.m.get(s)!;
          return true;
        } else if (this.m.has(Number(s))) {
          res = this.m.get(Number(s))!;
          return true;
        }
        return false;
      }
    );
    return res!;
  }
}


export function isStringPublicKey(s: string): boolean {
  let byteLength;
  try {
    byteLength = HexString.ensure(s).toUint8Array().length;
  } catch (e) {
    return false;
  }
  return byteLength == TxnBuilderTypes.Ed25519PublicKey.LENGTH;
}

export function isStringAddress(s: string): boolean {
  const byteLength = HexString.ensure(s).toUint8Array().length;
  return byteLength == 32; // SHA3_256 length
}

