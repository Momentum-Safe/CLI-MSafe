import {
  CmdOption,
  executeCmdOptions,
  printMSafeMessage,
  printMyMessage,
  printSeparator,
  printTxDetails,
  prompt,
  promptForYN,
  promptUntilBigInt, promptUntilBigNumber,
  promptUntilNumber,
  promptUntilString,
  promptUntilTrueFalse,
  registerState,
  setState,
  State,
} from "./common";
import {MomentumSafe} from "../momentum-safe/momentum-safe";
import {BCS, HexString, TxnBuilderTypes} from "aptos";
import * as Aptos from '../web3/global';
import {APT_COIN_INFO, MY_ACCOUNT} from '../web3/global';
import {checkTxnEnoughSigsAndAssemble} from "./tx-details";
import {
  APTTransferArgs,
  CoinRegisterArgs,
  CoinTransferArgs,
  compileAndMakeModulePublishTx,
  makeEntryFunctionTx, makeModulePublishTx,
  makeMSafeAnyCoinRegisterTx,
  makeMSafeAnyCoinTransferTx,
  makeMSafeAPTTransferTx,
  MSafeTransaction,
  MSafeTxnInfo,
  MSafeTxnType
} from "../momentum-safe/msafe-txn";
import {isStrIncludedArtifacts, MovePublisher, strToIncludedArtifacts} from "../momentum-safe/move-publisher";
import {
  isStringAddress,
  isStringFullModule,
  isStringHex,
  isStringTypeStruct
} from "../utils/check";
import {formatToFullSimpleType, formatToFullType, splitModuleComponents} from "../utils/parse";
import {BigNumber} from "bignumber.js";
import {toDust} from "../utils/bignumber";
import {exit} from "process";

export function registerInitCoinTransfer() {
  registerState(State.InitCoinTransfer, newTransaction);
}

async function newTransaction(c: {address: HexString}) {
  console.clear();
  await printMyMessage();

  const addr = c.address;
  const msafe = await MomentumSafe.fromMomentumSafe(addr);
  const info = await msafe.getMomentumSafeInfo();
  const balance = await Aptos.getBalanceAPT(addr);
  await printMSafeMessage(addr, info, balance);

  const sn = await msafe.getNextSN();
  const tx = await promptForNewTransaction(msafe, sn);
  printSeparator();

  await printTxConfirmation(tx.getTxnInfo());
  printSeparator();

  const userConfirmed = await promptForYN("Transaction information correct?", true);
  if (!userConfirmed) {
    setState(State.MSafeDetails, {address: addr});
    return;
  }

  // Submit transaction
  const {plHash: txHash, pendingTx: res} = await msafe.initTransaction(MY_ACCOUNT, tx, {
    estimateGasPrice: true,
    estimateMaxGas: true,
  });
  const myHash = (res as any).hash;
  console.log();
  console.log(`\tTransaction ${myHash} submitted to blockchain`);
  await Aptos.waitForTransaction(myHash);
  console.log(`\tTransaction confirmed on chain.`);

  printSeparator();

  const userBreak = await checkTxnEnoughSigsAndAssemble(msafe, (txHash as HexString));
  if (userBreak) {
    await executeCmdOptions(
      "User break the signature submission",
      [{shortage: 'b', showText: 'Back', handleFunc: () => setState(State.MSafeDetails, {address: addr})}],
    );
    return;
  }
  await executeCmdOptions('Choose your next step', [
    {shortage: 'v', showText: "View details", handleFunc: () =>
      { setState(State.PendingCoinTransfer, {address: addr, txHash: (txHash as HexString).hex()}) }},
    {shortage: 'b', showText: "Back", handleFunc: () => {setState(State.MSafeDetails, {address: addr})}}
    ]);
}

