import * as Aptos from '../web3/global';
import {HexString} from 'aptos';

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

export function shortString(val: HexString | string) {
  if (typeof val === 'string' && val.length < 15) {
    return val;
  } else if (val instanceof HexString && val.toShortString().length < 15) {
    return val.hex();
  }
  const s = typeof val === 'string'? val: val.hex();
  return `${s.substring(0, 8)}...${s.substring(s.length-5)}`;
}