import {Command} from "commander";
import {defaultConfigPath, isAccountExist, loadConfigAndApply, MY_ACCOUNT} from "../../src/web3/global";
import * as Aptos from "../../src/web3/global";
import {ApiError, BCS, HexString, TxnBuilderTypes} from "aptos";
import {AptosEntryTxnBuilder} from "../../src/web3/transaction";
import {APTOS_FRAMEWORK_HS, FUNCTIONS, MODULES, typeTagStructFromName} from "../../src/momentum-safe/common";

const DEF_SEND_AMOUNT = "100000000";

const DEPLOYER = HexString.ensure("be836d132840c6380a97342a46e09c75ca30d1cbf561bc4161e20f71e644692c");

const program = new Command();
const cli = program
  .version("0.0.2")
  .description("Momentum Safe test coin minter.")
  .option("-c, --config <string>", "config file of aptos profile", defaultConfigPath)
  .option("-p --profile <string>", "profile to use in aptos config", "default")
  .option("-t --to <string>", "target account to send test coin")
  .option("-a --amount <string>", "amount of token to be sent", DEF_SEND_AMOUNT)
  .option("-r --register", "Whether to register coin")
  .parse(process.argv);


async function main() {
  // MY_ACCOUNT should be the deployer of CLI-MSafe/test/move/sources/test_coin.move
  try {
    await loadConfigAndApply({
      configFilePath: cli.opts().config,
      profile: cli.opts().profile,
    });
  } catch (e) {
    if ((e as ApiError).message.includes('Account not found by Address')) {
      console.log('Wallet must have some initial fund to interact with');
      process.exit(1);
    }
    throw e;
  }

  const isExist = await isAccountExist(MY_ACCOUNT.address());
  if (!isExist) {
    await Aptos.fundAddress(MY_ACCOUNT.address(), 1000000000);
  }

  const targetAddress = HexString.ensure(cli.opts().to);
  const amount = BigInt(cli.opts().amount);

  if (cli.opts().register) {
    console.log(`Registering for ${MY_ACCOUNT.address()}`);
    await registerTestToken();
    console.log("Register success!");
  } else {
    if (!targetAddress) {
      throw new Error(`invalid target address: ${targetAddress}`);
    }
    if (!amount) {
      throw new Error(`invalid amount: ${amount}"`);
    }

    console.log(`Minting ${amount} test token to ${targetAddress}`);
    await mintTestToken(targetAddress, amount);
    console.log("Minting success!");
  }

}

async function mintTestToken(to: HexString, amount: bigint) {
  const chainID = await Aptos.getChainId();
  const sn = await Aptos.getSequenceNumber(MY_ACCOUNT.address());
  const typeArg = typeTagStructFromName(getTestCoinResource());

  const txBuilder = new AptosEntryTxnBuilder();
  const tx = txBuilder
    .from(MY_ACCOUNT.address())
    .addr(APTOS_FRAMEWORK_HS)
    .module(MODULES.MANAGED_COIN)
    .method(FUNCTIONS.COIN_MINT)
    .chainId(chainID)
    .sequenceNumber(sn)
    .type_args([typeArg])
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(to)),
      BCS.bcsSerializeUint64(amount)
    ])
    .build();

  const signedTx = MY_ACCOUNT.sign(tx);
  const res = await Aptos.sendSignedTransactionAsync(signedTx);
  return await Aptos.waitForTransaction(res.hash);
}

async function registerTestToken() {
  const chainID = await Aptos.getChainId();
  const sn = await Aptos.getSequenceNumber(MY_ACCOUNT.address());
  const typeArg = typeTagStructFromName(getTestCoinResource());

  const txBuilder = new AptosEntryTxnBuilder();
  const tx = txBuilder
    .from(MY_ACCOUNT.address())
    .addr(APTOS_FRAMEWORK_HS)
    .module(MODULES.MANAGED_COIN)
    .method(FUNCTIONS.COIN_REGISTER)
    .chainId(chainID)
    .sequenceNumber(sn)
    .type_args([typeArg])
    .args([])
    .build();

  const signedTx = MY_ACCOUNT.sign(tx);
  const res = await Aptos.sendSignedTransactionAsync(signedTx);
  return await Aptos.waitForTransaction(res.hash);
}

function getTestCoinResource(): string {
  return `${DEPLOYER}::test_coin::TestCoin`;
}

(async () => main())();
