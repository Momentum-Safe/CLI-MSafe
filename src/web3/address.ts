import {AptosAccount, HexString, MaybeHexString, TransactionBuilderEd25519, TxnBuilderTypes} from "aptos";
import {Bytes} from "aptos/dist/transaction_builder/bcs";
import * as SHA3 from "js-sha3";


export class SimpleAddressImpl implements SimpleAddress {

  _publicKey: HexString;
  _authKey: HexString;
  _accountAddress: HexString;

  constructor(publicKey: MaybeHexString) {
    const pub = HexString.ensure(publicKey);
    this._publicKey = pub;
    this._authKey = this.computeAuthKey(pub);
    this._accountAddress = HexString.ensure(this._authKey.hex());
  }

  computeAuthKey(publicKey: HexString): HexString {
    const hash = SHA3.sha3_256.create();
    hash.update(publicKey.toBuffer());
    hash.update("\x00");
    return new HexString(hash.hex());
  }

  address(): HexString {
    return this._accountAddress;
  }

  publicKey(): HexString {
    return this._publicKey;
  }

  publicKeyBytes(): Bytes {
    return this._publicKey.toUint8Array();
  }
}