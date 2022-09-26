import readline from "readline-sync";
import * as Aptos from "../web3/global";
import {HexString} from "aptos";
import {MomentumSafeInfo} from "../momentum-safe/momentum-safe";
import {
  APTTransferArgs,
  CoinRegisterArgs,
  CoinTransferArgs,
  CustomInteractionArgs,
  decodeCustomArgs,
  ModulePublishInfo,
  MSafeTxnInfo,
  MSafeTxnType,
  RevertArgs,
} from "../momentum-safe/msafe-txn";

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
  RevertTransaction,
}

export function registerState(state: State, cb: (arg?: any) => void) {
  STATE_MAP.set(state, cb);
}

export function setState(state: State, arg?: any) {
  const cb = STATE_MAP.get(state);
  if (!cb) {
    throw new Error("undefined state");
  }
  cb(arg);
}

export async function prompt(s: string): Promise<string> {
  return new Promise((resolve) => {
    return resolve(readline.question(s+'\t'));
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

export async function promptUntilBigInt(pmp: string, npmp: string, validate: (v: bigint) => boolean): Promise<bigint> {
  let res = await promptForBigInt(pmp);
  while (!validate(res)) {
    res = await promptForBigInt(npmp);
  }
  return res;
}

export async function promptForBigInt(s: string): Promise<bigint> {
  const valStr = await prompt(s);
  if (valStr.length == 0) {
    return -1n;
  }
  return BigInt(valStr);
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

export async function promptUntilTrueFalse(s: string) {
  let res = await prompt(s + 'true/false:\t');
  let resLower = res.toLowerCase();
  const validate = (val: string) => val === 'true' || val === 'false' || val === 't' || val === 'f';
  while (!validate(resLower)) {
    res = await prompt(s);
    resLower = res.toLowerCase();
  }
  return resLower === 'true' || resLower === 't';
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
  console.log(`Address:\t${address}`);
  console.log(`Threshold:\t${info.threshold}`);
  console.log(`Owners:\t\t${info.owners.length}`);
  info.owners.forEach( (owner, i) => {
    console.log(`\t\t(${i+1}/${info.owners.length}) ${owner}`);
  });
  console.log(`Balance:\t${balance}`);
  console.log("-".repeat(process.stdout.columns));
  console.log();
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

export async function printTxDetails(txData: MSafeTxnInfo) {
  switch (txData.txType) {
    case (MSafeTxnType.APTCoinTransfer):
      printAPTCoinTransfer(txData);
      break;
    case (MSafeTxnType.AnyCoinTransfer):
      printAnyCoinTransfer(txData);
      break;
    case (MSafeTxnType.AnyCoinRegister):
      printAnyCoinRegister(txData);
      break;
    case (MSafeTxnType.Revert):
      printRevertTxn(txData);
      break;
    case (MSafeTxnType.CustomInteraction):
      await printCustomTxn(txData);
      break;
    case (MSafeTxnType.ModulePublish):
      printModulePublishTxn(txData);
      break;
  }
  printTxCommonData(txData);
}

function printTxCommonData(txInfo: MSafeTxnInfo) {
  console.log(`Sender:\t\t\t${txInfo.sender}`);
  console.log(`Sequence Number:\t${txInfo.sn}`);
  console.log(`Expiration:\t\t${txInfo.expiration}`);
  console.log(`Gas Price:\t\t${txInfo.gasPrice}`);
  console.log(`Max Gas:\t\t${txInfo.maxGas}`);
}

function printAPTCoinTransfer(txInfo: MSafeTxnInfo) {
  console.log(`Action:\t\t\t${txInfo.txType}`);
  const args = txInfo.args as APTTransferArgs;
  console.log(`To:\t\t\t${args.to}`);
  console.log(`Amount:\t\t\t${args.amount}`);
}

function printAnyCoinTransfer(txInfo: MSafeTxnInfo) {
  console.log(`Action:\t\t\t${txInfo.txType}`);
  const args = txInfo.args as CoinTransferArgs;
  console.log(`Coin:\t\t\t${args.coinType}`);
  console.log(`To:\t\t\t${args.to}`);
  console.log(`Amount:\t\t\t${args.amount}`);
}

function printAnyCoinRegister(txInfo: MSafeTxnInfo) {
  console.log(`Action:\t\t\t${txInfo.txType}`);
  const args = txInfo.args as CoinRegisterArgs;
  console.log(`Coin:\t\t\t${args.coinType}`);
}

function printRevertTxn(txInfo: MSafeTxnInfo) {
  console.log(`Action:\t\t\t${txInfo.txType}`);
  const args = txInfo.args as RevertArgs;
  console.log(`Revert SN:\t\t${args.sn}`);
}

async function printCustomTxn(txInfo: MSafeTxnInfo) {
  console.log(`Action:\t\t\t${txInfo.txType}`);
  const cia = txInfo.args as CustomInteractionArgs;
  console.log(`Call function:\t\t${cia.deployer}::${cia.moduleName}::${cia.fnName}`);
  // print type arguments
  for (let i = 0; i != cia.typeArgs.length; i = i + 1) {
    console.log(`Type Arguments (${i+1}):\t${cia.typeArgs[i]}`);
  }
  // print arguments
  const args = await getBCSArgValue(cia);
  for (let i = 0; i != args.length; i = i + 1) {
    const [argType, argValue] = args[i];
    console.log(`Arguments (${i+1}):\t\t[${argType}]\t${argValue}`);
  }
}

function printModulePublishTxn(txInfo: MSafeTxnInfo) {
  console.log(`Action:\t\t\t${txInfo.txType}`);
  const mpi = txInfo.args as ModulePublishInfo;
  console.log(`Verify Hash:\t\t${mpi.hash}`);
  console.log(`Deployer:\t\t${txInfo.sender}`);
  console.log(`Package:\t\t${mpi.metadata.name}`);
  console.log(`Upgrade Policy:\t\t${mpi.metadata.upgrade_policy.name()}`);
  console.log(`Upgrade Number:\t\t${mpi.metadata.upgrade_number}`);
  console.log(`Source Digest:\t\t${mpi.metadata.source_digest}`);
  console.log(`Modules:\t\t${mpi.metadata.modules.map(
    module => `${txInfo.sender}::${module.name}`
  ).join('\n\t\t\t')}`);
  console.log(`Dependency:\t\t${mpi.metadata.deps.map(
    dep => `${HexString.fromUint8Array(dep.account.address)}::${dep.package_name}`
  ).join('\n\t\t\t')}`);
}

async function getBCSArgValue(cia: CustomInteractionArgs) {
  const deployer = cia.deployer;
  const moduleName = cia.moduleName;
  const fnName = cia.fnName;

  return decodeCustomArgs(deployer, moduleName, fnName, cia.args);
}
