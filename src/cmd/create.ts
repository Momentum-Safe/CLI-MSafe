import {printSeparator, promptUntilNumber, promptUntilString} from "./helper";
import {TxnBuilderTypes, HexString} from "aptos";
import {MY_ACCOUNT} from "../web3/global";
import {CreationHelper} from "../momentum-safe/creation";
import * as Aptos from "../web3/global";

const MAX_OWNERS = 32;

export async function initCreateMSafe() {
  console.clear();

  console.log("Creating a new MSafe wallet.");
  printSeparator();

  const numOwners = await promptUntilNumber(
    "What is the number of owners? (2-32)\t\t\t",
    "\tPlease input a valid number (2-32):\t",
    (v: number) => v >= 2 && v <= 32
  );

  // TODO: currently 1/x is not allowed. Extend the functionality later
  const threshold = await promptUntilNumber(
    `What is the confirmation threshold? (1-${numOwners})\t\t`,
    `\tPlease input a valid number (1-${numOwners}):\t`,
    (v: number) => v >= 2 && v <= numOwners
  );

  const initialBalance = await promptUntilNumber(
    "What's the amount of initial fund of MSafe?\t\t",
    "\tPlease input a valid number (>20000)\t",
    v => v > 20000,
  );

  const ownerPubKeys: HexString[] = [MY_ACCOUNT.publicKey()];

  console.log(`\t1 th public key (Self): \t${MY_ACCOUNT.publicKey()}`);
  for (let i = 1; i < numOwners; i++) {
    const publicKeyStr = await promptUntilString(
      `\t${i + 1} th public key: \t\t`,
      `\tPlease provide a valid public key`,
      isStringPublicKey
    );
    ownerPubKeys.push(HexString.ensure(publicKeyStr));
  }

  printSeparator();

  const nonce = await CreationHelper.getNonce(MY_ACCOUNT.address());
  const creation = new CreationHelper(ownerPubKeys, threshold, nonce, BigInt(initialBalance));

  console.log(`Creating ${threshold} / ${numOwners} Momentum Safe wallet`);
  console.log(`\tAddress:\t${creation.address}`);

  printSeparator();
  await prompt("Initiate wallet creation?");
  console.log();
  const tx = await creation.initCreation(MY_ACCOUNT);
  console.log(`\tWallet creation transaction sent:\t${tx.hash}`);
  await Aptos.waitForTransaction(tx.hash);
  console.log(`\tTransaction confirmed, MomentumSafe creation initialized.`);

  printSeparator();

  console.log("Waiting for confirmation from other wallets...");
}

function isStringPublicKey(s: string): boolean {
  const byteLength = HexString.ensure(s).toUint8Array().length;
  return byteLength == TxnBuilderTypes.Ed25519PublicKey.LENGTH;
}

function isStringAddress(s: string): boolean {
  const byteLength = HexString.ensure(s).toUint8Array().length;
  return byteLength == 32; // SHA3_256 length
}