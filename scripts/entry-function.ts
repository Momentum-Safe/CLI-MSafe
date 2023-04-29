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
  .option("-d --msafe-deployer <string>", "address of msafe deployer", DEFAULT_MSAFE)
  .requiredOption("-m --msafe <string>", "address of msafe account")
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
      fnName: "0x6b3720cd988adeaf721ed9d4730da4324d52364871a68eac62b46d21e4d2fa99::farming::add_pool",
      typeArgs: ["0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::stable_pool::StablePoolToken<0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::mod_coin::MOD, 0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC, 0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null, 0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null>"],
      args: [
        BCS.bcsSerializeUint64(100),
      ],
    },
    {
      sequenceNumber: sn,
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
  maxGas: bigint,
  estimateMaxGas: boolean,
  gasPrice: bigint,
  estimateGasPrice: boolean,
  endpoint: string,
  faucet: string,
  msafeDeployer: string,
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
    msafeDeployer: cli.opts().msafeDeployer.toLowerCase(),
    msafe: cli.opts().msafe.toLowerCase(),
  };
}

(async () => main())();