import { BCS, TransactionBuilder, TxnBuilderTypes } from "aptos";
import { MigrationProofMessage } from "./MigrationMessage";

export class Transaction {
  raw: TxnBuilderTypes.RawTransaction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    this.raw = raw;
  }

  static deserialize(rawTx: Uint8Array) {
    const deserializer = new BCS.Deserializer(rawTx.slice(32)); // skip prefix, see TransactionBuilder.getSigningMessage
    return new Transaction(
      TxnBuilderTypes.RawTransaction.deserialize(deserializer)
    );
  }

  getSigningMessage() {
    return TransactionBuilder.getSigningMessage(this.raw);
  }
}

export class TypeMessage {
  constructor(public readonly raw: MigrationProofMessage) {}

  static deserialize(rawTx: Uint8Array) {
    return new TypeMessage(MigrationProofMessage.fromBytes(rawTx));
  }

  getSigningMessage() {
    return this.raw instanceof MigrationProofMessage
      ? this.raw.toBytes()
      : TransactionBuilder.getSigningMessage(this.raw);
  }

  static isTypeMessage(rawTx: Uint8Array) {
    return MigrationProofMessage.isMigrationProofMessage(rawTx);
  }
}
