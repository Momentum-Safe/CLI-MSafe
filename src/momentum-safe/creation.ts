import {BCS, HexString, TxnBuilderTypes} from 'aptos';
import {
  SimpleMap,
  DEPLOYER_HS,
  hasDuplicateAddresses,
  MODULES,
  FUNCTIONS,
  RESOURCES,
  MAX_NUM_OWNERS, assembleMultiSigTxn,
} from './common';
import {assembleMultiSig} from "./sig-helper";
import {Transaction} from "../web3/types";
import * as Aptos from "../web3/global";
import {AptosEntryTxnBuilder} from "../web3/transaction";
import {Account} from "../web3/account";
import {computeMultiSigAddress} from "../web3/crypto";
import {HexBuffer} from "./common";
import {MultiSigHelper} from "./sig-helper";
import {Registry} from "./registry";


// Data stored in creator

type PendingMultiSigCreations = {
  nonces: SimpleMap<number>,
  creations: SimpleMap<MultiSigCreation>
};

type MultiSigCreation = {
  owners: string[],
  public_keys: string[],
  nonce: number,
  threshold: number,
  txn: CreateWalletTxn,
}

type CreateWalletTxn = {
  payload: string,
  signatures: SimpleMap<string>,
}

export class CreationHelper {
  /**
   * CreationHelper is the helper for momentum safe creation process.
   * Each CreationHelper is used for creation for one momentum safe wallet.
   * The class can be initialized with to methods:
   *   1. Directly through constructor. This shall be used when initializing
   *      a new momentum safe.
   *
   *      ```ts
   *      const ch = new CreationHelper(ownerPubKeys, threshold, creationNonce, initBalance);
   *      ```
   *
   *   2. By reading momentum safe data from the MOVE resources with the address.
   *
   *      ```ts
   *      const ch = MomentumSafe.fromPendingCreation(addr);
   *      ```
   **/
  address: HexString;
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;

  constructor(
    readonly owners: HexString[],
    readonly ownerPubKeys: HexString[],
    readonly threshold: number,
    readonly creationNonce: number,
    readonly initBalance?: bigint,
  ){
    // Input parameter checks
    if (owners.length != ownerPubKeys.length) {
      throw new Error("owner length does nt match public keys");
    }
    if (threshold <= 0) {
      throw new Error("threshold is must be greater than 0");
    }
    if (threshold > owners.length) {
      throw new Error("threshold is bigger than number of owners");
    }
    if (hasDuplicateAddresses(owners)) {
      throw new Error("has duplicate addresses");
    }
    if (owners.length > MAX_NUM_OWNERS) {
      throw new Error(`momentum safe supports up to ${MAX_NUM_OWNERS} owners`);
    }
    // Compute for multi-ed25519 public key and address
    [this.rawPublicKey,, this.address] = computeMultiSigAddress(ownerPubKeys, threshold, creationNonce);
  }

  // Create the momentum safe creation from resource data
  static async fromPendingCreation(addr: HexString): Promise<CreationHelper> {
    const creation = await CreationHelper.getMSafeCreation(addr);
    if (!creation) {
      throw new Error("cannot get creation data");
    }
    const threshold = creation.threshold;
    const nonce = creation.nonce;
    const owners = creation.owners.map(addr => HexString.ensure(addr));
    const ownerPubKeys = creation.public_keys.map(pk => HexString.ensure(pk));
    return new CreationHelper(owners, ownerPubKeys, threshold, nonce);
  }

  // A new momentum safe creation request from user calls.
  static async fromUserRequest(
    owners: HexString[],
    threshold: number,
    initBalance: bigint,
  ): Promise<CreationHelper> {
    const pubKeys = await CreationHelper.getPublicKeysFromRegistry(owners);
    const creationNonce = await CreationHelper.getNonce(owners[0]);
    return new CreationHelper(owners, pubKeys, creationNonce, threshold, initBalance);
  }

  async initCreation(signer: Account) {
    const creation = await this.getResourceData();
    if (creation !== undefined) {
      throw new Error("creation already in progress");
    }
    // Sign on the multi-sig transaction
    const tx = await this.makeMSafeRegisterTxn(this.address, 'Wallet test');
    const [payload, sig] = signer.getSigData(tx);

    // Sign and submit the transaction from the signer
    // TODO: corner case when the threshold is not 0
    const tx2 = await this.makeInitCreationTxn(signer.address(), payload, sig);
    const signedTx2 = signer.sign(tx2);

    return await Aptos.sendSignedTransactionAsync(signedTx2);
  }

  async collectedSignatures(): Promise<HexString[]> {
    const creation = await this.getResourceData();
    const sigs = creation.txn.signatures.data;
    return sigs.map( entry => HexString.ensure(entry.key));
  }

