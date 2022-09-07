import {HexString, TransactionBuilder, TxnBuilderTypes} from "aptos";
import {Bytes, Deserializer} from "aptos/dist/transaction_builder/bcs";
import {Ed25519Signature, SigningMessage,} from "aptos/dist/transaction_builder/aptos_types";

import {Buffer} from "buffer/"; // the trailing slash is important!


export class Transaction {
  raw: TxnBuilderTypes.RawTransaction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    this.raw = raw;
  }

  static deserialize(rawTx: Buffer): Transaction {
    const deserializer = new Deserializer(rawTx.slice(32)); // skip prefix, see TransactionBuilder.getSigningMessage
    return new Transaction(TxnBuilderTypes.RawTransaction.deserialize(deserializer));
  }

  getSigningMessage() {
    return TransactionBuilder.getSigningMessage(this.raw);
  }
}
