// TODO: apply the use case for 1/x signature momentum safe wallet
// TODO: APT token amount change to decimal and use bigint
// TODO: Coin register call
// TODO: Module publish
// TODO: Arbitrary function call
// TODO: View assets list (get from resources)
// TODO: Revert transaction
// TODO: Sequential pending transaction
// TODO: More customized parameters, e.g. gas price, max price, expiration, e.t.c

// TODO: Add private key encryption
// TODO: (Need to update smart contract first) Key rotation
// TODO: Replace data query interface with indexer

import * as Aptos from '../web3/global';
import {registerCreation} from "./create";
import {Command} from "commander";
import {printSeparator, prompt, promptForYN, printMyMessage, setState, State} from "./common";
import {Registry} from "../momentum-safe/registry";
import {MY_ACCOUNT} from "../web3/global";
import {registerEntry} from "./entry";
import {registerList} from "./list";
import {registerCreationDetails} from "./creation-details";
import {ApiError} from "aptos";
import {load} from "js-yaml";
import {readFile} from "fs/promises";
import {registerMSafeDetails} from "./msafe-details";
import {registerInitCoinTransfer} from "./init-coin-transfer";
import {registerTxDetails} from "./tx-details";

export const defaultConfigPath = `.aptos/config.yaml`;

const program = new Command();

const cli = program
  .version("0.0.1")
  .description("Momentum Safe CLI")
  .option("-c, --config <string>", "config file of aptos profile", defaultConfigPath)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .parse(process.argv);


async function main() {
  registerAllStates();
  console.clear();

  try {
    await loadConfigAndApply();
  } catch (e) {
    if ((e as ApiError).message.includes('Account not found by Address')) {
      console.log('Wallet must have some initial fund to interact with');
      process.exit(1);
    }
    throw e;
  }
  await fundWithFaucetIfNotSetup();
  await registerIfNotRegistered();
  setState(State.Entry);
}


function registerAllStates() {
  registerEntry();
  registerList();
  registerCreation();
  registerCreationDetails();
  registerMSafeDetails();
  registerInitCoinTransfer();
  registerTxDetails();
}

async function loadConfigAndApply() {
  let yaml: any;
  try {
    yaml = await loadAptosYaml(cli.opts().config);
  } catch (e) {
    printSetupWalletMsg();
    process.exit(1);
  }
  const profile = yaml.profiles[cli.opts().profile];
  if (!profile) {
    console.log(`cannot find profile ${cli.opts().profile}`);
    process.exit(1);
  }
  Aptos.setGlobal({
    nodeURL: profile.rest_url,
    faucetURL: profile.faucet_url,
    privateKey: profile.private_key,
    address: profile.account,
  });
}

function printSetupWalletMsg() {
  console.log('');
  console.log("Have you set up your Aptos address? Run the following command to setup your wallet\n");
  console.log("\taptos init\n");
  process.exit(1001);
}

async function fundWithFaucetIfNotSetup() {
  try {
    await Aptos.getAccount(MY_ACCOUNT.address());
  } catch (e) {
    if (e instanceof ApiError && e.message.includes("Resource not found")) {
      // Set up the aptos account and give some initial funding
      const opt = promptForYN("Get some funding with faucet?", true);
      if (!opt) {
        process.exit(1);
      }
      await Aptos.fundAddress(MY_ACCOUNT.address().hex(), 1000000);
    } else {
      throw e;
    }
  }
}

async function registerIfNotRegistered() {
  const isRegistered = await Registry.isRegistered(MY_ACCOUNT.address());
  if (!isRegistered) {
    await printMyMessage();

    const register = await promptForYN("The wallet hasn't been registered yet. Register now?", true);
    if (!register) {
      console.log();
      console.log("To use momentum safe, you must register first.");
      process.exit(3);
    }
    printSeparator();
    console.log("\tRegistering...");
    const res = await Registry.register(MY_ACCOUNT);
    console.log(`\tTransaction ${res.hash} submitted on chain`);
    await Aptos.waitForTransaction(res.hash);
    console.log(`\tTransaction confirmed. Registration succeeds.`);

    printSeparator();
    await prompt('continue');
  }
}

async function loadAptosYaml(filePath: string) {
  return load(await readFile(filePath, 'utf-8'));
}

async function loadDefault() {
  return loadAptosYaml(defaultConfigPath);
}

(async () => main())();