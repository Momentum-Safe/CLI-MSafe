import {AptosClient, BCS, HexString, TxnBuilderTypes} from 'aptos';
import {SimpleMap, DEPLOYER, DEPLOYER_HS, assembleSignatures, checkDuplicatePubKeys} from './common';
import {Transaction} from "../common/types";
import * as Aptos from "../web3/global";
import {AptosEntryTxnBuilder} from "../web3/txnBuilder";
import {} from "./common";
import {Account} from "../web3/account";
import {computeMultiSigAddress, deriveAddress} from "../common/crypto";
import {Bytes} from "aptos/dist/transaction_builder/bcs";
import {HexBuffer} from "./common";


const CreatorModule = 'Creator';
const CreatorResourceType = `${DEPLOYER}::${CreatorModule}::PendingMultiSigCreations`;
const InitWalletCreationFn = "init_wallet_creation";


// Data stored in creator
type MultiSigCreation = {
  public_keys: string[],
  nonce: number,
  threshold: number,
  txn: CreateWalletTxn
}

type CreateWalletTxn = {
  payload: string,
  signatures: SimpleMap<string>,
}

type PendingMultiSigCreations = {
  nonces: SimpleMap<number>,
  creations: SimpleMap<MultiSigCreation>
};

export class CreationHelper {
  address: HexString;
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;

  constructor(
    readonly ownerPubKeys: HexString[],
    readonly threshold: number,
    readonly nonce: number,
    readonly initBalance?: bigint,
    ){
    checkDuplicatePubKeys(ownerPubKeys);
    if (threshold > ownerPubKeys.length) {
      throw new Error("threshold is bigger than number of owners");
    }
    [this.rawPublicKey,, this.address] = computeMultiSigAddress(ownerPubKeys, threshold, nonce);
  }

  static async fromPendingCreation(addr: HexString, initBalance: number): Promise<CreationHelper> {
    const creation = await CreationHelper.getMSafeCreation(addr);
    if (!creation) {
      throw new Error("cannot get creation data");
    }

    const threshold = creation.threshold;
    const nonce = creation.nonce;
    const ownerPubKeys = creation.public_keys;
    const owners = ownerPubKeys.map( pk => HexString.ensure(pk));
    return new CreationHelper(owners, threshold, nonce);
  }

  async initCreation(signer: Account) {
    // Sign on the multi-sig transaction
    const tx = await this.makeMSafeRegisterTxn(this.address, 'Wallet test');
    const [payload, [sig]] = signer.getSigData(tx);

    // Sign and submit the transaction from the signer
    // TODO: corner case when the threshold is not 0
    const tx2 = await this.makeInitCreationTxn(signer.address(), payload, sig);
    const signedTx2 = signer.sign(tx2);

    return await Aptos.sendSignedTransactionAsync(signedTx2);
  }

  async isReadyToSubmit(extraPubKey: HexString) {
    const creation = await CreationHelper.getMSafeCreation(this.address);
    const payload = creation.txn.payload;
    const sigs = creation.txn.signatures;

    const found = sigs.data.find( entry => entry.key === extraPubKey.hex()) !== undefined;
    let collectedSigs = sigs.data.length;
    if (!found) {
      collectedSigs = collectedSigs + 1;
    }
    return collectedSigs >= this.threshold;
  }

  async submitSignature(signer: Account) {
    const creation = await CreationHelper.getMSafeCreation(this.address);
    const sig = this.signPendingCreation(signer, creation);
    const tx = await this.makeSubmitSignatureTxn(signer, sig);
    const signedTx = signer.sign(tx);
    return await Aptos.sendSignedTransactionAsync(signedTx);
  }

