import {
  AptosAccount,
  BCS,
  HexString,
  MaybeHexString,
  TransactionBuilderEd25519,
  TxnBuilderTypes,
} from "aptos";
import { TypeMessage } from "../types/Transaction";
import * as Aptos from "../web3/global";
import { Transaction } from "./transaction";

// SingleWallet is a single-signed wallet account
export class Account {
  account: AptosAccount;

  constructor(
    privateKeyBytes?: Uint8Array | undefined,
    address?: MaybeHexString
  ) {
    this.account = new AptosAccount(privateKeyBytes, address);
  }

  address(): HexString {
    return this.account.address();
  }

  publicKey(): HexString {
    return this.account.pubKey();
  }

  publicKeyBytes(): BCS.Bytes {
    return this.account.pubKey().toUint8Array();
  }

  sign(txn: Transaction): BCS.Bytes {
    const txnBuilder = new TransactionBuilderEd25519(
      (message: TxnBuilderTypes.SigningMessage) => {
        return this.signFn(message);
      },
      this.publicKey().toUint8Array()
    );
    return txnBuilder.sign(txn.raw);
  }

  signFn(message: TxnBuilderTypes.SigningMessage) {
    const sig = this.account.signBuffer(message);
    return new TxnBuilderTypes.Ed25519Signature(sig.toUint8Array());
  }

  getSigData(
    txn: Transaction | TypeMessage
  ): [
    signing: TxnBuilderTypes.SigningMessage,
    signature: TxnBuilderTypes.Ed25519Signature
  ] {
    if (txn instanceof TypeMessage) {
      const signingMessage = txn.getSigningMessage();
      const signature = Aptos.MY_ACCOUNT.account.signBuffer(signingMessage);
      return [
        signingMessage,
        new TxnBuilderTypes.Ed25519Signature(signature.toUint8Array()),
      ];
    } else {
      const signingMessage = txn.getSigningMessage();
      const sig = this.signFn(signingMessage);
      return [signingMessage, sig];
    }
  }
}
