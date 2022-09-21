import {
  CmdOption,
  executeCmdOptions,
  isStringAddress,
  isStringFullModule,
  isStringTypeStruct,
  printMSafeMessage,
  printMyMessage,
  printSeparator,
  printTxDetails,
  promptForYN,
  promptUntilBigInt,
  promptUntilNumber,
  promptUntilString,
  promptUntilTrueFalse,
  registerState,
  setState,
  splitModuleComponents,
  State,
} from "./common";
import {MomentumSafe} from "../momentum-safe/momentum-safe";
import {BCS, HexString, TxnBuilderTypes} from "aptos";
import * as Aptos from '../web3/global';
import {MY_ACCOUNT} from '../web3/global';
import {checkTxnEnoughSigsAndAssemble} from "./tx-details";
import {
  APTTransferArgs,
  CoinRegisterArgs,
  CoinTransferArgs,
  makeCustomInteractionTx,
  makeMSafeAnyCoinRegisterTx,
  makeMSafeAnyCoinTransferTx,
  makeMSafeAPTTransferTx,
  MSafeTransaction,
  MSafeTxnInfo,
  MSafeTxnType
} from "../momentum-safe/msafe-txn";

export function registerInitCoinTransfer() {
  registerState(State.InitCoinTransfer, newTransaction);
}

async function newTransaction(c: {address: HexString}) {
  console.clear();
  await printMyMessage();

  const addr = c.address;
  const msafe = await MomentumSafe.fromMomentumSafe(addr);
  const info = await msafe.getMomentumSafeInfo();
  const balance = await Aptos.getBalance(addr);
  await printMSafeMessage(addr, info, balance);

  const sn = await msafe.getNextSN();
  const tx = await promptForNewTransaction(msafe.address, sn);
  printSeparator();

  printTxConfirmation(tx.getTxnInfo());
  printSeparator();

  const userConfirmed = await promptForYN("Transaction information correct?", true);
  if (!userConfirmed) {
    setState(State.MSafeDetails, {address: addr});
    return;
  }

  // Submit transaction
  const {plHash: txHash, pendingTx: res} = await msafe.initTransaction(MY_ACCOUNT, tx);
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
  }
  await executeCmdOptions('Choose your next step', [
    {shortage: 'v', showText: "View details", handleFunc: () =>
      { setState(State.PendingCoinTransfer, {address: addr, txHash: (txHash as HexString).hex()}) }},
    {shortage: 'b', showText: "Back", handleFunc: () => {setState(State.MSafeDetails, {address: addr})}}
    ]);
}

async function promptForNewTransaction(sender: HexString, sn: number): Promise<MSafeTransaction> {
  let txType = MSafeTxnType.Unknown;
  await executeCmdOptions(
    "Please choose your transaction type",
    [
      {shortage: 1, showText: MSafeTxnType.APTCoinTransfer, handleFunc: () => txType = MSafeTxnType.APTCoinTransfer},
      {shortage: 2, showText: MSafeTxnType.AnyCoinTransfer, handleFunc: () => txType = MSafeTxnType.AnyCoinTransfer},
      {shortage: 3, showText: MSafeTxnType.AnyCoinRegister, handleFunc: () => txType = MSafeTxnType.AnyCoinRegister},
      {shortage: 4, showText: MSafeTxnType.CustomInteraction, handleFunc: () => txType = MSafeTxnType.CustomInteraction},
    ]
  );

  printSeparator();

  console.log(`Start ${txType}`);
  console.log();

  return await promptAndBuildTx(sender, txType, sn);
}

async function promptAndBuildTx(sender: HexString, txType: MSafeTxnType, sn: number): Promise<MSafeTransaction> {
  switch (txType) {
    case MSafeTxnType.APTCoinTransfer:
      return await promptAndBuildAPTCoinTransfer(sender, sn);
    case MSafeTxnType.AnyCoinTransfer:
      return await promptAndBuildAnyCoinTransfer(sender, sn);
    case MSafeTxnType.AnyCoinRegister:
      return await promptAndBuildForAnyCoinRegister(sender, sn);
    case MSafeTxnType.CustomInteraction:
      return await promptAndBuildForCustomTx(sender, sn);
    default:
      throw new Error("Invalid type");
  }
}

