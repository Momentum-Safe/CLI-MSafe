// TODO: Any coin decimal
// TODO: handle transaction execution error during assemble and submit
// TODO: View assets list (get from resources) and coin transfer
// TODO: More customized parameters, e.g. gas price, max price, expiration, e.t.c
// TODO: Make address / public key type
// TODO: add more argument types for smart contract interaction.
// TODO: apply the gas fee and max gas estimation
// TODO: data sync issue
// TODO: Add private key encryption
// TODO: (Need to update smart contract first) Key rotation
// TODO: Replace data query interface with indexer

import * as Aptos from '../web3/global';
import {registerCreation} from "./create";
import {Command} from "commander";
import {
  printSeparator,
  prompt,
  promptForYN,
  printMyMessage,
  setState,
  State,
} from "./common";
import {Registry} from "../momentum-safe/registry";
import {DEF_ACCOUNT_CONF, loadConfigAndApply, MY_ACCOUNT} from "../web3/global";
import {registerList} from "./list";
import {registerCreationDetails} from "./creation-details";
import {ApiError} from "aptos";
import {registerMSafeDetails} from "./msafe-details";
import {registerInitCoinTransfer} from "./new-transaction";
import {registerTxDetails} from "./tx-details";
import {registerRevertTransaction} from "./revert-transaction";

const program = new Command();

const cli = program
  .version("0.0.1")
  .description("Momentum Safe CLI")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (auto, devnet, testnet)", "auto")
  .parse(process.argv);


async function main() {
  registerAllStates();
  console.clear();

  try {
    await loadConfigAndApply({
      configFilePath: cli.opts().config,
      profile: cli.opts().profile,
      network: cli.opts().network,
    });
  } catch (e) {
    if ((e as ApiError).message.includes('Account not found by Address')) {
      console.log('Wallet must have some initial fund to interact with');
      process.exit(1);
    }
    throw e;
  }
  await fundWithFaucetIfNotSetup();
  await registerIfNotRegistered();
  setState(State.List);
}


function registerAllStates() {
  registerList();
  registerCreation();
  registerCreationDetails();
  registerMSafeDetails();
  registerInitCoinTransfer();
  registerTxDetails();
  registerRevertTransaction();
}

async function fundWithFaucetIfNotSetup() {
  try {
    await Aptos.getAccount(MY_ACCOUNT.address());
  } catch (e) {
    if (e instanceof ApiError && e.message.includes("Resource not found")) {
      // Set up the aptos account and give some initial funding
      const opt = promptForYN("Account not exist.\nGet some funding with faucet?", true);
      if (!opt) {
        process.exit(1);
      }
      await Aptos.fundAddress(MY_ACCOUNT.address().hex(), 100000000000);
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

(async () => main())();
