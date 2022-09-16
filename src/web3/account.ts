import {AptosAccount, HexString, MaybeHexString, TransactionBuilderEd25519, TxnBuilderTypes} from "aptos";
import {Bytes} from "aptos/dist/transaction_builder/bcs";
import {Transaction} from "./types";
import {AptosEntryTxnBuilder} from "./txnBuilder";
import {MY_ACCOUNT} from "./global";


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

  getSigData(txn: Transaction): [signing: TxnBuilderTypes.SigningMessage, signature: TxnBuilderTypes.Ed25519Signature] {
    const signingMessage = txn.getSigningMessage();
    const sig = this.signFn(signingMessage);
    return [signingMessage, sig];
  }
}


function test() {
  const multiSigTx: TxnBuilderTypes.RawTransaction = (new AptosEntryTxnBuilder())
    .module('deployer::creator')
    .function('register').args([]).build();

  const payload = multiSigTx.raw.getSigningMessage();
  const sig = window.martian.signTransaction(multiSigTx.raw);

  const myTx = msafe.makeInitCreationTxn(window.martian.account.address, payload, sig);
  await window.martian.SignAndSubmit(myTx);
}

function follower() {
  const payload = getFromBlockchain();
  const multiTx = Transaction.deserialize(payload);
  const sig = window.martian.signTransaction(multiTx.raw);

  const myTx = msafe.makeSubmitSignatureTxn(window.martian.account.address, sig);
  await window.martian.SignAndSubmit(window.martian.account, myTx);
}