import {AptosAccount, HexString, MaybeHexString, TransactionBuilderEd25519, TxnBuilderTypes} from "aptos";
import {Bytes} from "aptos/dist/transaction_builder/bcs";
import {Transaction} from "../common/types";


// SingleWallet is a single-signed wallet account
export class Account {

  account: AptosAccount;

  constructor(privateKeyBytes?: Uint8Array | undefined, address?: MaybeHexString) {
    this.account = new AptosAccount(privateKeyBytes, address);
  }

  address(): HexString {
    return this.account.address();
  }

  publicKey(): HexString {
    return this.account.pubKey();
  }

  publicKeyBytes(): Bytes {
    return this.account.pubKey().toUint8Array();
  }

  sign(txn: Transaction): Bytes {
    const txnBuilder = new TransactionBuilderEd25519((message: TxnBuilderTypes.SigningMessage) => {
      return this.signFn(message);
    }, this.publicKey().toUint8Array());
    return txnBuilder.sign(txn.raw);
  }

  signFn(message: TxnBuilderTypes.SigningMessage) {
    const sig = this.account.signBuffer(message);
    return new TxnBuilderTypes.Ed25519Signature(sig.toUint8Array());
  }

  getSigData(txn: Transaction): [signing: TxnBuilderTypes.SigningMessage, signature: TxnBuilderTypes.Ed25519Signature[]] {
    const signingMessage = txn.getSigningMessage();
    const sig = this.signFn(signingMessage);
    return [signingMessage, [sig]];
  }
}
