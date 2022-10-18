import { BCS, HexString, TxnBuilderTypes, Types } from 'aptos';
import {
  MODULES,
  FUNCTIONS,
  MAX_NUM_OWNERS,
  assembleMultiSigTxn,
  serializeOwners,
  hasDuplicateAddresses,
  getStructType,
} from './common';
import { assembleMultiSig } from "./sig-helper";
import * as Aptos from "../web3/global";
import {AptosEntryTxnBuilder, Options, Transaction, TxConfig} from "../web3/transaction";
import { Account } from "../web3/account";
import { computeMultiSigAddress } from "../utils/crypto";
import { HexBuffer } from "../utils/buffer";
import { MultiSigHelper } from "./sig-helper";
import { Registry } from "./registry";
import {applyDefaultOptions, makeMSafeRegisterTx} from "./msafe-txn";
import { formatAddress } from "../utils/parse";
import { isHexEqual } from "../utils/check";
import {DEPLOYER, MY_ACCOUNT} from "../web3/global";
import { EventHandle, PaginationArgs } from '../moveTypes/moveEvent';
import { SimpleMap, Table, TEd25519PublicKey, TEd25519Signature, Vector } from '../moveTypes/moveTypes';

export type CreateWalletTxn = {
  payload: Types.HexEncodedBytes,
  signatures: SimpleMap<TEd25519PublicKey, TEd25519Signature>,
}

export type MomentumSafeCreation = {
  owners: Vector<Types.Address>,
  public_keys: Vector<TEd25519PublicKey>,
  nonce: string,
  threshold: number,
  txn: CreateWalletTxn
}

export type PendingMultiSigCreations = {
  nonces: Table<Types.Address, Vector<Types.U64>>,
  creations: Table<Types.Address, MomentumSafeCreation>
};

export type MultiSigCreationEvent = {
  events: EventHandle<MomentumSafeCreation>
};




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
    readonly creationNonce: bigint,
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
    const nonce = BigInt(creation.nonce);
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

  async initCreation(signer: Account, multiOption: Options, singleOption: Options) {
    let creation: MomentumSafeCreation | undefined;
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
    const tx = await makeMSafeRegisterTx(this, txArg, multiOption);
    const [payload, sig] = signer.getSigData(tx);

    // Sign and submit the transaction from the signer
    const tx2 = await this.makeInitCreationTxn(signer, payload, sig, singleOption);
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

  async submitSignature(signer: Account, opts: Options) {
    const creation = await this.getResourceData();
    const sig = this.signPendingCreation(signer, creation);

    const tx = await this.makeSubmitSignatureTxn(signer, sig, opts);

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
    creation: MomentumSafeCreation
  ): TxnBuilderTypes.Ed25519Signature {
    const payload = Transaction.deserialize(HexBuffer(creation.txn.payload));
    const [, sig] = signer.getSigData(payload);
    return sig;
  }

  private async makeSubmitSignatureTxn(signer: Account, sig: TxnBuilderTypes.Ed25519Signature, opts: Options) {
    const txModuleBuilder = new AptosEntryTxnBuilder();
    const pkIndex = this.findPkIndex(signer.publicKey());
    const config = await applyDefaultOptions(signer.address(), opts);

    return txModuleBuilder
      .addr(DEPLOYER)
      .module(MODULES.CREATOR)
      .method(FUNCTIONS.CREATOR_SUBMIT_SIG)
      .from(signer.address())
      .withTxConfig(config)
      .args([
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeU8(pkIndex),
        BCS.bcsToBytes(sig),
      ])
      .build(signer.account);
  }

  private findPkIndex(publicKey: HexString) {
    const index = this.ownerPubKeys.findIndex(pk => isHexEqual(pk, publicKey));
    if (index === -1) {
      throw new Error("cannot find public key");
    }
    return index;
  }

  private async makeInitCreationTxn(
    signer: Account,
    payload: TxnBuilderTypes.SigningMessage,
    signature: TxnBuilderTypes.Ed25519Signature,
    opts?: Options,
  ) {
    if (!this.initBalance) {
      throw new Error("init balance not specified for init creation");
    }
    const config = await applyDefaultOptions(signer.address(), opts);
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .addr(DEPLOYER)
      .module(MODULES.CREATOR)
      .method(FUNCTIONS.CREATOR_INIT_WALLET)
      .from(signer.address())
      .withTxConfig(config)
      .args([
        serializeOwners(this.owners),
        BCS.bcsSerializeU8(this.threshold),
        BCS.bcsSerializeUint64(this.initBalance),
        BCS.bcsSerializeBytes(payload as Uint8Array),
        BCS.bcsToBytes(signature),
      ])
      .build(signer.account);
  }

  private static async getPublicKeysFromRegistry(addrs: HexString[]) {
    return Promise.all(
      addrs.map(addr => Registry.getRegisteredPublicKey(addr))
    );
  }


  private static async getNonce(initiator: HexString): Promise<bigint> {
    const pendingCreations = await CreationHelper.getResourceData();
    const nonce = await CreationHelper.queryNonces(pendingCreations, initiator);
    return BigInt(nonce);
  }

  // debug only
  async getResourceData() {
    return await CreationHelper.getMSafeCreation(this.address);
  }

  // getMSafeCreation get the current data for mSafe creation
  private static async getMSafeCreation(msafeAddr: HexString): Promise<MomentumSafeCreation> {
    const creations = await CreationHelper.getResourceData();
    return CreationHelper.queryMultiSigCreation(creations, msafeAddr);
  }

  static async getResourceData(): Promise<PendingMultiSigCreations> {
    const res = await Aptos.getAccountResource(DEPLOYER, getStructType('CREATOR').toMoveStructTag());
    if (!res) {
      throw new Error("Creator contract not initialized");
    }
    return res.data as PendingMultiSigCreations;
  }

  static async getMultiSigCreationEvent(msafe: HexString): Promise<MultiSigCreationEvent> {
    const eventStruct = await Aptos.getAccountResource(msafe, getStructType('CREATOR_EVENT').toMoveStructTag());
    return eventStruct.data as MultiSigCreationEvent;
  }

  static async queryMultiSigCreation(creations: PendingMultiSigCreations, msafeAddr: HexString): Promise<MomentumSafeCreation> {
    const creation = await Aptos.client().getTableItem(creations.creations.handle, {
      key_type: 'address',
      value_type: getStructType('CREATOR_CREATION').toMoveStructTag(),
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

  // get MultiSigCreationEvent
  static async filterMultiSigCreationEvent(eventStruct: MultiSigCreationEvent, option: PaginationArgs) {
    return Aptos.filterEvent(eventStruct.events, option);
  }
}
