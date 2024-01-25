import colors from "ansicolor";
import { BCS, HexString, TxnBuilderTypes } from "aptos";
import { FUNCTIONS, MODULES } from "../momentum-safe/common";
import {
  MomentumSafeInfo,
  TransactionType,
} from "../momentum-safe/momentum-safe";
import {
  MSafeTxnInfo,
  MSafeTxnType,
  applyDefaultOptions,
} from "../momentum-safe/msafe-txn";
import { MigrationProofMessage } from "../types/MigrationMessage";
import { TypeMessage } from "../types/Transaction";
import { HexBuffer } from "../utils/buffer";
import { isAscii, isHexEqual } from "../utils/check";
import { sha3_256 } from "../utils/crypto";
import * as Aptos from "../web3/global";
import { AptosEntryTxnBuilder } from "../web3/transaction";
import {
  State,
  getMSafeInfo,
  printMsafeDetails,
  printMyMessage,
  promptForYN,
  promptUntilString,
  registerState,
  setState,
} from "./common";

export function registerMigration() {
  registerState(State.Migrate, migrate);
}

export async function migrate(config: { address: HexString }) {
  const { address } = config;
  console.clear();
  await printMyMessage();
  const info = await getMSafeInfo(address);
  await printMsafeDetails(info);

  console.log(
    colors.yellow(
      "You're about to create migration transaction. Once migration completed, all your asset can be only accessed from MSafe v2 via https://aptos.m-safe.io\n"
    )
  );
  const res = await promptForYN(
    "Confirm to create migration transaction?",
    false
  );

  if (!res) {
    setState(State.MSafeDetails, config);
    return;
  }

  const msafeName = await promptUntilString(
    "\tMSafe name: ",
    "\tName must be all ascii chars and the length should less than 32: ",
    (s) => {
      if (!s) {
        return false;
      } else if (s.length > 32) {
        return false;
      } else if (!isAscii(s)) {
        return false;
      }
      return true;
    }
  );
  const msafeDesc = await promptUntilString(
    "\tMSafe desc: ",
    "\tDesc must be all ascii chars and the length should less than 64: ",
    (s) => {
      if (s.length > 64) {
        return false;
      } else if (!isAscii(s)) {
        return false;
      }
      return true;
    }
  );

  const metadata = {
    m_source: "MSafe",
    m_name: msafeName,
    m_desc: msafeDesc,
  };

  const migrationMessage = new MigrationProofMessage(
    await Aptos.client().getChainId(),
    address,
    info.nextSN,
    info.owners,
    BigInt(info.threshold)
  );
  const typeMessage = new TypeMessage(migrationMessage);
  const signMessage = typeMessage.getSigningMessage();
  const signature = Aptos.MY_ACCOUNT.account.signBuffer(signMessage);

  const transactionBuilder = await makeMigrationTxBuilder(
    typeMessage.raw.inner.sequence_number,
    new TxnBuilderTypes.Ed25519Signature(signature.toUint8Array()),
    metadata,
    info
  );

  const transaction = await transactionBuilder.build(Aptos.MY_ACCOUNT.account);

  const signedTransaction = Aptos.MY_ACCOUNT.sign(transaction);
  const hash = await Aptos.client().submitSignedBCSTransaction(
    signedTransaction
  );
  await Aptos.waitForTransaction(hash.hash);
  setState(State.MSafeDetails, config);
}

async function makeMigrationTxBuilder(
  sn: BCS.AnyNumber,
  signature: TxnBuilderTypes.Ed25519Signature,
  metadata: { [key: string]: string } = {},
  info: MomentumSafeInfo
) {
  const txBuilder = new AptosEntryTxnBuilder();
  const pkIndex = info.pubKeys.findIndex((it) =>
    isHexEqual(it, Aptos.MY_ACCOUNT.publicKey())
  );
  const config = await applyDefaultOptions(Aptos.MY_ACCOUNT.address());

  return txBuilder
    .addr(Aptos.DEPLOYER)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_INIT_MIGRATION)
    .from(Aptos.MY_ACCOUNT.address())
    .withTxConfig(config)
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(info.address)),
      BCS.bcsSerializeU8(pkIndex),
      BCS.bcsSerializeUint64(sn),
      BCS.bcsToBytes(signature),
      BCS.serializeVectorWithFunc(Object.keys(metadata), "serializeStr"),
      BCS.serializeVectorWithFunc(Object.values(metadata), "serializeStr"),
    ]);
}

export function toMigrateTx(tx: TransactionType): MSafeTxnInfo {
  const payload = HexBuffer(tx.payload);
  const message = TypeMessage.deserialize(payload);
  const migrationMessage = message.raw.inner;
  return {
    txType: MSafeTxnType.Migrate,
    sn: migrationMessage.sequence_number,
    hash: sha3_256(message.raw.toBytes()),
    chainID: migrationMessage.chain_id.value,
    expiration: new Date(),
    sender: HexString.ensure(migrationMessage.account_address.toHexString()),
    gasPrice: 0n,
    maxGas: 0n,
    args: {},
    numSigs: tx.signatures.data.length,
  };
}
