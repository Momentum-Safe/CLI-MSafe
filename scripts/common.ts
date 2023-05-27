import {HexString} from "aptos";
import {MomentumSafe} from "../src/momentum-safe/momentum-safe";
import {isHexEqual} from "../src/utils/check";
import {MY_ACCOUNT} from "../src/web3/global";
import {printSeparator, printTxDetails, promptForYN} from "../src/cmd/common";
import * as Aptos from "../src/web3/global";
import {MSafeTransaction} from "../src/momentum-safe/msafe-txn";
import {loadConfigAndApply} from "../src/utils/load";
import fs from "fs";
import {Command} from "commander";


export async function loadMomentumSafe(msafeAddr: HexString) {
  const msafe = await MomentumSafe.fromMomentumSafe(msafeAddr);
  if (!msafe.owners.find(owner => isHexEqual(owner, MY_ACCOUNT.address()))) {
    throw Error("My address is not the owner of the momentum safe");
  }
  return msafe;
}

export async function printTxnAndConfirm(msafeTxn: MSafeTransaction) {
  // Confirm transaction details
  await printTxDetails(msafeTxn.getTxnInfo());
  printSeparator();
  const userConfirm = await promptForYN("Do you confirm with the transaction?", true);
  if (!userConfirm) {
    console.error("User canceled operation");
    process.exit(1);
  }
}

export interface initTransactionArgs {
  gasPrice: bigint,
  maxGas: bigint,
  estimateMaxGas: boolean,
  estimateGasPrice: boolean,
}

export async function proposeTransaction(
  msafe: MomentumSafe,
  msafeTxn: MSafeTransaction,
  args: initTransactionArgs
) {
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

  return myHash;
}

export async function parseAndLoadTxnConfig(cli: Command): Promise<configArg> {
  const args = getTxnArguments(cli);

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

function getTxnArguments(cli: Command): configArg {
  const estimateGasPrice = cli.opts().gasPrice === undefined;
  const estimateMaxGas = cli.opts().maxGas === undefined;

  return {
    config: cli.opts().config,
    profile: cli.opts().profile,
    network: cli.opts().network.toLowerCase(),
    maxGas: cli.opts().maxGas,
    gasPrice: cli.opts().gasPrice,
    estimateGasPrice,
    estimateMaxGas,
    endpoint: cli.opts().endpoint.toLowerCase(),
    faucet: cli.opts().faucet.toLowerCase(),
    msafeDeployer: cli.opts().msafeDeployer.toLowerCase(),
    msafe: cli.opts().msafe.toLowerCase(),
  };
}
