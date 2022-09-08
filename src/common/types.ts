import {BCS, TransactionBuilder, TxnBuilderTypes} from "aptos";

import {Buffer} from "buffer/"; // the trailing slash is important!


export class Transaction {
  raw: TxnBuilderTypes.RawTransaction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    this.raw = raw;
  }

  static deserialize(rawTx: Buffer): Transaction {
    const deserializer = new BCS.Deserializer(rawTx.slice(32)); // skip prefix, see TransactionBuilder.getSigningMessage
    return new Transaction(TxnBuilderTypes.RawTransaction.deserialize(deserializer));
  }

  getSigningMessage() {
    return TransactionBuilder.getSigningMessage(this.raw);
  }
}
