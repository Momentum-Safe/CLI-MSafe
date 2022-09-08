import {loadAptosYaml, defaultPath} from './load';
import * as Aptos from '../web3/global';
import {printMyMessage, shortString} from "./common";
import {initCreateMSafe, registerCreation} from "./create";
import {Command} from "commander";
import {printSeparator, prompt, promptForYN} from "./helper";
import {Registry} from "../momentum-safe/registry";
import {MY_ACCOUNT} from "../web3/global";
import {HexString} from 'aptos';
import {setState, State} from "./state";
import {registerEntry} from "./entry";
import {registerList} from "./list";

const program = new Command();

const cli = program
  .version("0.0.1")
  .description("Momentum Safe CLI")
  .option("-c, --config <string>", "config file of aptos profile", defaultPath)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .parse(process.argv);


async function main() {
  registerAllStates();
  console.clear();

  await loadConfigAndApply();

  await registerIfNotRegistered();

  console.log(22222222);
  setState(State.Entry);
}

function registerAllStates() {
  registerEntry();
  registerList();
  registerCreation();
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
    console.log(`\tTransaction ${shortString(res)} submitted on chain`);
    await Aptos.waitForTransaction(res);
    console.log(`\tTransaction confirmed. Registration succeeds.`);

    printSeparator();
    await prompt('continue');
  }
}

(async () => main())();