  async isReadyToSubmit(extraPubKey: HexString) {
    const creation = await this.getResourceData();
    const sigs = creation.txn.signatures;
    const msHelper = new MultiSigHelper(this.ownerPubKeys, sigs);
    const found = msHelper.findIndex(extraPubKey) !== -1;

    // Total number signatures is existing signatures plus 1 if extra public key
    // is not in existing signs.
    let collectedSigs = sigs.data.length;
    if (!found) {
      collectedSigs = collectedSigs + 1;
    }
    return collectedSigs >= this.threshold;
  }

  async submitSignature(signer: Account) {
    const creation = await this.getResourceData();
    const sig = this.signPendingCreation(signer, creation);
    const tx = await this.makeSubmitSignatureTxn(signer, sig);
    const signedTx = signer.sign(tx);
    return await Aptos.sendSignedTransactionAsync(signedTx);
  }

  async assembleAndSubmitTx(acc: Account) {
    const creation = await CreationHelper.getMSafeCreation(this.address);
    const signatures = creation.txn.signatures;
    const payload = creation.txn.payload;

    const extraSig = this.signPendingCreation(acc, creation);

    const multiSignature = assembleMultiSig(this.ownerPubKeys, signatures, acc, extraSig);
    const bcsTx = assembleMultiSigTxn(payload, this.rawPublicKey, multiSignature);
    return await Aptos.sendSignedTransactionAsync(bcsTx);
  }

  private signPendingCreation(
    signer: Account,
    creation: MultiSigCreation
  ): TxnBuilderTypes.Ed25519Signature {
    const payload = Transaction.deserialize(HexBuffer(creation.txn.payload));
    const [, sig] = signer.getSigData(payload);
    return sig;
  }

  private async makeSubmitSignatureTxn(signer: Account, sig: TxnBuilderTypes.Ed25519Signature) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer.address());
    const txModuleBuilder = new AptosEntryTxnBuilder();
    const index = this.findPkIndex(signer.publicKey());

    return txModuleBuilder
      .addr(DEPLOYER_HS)
      .module(MODULES.CREATOR)
      .method(FUNCTIONS.CREATOR_SUBMIT_SIG)
      .from(signer.address())
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeUint64(index),
        BCS.bcsToBytes(sig),
      ]).build();
  }

  private findPkIndex(publicKey: HexString) {
    const index = this.ownerPubKeys.findIndex( pk => pk.hex() === publicKey.hex());
    if (index === -1) {
      throw new Error("cannot find public key");
    }
    return index;
  }

  // Generate transaction for MomentumSafe.register
  private async makeMSafeRegisterTxn(from: HexString, metadata: string): Promise<Transaction> {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(from);

    const txModuleBuilder = new AptosEntryTxnBuilder();
    return txModuleBuilder
      .addr(DEPLOYER_HS)
      .module(MODULES.MOMENTUM_SAFE)
      .method(FUNCTIONS.MSAFE_REGISTER)
      .from(from)
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([BCS.bcsSerializeStr(metadata)])
      .build();
  }

  private async makeInitCreationTxn(signer: HexString, payload: TxnBuilderTypes.SigningMessage, signature: TxnBuilderTypes.Ed25519Signature) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer);
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .addr(DEPLOYER_HS)
      .module(MODULES.CREATOR)
      .method(FUNCTIONS.CREATOR_INIT_WALLET)
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

  private static async getPublicKeysFromRegistry(addrs: HexString[]) {
    return Promise.all(
      addrs.map( addr => Registry.getRegisteredPublicKey(addr))
    );
  }

  private serializePubKeys(): BCS.Bytes {
    const pubKey = (key: HexString) => ({
      serialize(serializer: BCS.Serializer) {
        serializer.serializeBytes(key.toUint8Array());
      }
    });
    const serializer = new BCS.Serializer();
    BCS.serializeVector(this.ownerPubKeys.map(owner => pubKey(owner)), serializer);
    return serializer.getBytes();
  }

  private static async getNonce(initiator: HexString): Promise<number> {
    const pendingCreations = await CreationHelper.getResourceData();
    const nonce = pendingCreations.nonces.data.find( entry => entry.key === initiator.hex());
    if (!nonce) {return 0}
    return nonce.value;
  }

  private async getResourceData() {
    return await CreationHelper.getMSafeCreation(this.address);
  }

  // getMSafeCreation get the current data for mSafe creation
  private static async getMSafeCreation(msafeAddr: HexString): Promise<MultiSigCreation> {
    const creations = await CreationHelper.getResourceData();
    const creation = creations.creations.data.find( ({key}) => key === msafeAddr.hex())?.value;
    return creation as MultiSigCreation;
  }

  private static async getResourceData(): Promise<PendingMultiSigCreations> {
    const res = await Aptos.getAccountResource(DEPLOYER_HS, RESOURCES.CREATOR);
    if (!res) {
      throw new Error("Creator contract not initialized");
    }
    return res.data as PendingMultiSigCreations;
  }
}
