import readline from "readline-sync";
import clear from 'clear';
import {printMyMessage} from "./common";

const SEPARATOR_LENGTH = 20;


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

