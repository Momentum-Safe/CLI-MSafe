import {loadDefault, ConfigYaml} from './load';
import * as Aptos from '../web3/global';
import {printMyMessage} from "./common";

async function main() {
  await loadDefaultConfig();
  printMyMessage();
}

async function loadDefaultConfig() {
  let yaml: ConfigYaml;
  try {
    yaml = await loadDefault();
  } catch (e) {
    printSetupWalletMsg();
    process.exit(1);
  }
  const profile = yaml.profiles.default;
  Aptos.setGlobal({
    nodeURL: profile.rest_url,
    faucetURL: profile.faucet_url,
    privateKey: profile.private_key,
    address: profile.account,
  });
  console.log("profile loaded successfully");
}

function printSetupWalletMsg() {
  console.log();
  console.log("Have you set up your Aptos address? Run the following command to setup your wallet\n");
  console.log("\taptos init\n");
  process.exit(1);
}

(async () => main())();