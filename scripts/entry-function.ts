import {DEF_ACCOUNT_CONF} from "../src/web3/global";
import {Command} from "commander";
import {BCS, HexString} from "aptos";
import {loadMomentumSafe, parseAndLoadTxnConfig, printTxnAndConfirm, proposeTransaction} from "./common";
import {makeEntryFunctionTx} from "../src/momentum-safe/msafe-txn";
import {DEFAULT_ENDPOINT, DEFAULT_FAUCET, DEFAULT_MSAFE} from "../src/utils/load";


const program = new Command();

const cli = program
  .version("0.0.1")
  .description("Momentum Safe entry function caller. Call an entry function.")
  .option("-c, --config <string>", "config file of aptos profile", DEF_ACCOUNT_CONF)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-n --network <string>", "network (devnet, testnet), use deployed address", "mainnet")
  .requiredOption("--msafe <string>", "momentum safe address")
  .option("--max-gas <bigint>", "max gas to override the default settings")
  .option("--gas-price <bigint>", "gas price that override the default settings")
  .option("-e --endpoint <string>", "full node endpoint (default to use the endpoint in config.yaml)", DEFAULT_ENDPOINT)
  .option("-f --faucet <string>", "faucet address (default to use the endpoint in config.yaml)", DEFAULT_FAUCET)
  .option("-d --msafe-deployer <string>", "address of msafe deployer", DEFAULT_MSAFE)
  .requiredOption("-m --msafe <string>", "address of msafe account")
  .parse(process.argv);


async function main() {
  const args = await parseAndLoadTxnConfig(cli);

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
  await printTxnAndConfirm(msafeTxn);
  // Submit transaction
  await proposeTransaction(msafe, msafeTxn, args);
}

(async () => main())();