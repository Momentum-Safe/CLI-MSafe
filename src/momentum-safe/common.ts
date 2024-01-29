import { BCS, HexString, TxnBuilderTypes } from "aptos";
import { MoveStructTypeTag } from "../moveTypes/moveTypeTag";
import { TypeMessage } from "../types/Transaction";
import { HexBuffer } from "../utils/buffer";
import * as Aptos from "../web3/global";
import { DEPLOYER } from "../web3/global";
import { APTOS_TOKEN as APTOS_COIN, Transaction } from "../web3/transaction";

export const APTOS_FRAMEWORK =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
export const APTOS_FRAMEWORK_HS = HexString.ensure(APTOS_FRAMEWORK);

export const MAX_NUM_OWNERS = 32;
export const ADDRESS_HEX_LENGTH = 64;

export const MODULES = {
  MOMENTUM_SAFE: "momentum_safe",
  CREATOR: "creator",
  REGISTRY: "registry",
  TABLE_MAP: "table_map",
  COIN: "coin",
  MANAGED_COIN: "managed_coin",
  APTOS_COIN: "aptos_coin",
  CODE: "code",
} as const;

export const FUNCTIONS = {
  MSAFE_REGISTER: "register",
  MSAFE_INIT_TRANSACTION: "init_transaction",
  MSAFE_SUBMIT_SIGNATURE: "submit_signature",
  MSAFE_REVERT: "do_nothing",

  CREATOR_INIT_WALLET: "init_wallet_creation",
  CREATOR_SUBMIT_SIG: "submit_signature",

  COIN_TRANSFER: "transfer",
  COIN_REGISTER: "register",
  COIN_MINT: "mint",

  REGISTRY_REGISTER: "register",

  PUBLISH_PACKAGE: "publish_package_txn",

  MSAFE_INIT_MIGRATION: "init_migration",
  MSAFE_GET_STATUS: "msafe_status",
  MSAFE_MIGRATE: "migrate",
} as const;

export const STRUCTS = {
  MOMENTUM: "Momentum",
  MOMENTUM_TRANSACTION: "Transaction",
  MOMENTUM_EVENT: "MomentumSafeEvent",
  CREATOR: "PendingMultiSigCreations",
  CREATOR_CREATION: "MomentumSafeCreation",
  CREATOR_EVENT: "MultiSigCreationEvent",
  REGISTRY: "OwnerMomentumSafes",
  REGISTRY_EVENT: "RegisterEvent",
  REGISTRY_ELEMENT: "Element<K,V>",
  APTOS_COIN: "AptosCoin",
  COIN_INFO: "CoinInfo",
  MIGRATION: "Migration",
} as const;

// TODO: refactor all these values
export function getStructType(
  tagName: keyof typeof STRUCTS
): MoveStructTypeTag {
  switch (tagName) {
    case "MOMENTUM":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.MOMENTUM_SAFE,
        STRUCTS.MOMENTUM
      );
    case "MOMENTUM_TRANSACTION":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.MOMENTUM_SAFE,
        STRUCTS.MOMENTUM_TRANSACTION
      );
    case "MOMENTUM_EVENT":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.MOMENTUM_SAFE,
        STRUCTS.MOMENTUM_EVENT
      );
    case "CREATOR":
      return new MoveStructTypeTag(DEPLOYER, MODULES.CREATOR, STRUCTS.CREATOR);
    case "CREATOR_CREATION":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.CREATOR,
        STRUCTS.CREATOR_CREATION
      );
    case "CREATOR_EVENT":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.CREATOR,
        STRUCTS.CREATOR_EVENT
      );
    case "REGISTRY":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.REGISTRY,
        STRUCTS.REGISTRY
      );
    case "REGISTRY_EVENT":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.REGISTRY,
        STRUCTS.REGISTRY_EVENT
      );
    case "REGISTRY_ELEMENT":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.TABLE_MAP,
        STRUCTS.REGISTRY_ELEMENT
      );
    case "MIGRATION":
      return new MoveStructTypeTag(
        DEPLOYER,
        MODULES.MOMENTUM_SAFE,
        STRUCTS.MIGRATION
      );
    case "APTOS_COIN":
      return MoveStructTypeTag.fromString(APTOS_COIN);
  }
  throw new Error("Unknown resource type");
}

export function assembleMultiSigTxn(
  payload: string | Uint8Array,
  pubKey: TxnBuilderTypes.MultiEd25519PublicKey,
  sig: TxnBuilderTypes.MultiEd25519Signature
): Uint8Array {
  const authenticator =
    new TxnBuilderTypes.TransactionAuthenticatorMultiEd25519(pubKey, sig);
  const hb =
    typeof payload === "string" ? HexBuffer(payload) : Buffer.from(payload);

  if (TypeMessage.isTypeMessage(hb)) {
    const typeMessage = TypeMessage.deserialize(hb);
    const signMessage = typeMessage.getSigningMessage();

    const signature = Aptos.MY_ACCOUNT.account.signBuffer(signMessage);
    return signature.toUint8Array();
  } else {
    const signingTx = Transaction.deserialize(hb);
    const signedTx = new TxnBuilderTypes.SignedTransaction(
      signingTx.raw,
      authenticator
    );
    return BCS.bcsToBytes(signedTx);
  }
}

export function hasDuplicateAddresses(addrs: HexString[]): boolean {
  const s = new Set();
  addrs.forEach((pk) => {
    if (s.has(pk.hex())) {
      return true;
    }
    s.add(pk.hex());
  });
  return false;
}

export function serializeOwners(addrs: HexString[]): BCS.Bytes {
  const bcsAddress = (addr: HexString) =>
    TxnBuilderTypes.AccountAddress.fromHex(addr);

  const serializer = new BCS.Serializer();
  BCS.serializeVector(
    addrs.map((owner) => bcsAddress(owner)),
    serializer
  );
  return serializer.getBytes();
}
