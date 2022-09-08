import readline from "readline-sync";
import clear from 'clear';

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