async function promptForNewTransaction(msafe: MomentumSafe, sn: bigint): Promise<MSafeTransaction> {
  let txType = MSafeTxnType.Unknown;
  await executeCmdOptions(
    "Please choose your transaction type",
    [
      {shortage: 1, showText: MSafeTxnType.APTCoinTransfer, handleFunc: () => txType = MSafeTxnType.APTCoinTransfer},
      {shortage: 2, showText: MSafeTxnType.AnyCoinTransfer, handleFunc: () => txType = MSafeTxnType.AnyCoinTransfer},
      {shortage: 3, showText: MSafeTxnType.AnyCoinRegister, handleFunc: () => txType = MSafeTxnType.AnyCoinRegister},
      {shortage: 4, showText: MSafeTxnType.EntryFunction, handleFunc: () => txType = MSafeTxnType.EntryFunction},
      {shortage: 5, showText: MSafeTxnType.ModulePublish, handleFunc: () => txType = MSafeTxnType.ModulePublish},
      {shortage: 6, showText: MSafeTxnType.MoveScript, handleFunc: () => txType = MSafeTxnType.MoveScript},
    ]
  );

  printSeparator();

  console.log(`Start ${txType}`);
  console.log();

  return await promptAndBuildTx(msafe, txType, sn);
}

async function promptAndBuildTx(
  msafe: MomentumSafe,
  txType: MSafeTxnType,
  sn: bigint
): Promise<MSafeTransaction> {
  switch (txType) {
    case MSafeTxnType.APTCoinTransfer:
      return await promptAndBuildAPTCoinTransfer(msafe, sn);
    case MSafeTxnType.AnyCoinTransfer:
      return await promptAndBuildAnyCoinTransfer(msafe, sn);
    case MSafeTxnType.AnyCoinRegister:
      return await promptAndBuildForAnyCoinRegister(msafe, sn);
    case MSafeTxnType.EntryFunction:
      return await promptAndBuildForEntryFnTx(msafe, sn);
    case MSafeTxnType.ModulePublish:
      return await promptPublishTx(msafe, sn);
    case MSafeTxnType.MoveScript:
      return promptMoveScriptTx();
    default:
      throw new Error("Invalid type");
  }
}

async function promptAndBuildAPTCoinTransfer(msafe: MomentumSafe, sn: bigint): Promise<MSafeTransaction> {
  const toAddressStr = await promptUntilString(
    '\tTo address:\t',
    '\tAddress not valid:\t',
    isStringAddress,
  );
  const toAddress = HexString.ensure(toAddressStr);

  const amountBN = await promptUntilBigNumber(
    '\tAmount (APT):\t',
    "\tAmount not valid (APT):\t",
    val => val > BigNumber(0),
  );
  const amount = toDust(amountBN, APT_COIN_INFO.decimals);
  const txArgs: APTTransferArgs = {to: toAddress, amount: amount};
  const opt = {
    sequenceNumber: sn,
    estimateGasPrice: true,
    estimateMaxGas: true
  };
  return await makeMSafeAPTTransferTx(msafe, txArgs, opt);
}

async function promptAndBuildAnyCoinTransfer(msafe: MomentumSafe, sn: bigint): Promise<MSafeTransaction> {
  const coinType = await promptUntilString(
    '\tCoin type:\t',
    '\tCoin type not valid:\t',
    isStringTypeStruct,
  );

  const toAddressStr = await promptUntilString(
    '\tTo address:\t',
    '\tAddress not valid:\t',
    isStringAddress,
  );
  const toAddress = HexString.ensure(toAddressStr);

  const amount = await promptUntilBigInt(
    '\tAmount:\t\t',
    "\tAmount not valid:\t",
    val => Number(val) > 0,
  );
  const txArgs: CoinTransferArgs = {
    coinType: coinType,
    to: toAddress,
    amount: amount,
  };
  const opt = {
    sequenceNumber: sn,
    estimateGasPrice: true,
    estimateMaxGas: true
  };
  return await makeMSafeAnyCoinTransferTx(msafe, txArgs, opt);
}

async function promptAndBuildForAnyCoinRegister(msafe: MomentumSafe, sn: bigint): Promise<MSafeTransaction> {
  const coinType = await promptUntilString(
    '\tCoin type:\t',
    '\tCoin type not valid:\t',
    isStringTypeStruct,
  );
  const txArgs: CoinRegisterArgs = {coinType: coinType};
  const opt = {
    sequenceNumber: sn,
    estimateGasPrice: true,
    estimateMaxGas: true
  };
  return await makeMSafeAnyCoinRegisterTx(msafe, txArgs, opt);
}

