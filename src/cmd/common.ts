import * as Aptos from '../web3/global';

export function printMyMessage() {
  console.log("My information:");
  console.log(`\tAddress: \t${Aptos.MY_ACCOUNT.address()}`);
  console.log(`\tPubKey: \t${Aptos.MY_ACCOUNT.publicKey()}`);
  console.log();
  console.log("-".repeat(process.stdout.columns));
  console.log();
}