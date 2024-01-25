import { HexString } from "aptos";
import { Command } from "commander";
import { executeInitMigration } from "../src/momentum-safe/msafe-txn";
import {
  DEFAULT_ENDPOINT,
  DEFAULT_FAUCET,
  DEFAULT_MSAFE,
} from "../src/utils/load";
import { DEF_ACCOUNT_CONF } from "../src/web3/global";
import { loadMomentumSafe, parseAndLoadTxnConfig } from "./common";
const program = new Command();

const cli = program
  .version("0.0.1")
  .description("Momentum Safe migration caller. Create migration transaction.")
  .option(
    "-c, --config <string>",
    "config file of aptos profile",
    DEF_ACCOUNT_CONF
  )
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option(
    "-n --network <string>",
    "network (devnet, testnet), use deployed address",
    "testnet"
  )
  .option("--max-gas <bigint>", "max gas to override the default settings")
  .option(
    "--gas-price <bigint>",
    "gas price that override the default settings"
  )
  .option(
    "-e --endpoint <string>",
    "full node endpoint (default to use the endpoint in config.yaml)",
    DEFAULT_ENDPOINT
  )
  .option(
    "-f --faucet <string>",
    "faucet address (default to use the endpoint in config.yaml)",
    DEFAULT_FAUCET
  )
  .option(
    "-d --msafe-deployer <string>",
    "address of msafe deployer",
    DEFAULT_MSAFE
  )
  .requiredOption("-m --msafe <string>", "address of msafe account")
  .parse(process.argv);

async function main() {
  const args = await parseAndLoadTxnConfig(cli);
  const msafe = await loadMomentumSafe(HexString.ensure(args.msafe));

  await executeInitMigration(msafe);
}

(async () => main())();
