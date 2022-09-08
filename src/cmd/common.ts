import * as Aptos from '../web3/global';

export function printMyMessage() {
  console.log(`My Address: \t${Aptos.MY_ACCOUNT.address()}`);
  console.log(`My PubKey: \t${Aptos.MY_ACCOUNT.publicKey()}`);
  console.log("-".repeat(process.stdout.columns));
  console.log();
}