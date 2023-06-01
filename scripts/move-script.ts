import {DEF_ACCOUNT_CONF} from "../src/web3/global";
import {Command} from "commander";
import {HexString, TxnBuilderTypes} from "aptos";
import {makeMoveScriptTx} from "../src/momentum-safe/msafe-txn";
import {loadMomentumSafe, parseAndLoadTxnConfig, printTxnAndConfirm, proposeTransaction} from "./common";
import {DEFAULT_ENDPOINT, DEFAULT_FAUCET, DEFAULT_MSAFE} from "../src/utils/load";
import fs from "fs";

const program = new Command();


const cli = program
  .version("0.0.1")
  .description("Momentum Safe MoveScript tools. Run the compiled MOVE script on blockchain.")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (devnet, testnet), use deployed address", "mainnet")
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
  const args = await parseAndLoadTxnConfig(cli);
  const moveScriptFile = getMoveScriptFile(cli);

  // load msafe
  const msafe = await loadMomentumSafe(HexString.ensure(args.msafe));

  // make module publish transaction
  const sn = await msafe.getNextSN();
  const receiver = "0xca4a2fb9c6d811666fedb1e02953ece60f447a63adf8adbe577ff9f359f4273d";
  const msafeTxn = await makeMoveScriptTx(
    msafe,
    {
      moveScriptFile: moveScriptFile,
      args: [
        new TxnBuilderTypes.TransactionArgumentAddress(TxnBuilderTypes.AccountAddress.fromHex(receiver)),
        new TxnBuilderTypes.TransactionArgumentU64(10n),
      ],
      typeArgs: ["0x1::aptos_coin::AptosCoin"]
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
  await printTxnAndConfirm(msafeTxn);
  // Submit transaction
  await proposeTransaction(msafe, msafeTxn, args);
}

function getMoveScriptFile(cli: Command) {
  const scriptFile = cli.opts().moveScript;
  validateMoveScriptFile(scriptFile);
  return scriptFile;
}

function validateMoveScriptFile(moveScriptFile: string) {
  if (!fs.existsSync(moveScriptFile)) {
    throw Error("invalid move script: " + moveScriptFile);
  }
}

(async () => main())();
