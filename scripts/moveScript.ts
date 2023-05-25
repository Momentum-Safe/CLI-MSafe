import {DEF_ACCOUNT_CONF, MY_ACCOUNT} from "../src/web3/global";
import {Command} from "commander";
import {HexString, TxnBuilderTypes} from "aptos";
import * as Aptos from "../src/web3/global";
import {makeMoveScriptTx} from "../src/momentum-safe/msafe-txn";
import {printSeparator, printTxDetails, promptForYN} from "../src/cmd/common";
import {loadMomentumSafe} from "./common";
import {DEFAULT_ENDPOINT, DEFAULT_FAUCET, DEFAULT_MSAFE, DEFAULT_NETWORK, loadConfigAndApply} from "../src/utils/load";
import fs from "fs";

const program = new Command();


const cli = program
  .version("0.0.1")
  .description("Momentum Safe MoveScript tools. Run the compiled MOVE script on blockchain.")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (devnet, testnet), use deployed address", "devnet")
  .requiredOption("--msafe <string>", "momentum safe address")
  .requiredOption("--move-script <string>", "compiled move script file(.mv)")
  .option("--max-gas <bigint>", "max gas to override the default settings")
  .option("--gas-price <bigint>", "gas price that override the default settings")
  .option("-e --endpoint <string>", "full node endpoint (default to use the endpoint in config.yaml)", DEFAULT_ENDPOINT)
  .option("-f --faucet <string>", "faucet address (default to use the endpoint in config.yaml)", DEFAULT_FAUCET)
  .option("-d --msafe-deployer <string>", "address of momentum safe deployer", DEFAULT_MSAFE)
  .requiredOption("-m --msafe <string>", "address of msafe account")
  .parse(process.argv);


async function main() {
  const args = await parseAndLoadConfig();

  // load msafe
  const msafe = await loadMomentumSafe(HexString.ensure(args.msafeAddr));

  // make module publish transaction
  const sn = await msafe.getNextSN();
  const msafeTxn = await makeMoveScriptTx(
    msafe,
    {
      moveScriptFile: args.moveScriptFile,
      args: [],
      typeArgs: []
    },
    {
      sequenceNumber: sn,
      gasPrice: args.gasPrice,
      maxGas: args.maxGas,
      estimateMaxGas: args.estimateMaxGas,
      estimateGasPrice: args.estimateGasPrice,
    }
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
    msafeDeployer: args.msafeDeployer,
  });
  return args;
}

type configArg = {
  config: string,
  profile: string,
  network: string,
  moveScriptFile: string,
  maxGas: bigint,
  estimateMaxGas: boolean,
  gasPrice: bigint,
  estimateGasPrice: boolean,
  endpoint: string,
  faucet: string,
  msafeDeployer: string,
  msafeAddr: string,
}

function getArguments(): configArg {
  const estimateGasPrice = cli.opts().gasPrice === undefined;
  const estimateMaxGas = cli.opts().maxGas === undefined;

  return {
    config: cli.opts().config,
    profile: cli.opts().profile,
    network: cli.opts().network.toLowerCase(),
    moveScriptFile: cli.opts().moveScript,
    maxGas: cli.opts().maxGas,
    gasPrice: cli.opts().gasPrice,
    estimateGasPrice,
    estimateMaxGas,
    endpoint: cli.opts().endpoint.toLowerCase(),
    faucet: cli.opts().faucet.toLowerCase(),
    msafeDeployer: cli.opts().msafeDeployer.toLowerCase(),
    msafeAddr: cli.opts().msafe.toLowerCase(),
  };
}

function validateArguments(ca: configArg) {
  if (!fs.existsSync(ca.moveScriptFile)) {
    throw Error("invalid move script: " + ca.moveScriptFile);
  }
}

(async () => main())();