async function promptAndBuildForEntryFnTx(
  msafe: MomentumSafe,
  sn: bigint
): Promise<MSafeTransaction> {
  const fullFnName = await promptUntilString(
    '\tModule name (E.g. 0x1::coin):\t',
    '\tModule name not valid:\t',
    isStringFullModule,
  );
  const [contractAddr, moduleName] = splitModuleComponents(fullFnName);

  console.log();
  console.log("Pulling ABI from chain...");

  printSeparator();

  const moduleData = await Aptos.getAccountModule(contractAddr, moduleName);
  if (!moduleData.abi) {
    throw new Error(`${fullFnName} has no ABI exposed`);
  }
  if (!moduleData.abi.exposed_functions) {
    throw new Error(`${fullFnName} has no exposed function`);
  }
  const entryFns = moduleData.abi.exposed_functions.filter(fn => fn.is_entry && fn.visibility === 'public');

  let i = 1;
  let selectedFn: any;
  const opts: CmdOption[] = [];
  entryFns.forEach( fn => {
    opts.push({
      shortage: i, alternatives: [fn.name], showText: fn.name, handleFunc: () => selectedFn = fn
    });
    i = i + 1;
  });
  opts.push({shortage: 'b', showText: "Back", handleFunc: () => setState(State.MSafeDetails, {address: msafe.address})});

  await executeCmdOptions(
    'Please select the function you want to interact with:',
    opts,
  );
  if (!selectedFn) {
    throw new Error("User aborted");
  }

  printSeparator();

  const typeArgs = await promptForTypeArgs();

  printSeparator();

  console.log("Note in this version, only limited arguments are supported. Including:");
  console.log("\t1. u128, u64, u32, u16, u8");
  console.log("\t2. address");
  console.log("\t3. &signer");
  console.log("\t4. vector<u8>");
  console.log();

  console.log("Start to input arguments:");
  console.log();

  const args = await promptForArgs(selectedFn.params);

  const ciArgs = {
    fnName: `${contractAddr}::${moduleName}::${selectedFn.name}`,
    typeArgs: typeArgs,
    args: args,
  };

  const opt = {
    sequenceNumber: sn,
    estimateGasPrice: true,
    estimateMaxGas: true
  };
  return await makeEntryFunctionTx(msafe, ciArgs, opt);
}

async function promptForTypeArgs() {
  const numTypeArgs = await promptUntilNumber(
    '\tNumber Type Arguments:\t',
    '\tNumber Type Arguments:\t',
    num => num >= 0,
  );
  const tyArgs: string[] = [];
  for (let i = 0; i != numTypeArgs; i = i+1) {
    const ta = await promptUntilString(
      `\t${i+1} th:\t\t\t`,
      "\tInvalid type arg:\t",
      isStringTypeStruct,
    );
    tyArgs.push(formatToFullType(ta));
  }
  return tyArgs;
}

async function promptForArgs(params: any[]): Promise<BCS.Bytes[]> {
  const args: Uint8Array[] = [];

  for (let i = 0; i != params.length; i += 1) {
    const bcsRes = await promptForArg(i + 1, params[i]);
    if (bcsRes === undefined) {
      continue;
    }
    args.push(bcsRes);
  }
  return args;
}

