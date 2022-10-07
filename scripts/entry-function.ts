import {DEF_ACCOUNT_CONF, loadConfigAndApply, MY_ACCOUNT} from "../src/web3/global";
import {Command} from "commander";
import {BCS, HexString} from "aptos";
import {loadMomentumSafe} from "./common";
import {makeEntryFunctionTx} from "../src/momentum-safe/msafe-txn";
import {printSeparator, printTxDetails, promptForYN} from "../src/cmd/common";
import * as Aptos from "../src/web3/global";
import {isStringAddress} from "../src/utils/check";


const program = new Command();

const cli = program
  .version("0.0.1")
  .description("Momentum Safe entry function caller. Call an entry function.")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (devnet, testnet), use deployed address", "devnet")
  .requiredOption("--msafe <string>", "momentum safe address")
  .parse(process.argv);


async function main() {
  const args = await parseAndLoadConfig();

  // load msafe
  const msafe = await loadMomentumSafe(HexString.ensure(args.msafe));

  // Make module publish transaction
  const sn = await msafe.getNextSN();

  // Apply your function call and arguments here
  const msafeTxn = await makeEntryFunctionTx(
    msafe.address,
    {
      fnName: "0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0::message::set_message",
      typeArgs: [],
      args: [BCS.bcsSerializeStr("Hello momentum safe")],
    },
    {sequenceNumber: sn},
  );

  // Confirm transaction details
  await printTxDetails(msafeTxn.getTxnInfo());
  printSeparator();
  const userConfirm = await promptForYN("Do you confirm with the transaction?", true);
  if (!userConfirm) {
    console.error("User canceled operation");
    process.exit(1);
  }

  // Submit transaction
  const res = await msafe.initTransaction(MY_ACCOUNT, msafeTxn);
  const myHash = (res.pendingTx as any).hash;
  console.log(`\tTransaction ${myHash} submitted to blockchain`);
  await Aptos.waitForTransaction(myHash);
  console.log(`\tTransaction confirmed on chain.`);
}

async function parseAndLoadConfig(): Promise<configArg> {
  const args = getArguments();
  validateArguments(args);

  await loadConfigAndApply({
    configFilePath: args.config,
    profile: args.profile,
    network: args.network,
  });
  return args;
}

type configArg = {
  config: string,
  profile: string,
  network: string,
  msafe: HexString,
}

function getArguments(): configArg {
  return {
    config: cli.opts().config,
    profile: cli.opts().profile,
    network: cli.opts().network,
    msafe: HexString.ensure(cli.opts().msafe),
  };
}

function validateArguments(ca: configArg) {
  if (!isStringAddress(ca.msafe.hex())) {
    throw Error("invalid msafe address: " + ca.msafe);
  }
}

(async () => main())();