  async assembleAndSubmitTx(acc: Account) {
    const creation = await CreationHelper.getMSafeCreation(this.address);
    const signatures = creation.txn.signatures.data;
    const payload = creation.txn.payload;
    const selfSignature = this.signPendingCreation(acc, creation);

    const multiSignature = assembleSignatures(this.ownerPubKeys, signatures, acc, selfSignature);
    const authenticator = new TxnBuilderTypes.TransactionAuthenticatorMultiEd25519(this.rawPublicKey, multiSignature);
    const signingTx = Transaction.deserialize(HexBuffer(payload));
    const signedTx = new TxnBuilderTypes.SignedTransaction(signingTx.raw, authenticator);
    const bcsTx = BCS.bcsToBytes(signedTx);
    return await Aptos.sendSignedTransactionAsync(bcsTx);
  }

  signPendingCreation(signer: Account, creation: MultiSigCreation): TxnBuilderTypes.Ed25519Signature {
    const payload = Transaction.deserialize(HexBuffer(creation.txn.payload));
    const [, [sig]] = signer.getSigData(payload);
    return sig;
  }

  async makeSubmitSignatureTxn(signer: Account, sig: TxnBuilderTypes.Ed25519Signature) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer.address());
    const txModuleBuilder = new AptosEntryTxnBuilder();
    const index = this.findPkIndex(signer.publicKey());

    return txModuleBuilder
      .contract(DEPLOYER_HS)
      .module(CreatorModule)
      .method('submit_signature')
      .from(signer.address())
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeUint64(index),
        BCS.bcsToBytes(sig),
      ]).build();
  }

  findPkIndex(publicKey: HexString) {
    const index = this.ownerPubKeys.findIndex( pk => pk.hex() === publicKey.hex());
    if (index === -1) {
      throw new Error("cannot find public key");
    }
    return index;
  }

  // Generate transaction for MomentumSafe.register
  async makeMSafeRegisterTxn(from: HexString, metadata: string): Promise<Transaction> {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(from);

    const txModuleBuilder = new AptosEntryTxnBuilder();
    return txModuleBuilder
      .contract(DEPLOYER_HS)
      .module('MomentumSafe')
      .method('register')
      .from(from)
      .chainId(chainID)
      .sequenceNumber(sn)
      .expiration(600)
      .args([BCS.bcsSerializeStr(metadata)])
      .build();
  }

  async makeInitCreationTxn(signer: HexString, payload: TxnBuilderTypes.SigningMessage, signature: TxnBuilderTypes.Ed25519Signature) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer);
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .contract(DEPLOYER_HS)
      .module(CreatorModule)
      .method(InitWalletCreationFn)
      .from(signer)
      .chainId(chainID)
      .maxGas(2000n)
      .sequenceNumber(sn)
      .args([
        this.serializePubKeys(),
        BCS.bcsSerializeU8(this.threshold),
        BCS.bcsSerializeUint64(this.initBalance!),
        BCS.bcsSerializeBytes(payload as Uint8Array),
        BCS.bcsToBytes(signature),
      ])
      .build();
  }

  serializePubKeys(): Bytes {
    const pubKey = (key: HexString) => ({
      serialize(serializer: BCS.Serializer) {
        serializer.serializeBytes(key.toUint8Array());
      }
    });
    const serializer = new BCS.Serializer();
    BCS.serializeVector(this.ownerPubKeys.map(owner => pubKey(owner)), serializer);
    return serializer.getBytes();
  }

  static async getNonce(initiator: HexString): Promise<number> {
    const pendingCreations = await CreationHelper.getResourceData();
    const nonce = pendingCreations.nonces.data.find( entry => entry.key === initiator.hex());
    if (!nonce) {return 0}
    return nonce.value;
  }

  static async getResourceData(): Promise<PendingMultiSigCreations> {
    const res = await Aptos.getAccountResource(DEPLOYER_HS, CreatorResourceType);
    if (!res) {
      throw new Error("Creator contract not initialized");
    }
    return res.data as PendingMultiSigCreations;
  }

  // getMSafeCreation get the current data for mSafe creation
  static async getMSafeCreation(msafeAddr: HexString): Promise<MultiSigCreation> {
    const creations = await CreationHelper.getResourceData();
    const creation = creations.creations.data.find( ({key}) => key === msafeAddr.hex())?.value;
    return creation as MultiSigCreation;
  }
}