// TODO: add vector, address, vector<u8>
async function promptForArg(i: number, param: any): Promise<BCS.Bytes | undefined> {
  switch (param) {
    case ("&signer"):
    case ("signer"): {
      console.log(`\t${i}: Type ${param}\t\t\t&signer`);
      return undefined;
    }
    case ("u128"): {
      const val = await promptUntilBigInt(`\t${i}: Type ${param}\t\t\t`, `\tIncorrect value:`, v => v >= 0);
      return BCS.bcsSerializeU128(val);
    }
    case ("u64"): {
      const val = await promptUntilBigInt(`\t${i}: Type ${param}\t\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeUint64(val);
    }
    case ("u32"): {
      const val = await promptUntilNumber(`\t${i}: Type ${param}\t\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeU32(val);
    }
    case ("u16"): {
      const val = await promptUntilNumber(`\t${i}: Type ${param}\t\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeU16(val);
    }
    case ("u8"): {
      const val = await promptUntilNumber(`\t${i}: Type ${param}\t\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeU8(val);
    }
    case ("bool"): {
      const val = await promptUntilTrueFalse(`\t${i}: Type ${param}\t\t\t`);
      return BCS.bcsSerializeBool(val);
    }
    case ("address"): {
      const val = await promptUntilString(`\t${i}: Type ${param}\t\t`, `\tIncorrect value:`, isStringAddress);
      return BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(val));
    }
    case ("vector<u8>"): {
      const val = await promptUntilString(`\t${i}: Type ${param}\t\t`, `\tIncorrect value:`, isStringHex);
      return BCS.bcsSerializeBytes(HexString.ensure(val).toUint8Array());
    }
    case ("0x1::string::String"): {
      const val = await prompt(`\t${i}: Type ${param}\t`);
      return BCS.bcsSerializeStr(val);
    }
    default: {
      throw new Error(`Unsupported type: `+param);
    }
  }
}

async function promptPublishTx(msafe: MomentumSafe,  sn: bigint) {
  const res = await promptForYN("Do you want to compile the MOVE module?", false);
  console.log();
  if (res) {
    return promptCompileAndBuildModulePublishTx(msafe, sn);
  } else {
    return promptBuildModulePublishTx(msafe, sn);
  }
}

async function promptMoveScriptTx(): Promise<any> {
  await prompt("Please use 'scripts/move-script.ts' to generate the transaction.");
  exit(0);
}


async function promptBuildModulePublishTx(msafe: MomentumSafe, sn: bigint) {
  console.log("Publish move modules.");
  console.log();
  console.log('Please confirm for prerequisite:');
  console.log("\t1. MOVE module has already been compiled with flag `--save-metadata`");
  console.log(`\t2. The deployer's address has been set to momentum safe ${msafe.address}`);
  console.log();
  const moveDir = await promptUntilString(
    "Please input your target move directory (with Move.toml)",
    "Invalid directory - Move.toml not found",
    MovePublisher.isDirValid,
  );
  return await makeModulePublishTx(msafe, {moveDir: moveDir}, {sequenceNumber: sn});
}

async function promptCompileAndBuildModulePublishTx(
  msafe: MomentumSafe,
  sn: bigint,
): Promise<MSafeTransaction> {
  console.log("Compile and publish move modules.");
  console.log();
  console.log("Please confirm for prerequisites:");
  console.log("\t1) Have `aptos` installed in $PATH.");
  console.log("\t2) Have the deployer address set to `_` in Move.toml.");
  console.log();
  const moveDir = await promptUntilString(
    "Please input your target move directory (with Move.toml)",
    "Invalid directory - Move.toml not found",
    MovePublisher.isDirValid,
  );
  const ia = await promptUntilString(
    "Included artifacts (none, sparse, all)\t\t\t",
    "Allowed arguments: none, sparse, all\t\t\t",
    isStrIncludedArtifacts
  );
  const includedArtifacts = strToIncludedArtifacts(ia);
  const addrToReplace = await promptUntilString(
    "Deployer address name in Move.toml\t\t\t",
    "",
    () => true,
  );

  printSeparator();
  const args = {
    moveDir: moveDir,
    artifacts: includedArtifacts,
    deployerAddressName: addrToReplace,
  };
  const opts = {
    sequenceNumber: sn,
    estimateGasPrice: true,
    estimateMaxGas: true,
  };
  return await compileAndMakeModulePublishTx(msafe, args, opts);
}

async function printTxConfirmation(txData: MSafeTxnInfo) {
  console.log("Transaction confirmation:");
  console.log();
  await printTxDetails(txData);
}
