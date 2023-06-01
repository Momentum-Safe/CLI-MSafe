import {DEF_ACCOUNT_CONF, MY_ACCOUNT} from "../src/web3/global";
import {Command} from "commander";
import {HexString} from "aptos";
import {MovePublisher} from "../src/momentum-safe/move-publisher";
import {makeModulePublishTx} from "../src/momentum-safe/msafe-txn";
import {loadMomentumSafe, parseAndLoadTxnConfig, printTxnAndConfirm, proposeTransaction} from "./common";
import {DEFAULT_ENDPOINT, DEFAULT_FAUCET, DEFAULT_MSAFE, DEFAULT_NETWORK, loadConfigAndApply} from "../src/utils/load";

const program = new Command();


const cli = program
  .version("0.0.1")
  .description("Momentum Safe move deployer script. Deploy the compiled MOVE package on blockchain.")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (devnet, testnet), use deployed address", "mainnet")
  .requiredOption("--msafe <string>", "momentum safe address")
  .requiredOption("--move-dir <string>", "move directory contains Move.toml")
  .option("--max-gas <bigint>", "max gas to override the default settings")
  .option("--gas-price <bigint>", "gas price that override the default settings")
  .option("-e --endpoint <string>", "full node endpoint (default to use the endpoint in config.yaml)", DEFAULT_ENDPOINT)
  .option("-f --faucet <string>", "faucet address (default to use the endpoint in config.yaml)", DEFAULT_FAUCET)
  .option("-d --msafe-deployer <string>", "address of momentum safe deployer", DEFAULT_MSAFE)
  .requiredOption("-m --msafe <string>", "address of msafe account")
  .parse(process.argv);


async function main() {
  const args = await parseAndLoadTxnConfig(cli);
  const moveDir = getMoveDir(cli);

  // load msafe
  const msafe = await loadMomentumSafe(HexString.ensure(args.msafe));

  // make module publish transaction
  const sn = await msafe.getNextSN();
  const msafeTxn = await makeModulePublishTx(
    msafe,
    {moveDir: moveDir},
    {
      sequenceNumber: sn,
      gasPrice: args.gasPrice,
      maxGas: args.maxGas,
      estimateMaxGas: args.estimateMaxGas,
      estimateGasPrice: args.estimateGasPrice,
    }
  );

  // Confirm transaction details
  await printTxnAndConfirm(msafeTxn);
  // Submit transaction
  await proposeTransaction(msafe, msafeTxn, args);
}

function getMoveDir(cli: Command) {
  const moveDir = cli.opts().moveDir;
  validateMoveDir(moveDir);
  return moveDir;
}

function validateMoveDir(moveDir: string) {
  if (!MovePublisher.isDirValid(moveDir)) {
    throw Error("invalid move dir: " + moveDir);
  }
}

(async () => main())();
