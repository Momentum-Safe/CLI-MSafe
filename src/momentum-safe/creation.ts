import { BCS, HexString, TxnBuilderTypes } from 'aptos';
import {
  SimpleMap,
  Table,
  DEPLOYER_HS,
  MODULES,
  FUNCTIONS,
  RESOURCES,
  MAX_NUM_OWNERS,
  assembleMultiSigTxn,
  serializeOwners,
  hasDuplicateAddresses,
  vector,
} from './common';
import { assembleMultiSig } from "./sig-helper";
import * as Aptos from "../web3/global";
import { AptosEntryTxnBuilder, Transaction } from "../web3/transaction";
import { Account } from "../web3/account";
import { computeMultiSigAddress } from "../web3/crypto";
import { HexBuffer } from "../utils/buffer";
import { MultiSigHelper } from "./sig-helper";
import { Registry } from "./registry";
import { makeMSafeRegisterTx } from "./msafe-txn";
import { formatAddress } from "../utils/parse";
import { isHexEqual } from "../utils/check";


// Data stored in creator

type PendingMultiSigCreations = {
  nonces: Table<string, vector<string>>, // nonce=>[txids...]
  creations: Table<string, MultiSigCreation> // hash=>MultiSigCreation
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
   *      const ch = CreationHelper.fromUserRequest(owners, threshold, initBalance);
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

  protected constructor(
    readonly owners: HexString[],
    readonly ownerPubKeys: HexString[],
    readonly threshold: number,
    readonly creationNonce: number,
    readonly initBalance?: bigint,
  ) {
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
    [this.rawPublicKey, , this.address] = computeMultiSigAddress(ownerPubKeys, threshold, creationNonce);
  }

  // Create the momentum safe creation from resource data
  static async fromPendingCreation(addr: HexString): Promise<CreationHelper> {
    addr = formatAddress(addr);
    const creation = await CreationHelper.getMSafeCreation(addr);
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
    owners = owners.map(owner => formatAddress(owner));
    return new CreationHelper(owners, pubKeys, threshold, creationNonce, initBalance);
  }

  async initCreation(signer: Account) {
    let creation: MultiSigCreation | undefined;
    try {
      creation = await this.getResourceData();
    } catch (e) {
      if (e instanceof Error && e.message.includes("Table Item not found by Table handle")) {
        // Expected behavior. We do not expect creation data at this stage
      } else {
        throw e;
      }
    }
    if (creation) {
      throw new Error("Momentum Safe already initiated creation");
    }

    // Sign on the multi-sig transaction
    // TODO: expose the metadata
    const txArg = { metadata: 'Momentum Safe' };
    const options = { sequenceNumber: 0n };
    const tx = await makeMSafeRegisterTx(this.address, txArg, options);
    const [payload, sig] = signer.getSigData(tx);

    // Sign and submit the transaction from the signer
    const tx2 = await this.makeInitCreationTxn(signer.address(), payload, sig);
    const signedTx2 = signer.sign(tx2);

    return await Aptos.sendSignedTransactionAsync(signedTx2);
  }

  // TODO: change to address
  async collectedSignatures(): Promise<HexString[]> {
    const creation = await this.getResourceData();
    const sigs = creation.txn.signatures.data;
    return sigs.map(entry => HexString.ensure(entry.key));
  }

  async isReadyToSubmit(extraPubKey?: HexString) {
    const creation = await this.getResourceData();
    const sigs = creation.txn.signatures;
    const msHelper = new MultiSigHelper(this.ownerPubKeys, sigs);
    let collectedSigs = sigs.data.length;

    // Total number signatures is existing signatures plus 1 if extra public key
    // is not in existing signs.
    if (extraPubKey) {
      if (!msHelper.isSigSubmitted(extraPubKey)) {
        collectedSigs = collectedSigs + 1;
      }
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
    const index = this.ownerPubKeys.findIndex(pk => isHexEqual(pk, publicKey));
    if (index === -1) {
      throw new Error("cannot find public key");
    }
    return index;
  }

  private async makeInitCreationTxn(signer: HexString, payload: TxnBuilderTypes.SigningMessage, signature: TxnBuilderTypes.Ed25519Signature) {
    if (!this.initBalance) {
      throw new Error("init balance not specified for init creation");
    }

    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer);
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .addr(DEPLOYER_HS)
      .module(MODULES.CREATOR)
      .method(FUNCTIONS.CREATOR_INIT_WALLET)
      .from(signer)
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([
        serializeOwners(this.owners),
        BCS.bcsSerializeU8(this.threshold),
        BCS.bcsSerializeUint64(this.initBalance),
        BCS.bcsSerializeBytes(payload as Uint8Array),
        BCS.bcsToBytes(signature),
      ])
      .build();
  }

  private static async getPublicKeysFromRegistry(addrs: HexString[]) {
    return Promise.all(
      addrs.map(addr => Registry.getRegisteredPublicKey(addr))
    );
  }


  private static async getNonce(initiator: HexString): Promise<number> {
    const pendingCreations = await CreationHelper.getResourceData();
    const nonce = await CreationHelper.queryNonces(pendingCreations, initiator);
    return Number(nonce);
  }

  // debug only
  async getResourceData() {
    return await CreationHelper.getMSafeCreation(this.address);
  }

  // getMSafeCreation get the current data for mSafe creation
  private static async getMSafeCreation(msafeAddr: HexString): Promise<MultiSigCreation> {
    const creations = await CreationHelper.getResourceData();
    return CreationHelper.queryMultiSigCreation(creations, msafeAddr);
  }

  static async getResourceData(): Promise<PendingMultiSigCreations> {
    const res = await Aptos.getAccountResource(DEPLOYER_HS, RESOURCES.CREATOR);
    if (!res) {
      throw new Error("Creator contract not initialized");
    }
    return res.data as PendingMultiSigCreations;
  }

  static async queryMultiSigCreation(creations: PendingMultiSigCreations, msafeAddr: HexString): Promise<MultiSigCreation> {
    const creation = await Aptos.client().getTableItem(creations.creations.handle, {
      key_type: 'address',
      value_type: RESOURCES.CREATOR_CREATION,
      key: msafeAddr.noPrefix(),
    });
    return creation;
  }

  static async queryNonces(creations: PendingMultiSigCreations, initiator: HexString): Promise<string> {
    const nonce = await Aptos.client().getTableItem(creations.nonces.handle, {
      key_type: 'address',
      value_type: 'u64',
      key: initiator.noPrefix(),
    }).catch(e => {
      if (e.errorCode == 'table_item_not_found') return '0';
      throw e;
    });
    return nonce;
  }
}
