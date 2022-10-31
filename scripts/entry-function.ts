import {DEF_ACCOUNT_CONF, MY_ACCOUNT} from "../src/web3/global";
import {Command} from "commander";
import {BCS, HexString} from "aptos";
import {loadMomentumSafe} from "./common";
import {makeEntryFunctionTx} from "../src/momentum-safe/msafe-txn";
import {printSeparator, printTxDetails, promptForYN} from "../src/cmd/common";
import * as Aptos from "../src/web3/global";
import {isStringAddress} from "../src/utils/check";
import {DEFAULT_ENDPOINT, DEFAULT_FAUCET, DEFAULT_MSAFE, loadConfigAndApply} from "../src/utils/load";


const program = new Command();

const cli = program
  .version("0.0.1")
  .description("Momentum Safe entry function caller. Call an entry function.")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (devnet, testnet), use deployed address", "auto")
  .requiredOption("--msafe <string>", "momentum safe address")
  .option("--max-gas <bigint>", "max gas to override the default settings")
  .option("--gas-price <bigint>", "gas price that override the default settings")
  .option("-e --endpoint <string>", "full node endpoint (default to use the endpoint in config.yaml)", DEFAULT_ENDPOINT)
  .option("-f --faucet <string>", "faucet address (default to use the endpoint in config.yaml)", DEFAULT_FAUCET)
  .option("-m --msafe <string>", "address of msafe deployer", DEFAULT_MSAFE)
  .parse(process.argv);


async function main() {
  const args = await parseAndLoadConfig();

  // load msafe
  const msafe = await loadMomentumSafe(HexString.ensure(args.msafe));

  // Make module publish transaction
  const sn = await msafe.getNextSN();

  // Apply your function call and arguments here
  const msafeTxn = await makeEntryFunctionTx(
    msafe,
    {
      fnName: "0x57ddcbaeda7ba430dbd95641120ffccec86a7f896ec99e5eec85e985b11f522e::message::set_message",
      typeArgs: [],
      args: [BCS.bcsSerializeStr("Hello momentum safe")],
    },
    {
      sequenceNumber: sn,
      gasPrice: args.gasPrice,
      maxGas: args.maxGas,
      estimateMaxGas: args.estimateMaxGas,
      estimateGasPrice: args.estimateGasPrice,
    },
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
  const res = await msafe.initTransaction(MY_ACCOUNT, msafeTxn, {
    gasPrice: args.gasPrice,
    maxGas: args.maxGas,
    estimateMaxGas: args.estimateMaxGas,
    estimateGasPrice: args.estimateGasPrice,
  });
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
    endpoint: args.endpoint,
    faucet: args.faucet,
    msafe: args.msafe,
  });
  return args;
}

type configArg = {
  config: string,
  profile: string,
  network: string,
  maxGas: bigint,
  estimateMaxGas: boolean,
  gasPrice: bigint,
  estimateGasPrice: boolean,
  endpoint: string,
  faucet: string,
  msafe: string,
}

function getArguments(): configArg {
  const estimateGasPrice = cli.opts().gasPrice === undefined;
  const estimateMaxGas = cli.opts().maxGas === undefined;

  return {
    config: cli.opts().config,
    profile: cli.opts().profile,
    network: cli.opts().network,
    maxGas: cli.opts().maxGas,
    gasPrice: cli.opts().gasPrice,
    estimateGasPrice,
    estimateMaxGas,
    endpoint: cli.opts().endpoint,
    faucet: cli.opts().faucet,
    msafe: cli.opts().msafe,
  };
}


function validateArguments(ca: configArg) {
  if (!isStringAddress(ca.msafe)) {
    throw Error("invalid msafe address: " + ca.msafe);
  }
}

(async () => main())();