async function promptAndBuildAPTCoinTransfer(sender: HexString, sn: number): Promise<MSafeTransaction> {
  const toAddressStr = await promptUntilString(
    '\tTo address:\t',
    '\tAddress not valid:\t',
    isStringAddress,
  );
  const toAddress = HexString.ensure(toAddressStr);

  const amountStr = await promptUntilNumber(
    '\tAmount:\t\t',
    "\tAmount not valid:\t",
    val => Number(val) > 0,
  );
  const amount = Number(amountStr);
  const txArgs: APTTransferArgs = {to: toAddress, amount: amount};
  return await makeMSafeAPTTransferTx(sender, txArgs, {sequenceNumber: sn});
}

async function promptAndBuildAnyCoinTransfer(sender: HexString, sn: number): Promise<MSafeTransaction> {
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

  const amountStr = await promptUntilNumber(
    '\tAmount:\t\t',
    "\tAmount not valid:\t",
    val => Number(val) > 0,
  );
  const amount = Number(amountStr);
  const txArgs: CoinTransferArgs = {
    coinType: coinType,
    to: toAddress,
    amount: amount,
  };
  return await makeMSafeAnyCoinTransferTx(sender, txArgs, {sequenceNumber: sn});
}

async function promptAndBuildForAnyCoinRegister(sender: HexString, sn: number): Promise<MSafeTransaction> {
  const coinType = await promptUntilString(
    '\tCoin type:\t',
    '\tCoin type not valid:\t',
    isStringTypeStruct,
  );
  const txArgs: CoinRegisterArgs = {coinType: coinType};
  return await makeMSafeAnyCoinRegisterTx(sender, txArgs, {sequenceNumber: sn});
}

async function promptAndBuildForCustomTx(
  sender: HexString,
  sn: number
): Promise<MSafeTransaction> {
  const fullFnName = await promptUntilString(
    '\tModule name (E.g. 0x1::coin):\t',
    '\tFunction name not valid:\t',
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
  const entryFns =moduleData.abi.exposed_functions.filter(fn => fn.is_entry && fn.visibility === 'public');

  let i = 1;
  let selectedFn: any;
  const opts: CmdOption[] = [];
  entryFns.forEach( fn => {
    opts.push({
      shortage: i, showText: fn.name, handleFunc: () => selectedFn = fn
    });
    i = i + 1;
  });
  opts.push({shortage: 'b', showText: "Back", handleFunc: () => setState(State.MSafeDetails, {address: sender})});

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

  console.log("Start to input arguments:");
  console.log();
  const args = await promptForArgs(selectedFn.params);

  const ciArgs = {
    deployer: contractAddr,
    moduleName: moduleName,
    fnName: selectedFn.name,
    typeArgs: typeArgs,
    args: args,
  };

  return await makeCustomInteractionTx(sender, ciArgs, {sequenceNumber: sn});
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
    tyArgs.push(ta);
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
    case ("&signer"): {
      return undefined;
    }
    case ("u64"): {
      const val = await promptUntilBigInt(`\t${i}: ${param}\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeUint64(val);
    }
    case ("u32"): {
      const val = await promptUntilNumber(`\t${i}: ${param}\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeU32(val);
    }
    case ("u16"): {
      const val = await promptUntilNumber(`\t${i}: ${param}\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeU16(val);
    }
    case ("u8"): {
      const val = await promptUntilNumber(`\t${i}: ${param}\t\t`, `\tIncorrect value:`, v => v >= 0 );
      return BCS.bcsSerializeU8(val);
    }
    case ("bool"): {
      const val = await promptUntilTrueFalse(`\t${i}: ${param}\t\t`);
      return BCS.bcsSerializeBool(val);
    }
    case ("address"): {
      const val = await promptUntilString(`\t${i}: ${param}\t`, `\tIncorrect value:`, isStringAddress);
      return BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(val));
    }
    default: {
      throw new Error(`Unsupported type: `+param);
    }
  }
}

function isHexString(s: string): boolean {
  try {
    HexString.ensure(s);
  } catch (e) {
    return false;
  }
  return true;
}

function hexStringToBytes(s: string): Uint8Array {
  return HexString.ensure(s).toUint8Array();
}

function stringToBytes(s: string): Uint8Array {
  return Buffer.from(s, 'base64');
}

function printTxConfirmation(txData: MSafeTxnInfo) {
  console.log("Transaction confirmation:");
  console.log();
  printTxDetails(txData);
}