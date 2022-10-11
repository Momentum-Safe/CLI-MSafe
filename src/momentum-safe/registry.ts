import { ApiError, BCS, HexString, Types } from "aptos";
import * as Aptos from "../web3/global";
import {
  FUNCTIONS,
  MODULES,
  getStructType,
} from "./common";
import { Account } from "../web3/account";
import { AptosEntryTxnBuilder } from "../web3/transaction";
import { formatAddress } from "../utils/parse";
import { DEPLOYER } from "../web3/global";
import { EventHandle, PaginationArgs } from "../moveTypes/moveEvent";
import { TEd25519PublicKey, Vector, Element, Table, TableWithLength } from "../moveTypes/moveTypes";

// Data in registry

export type TableMap<K,V> = {
  index: Table<K, Types.U64>,
  data: TableWithLength<Types.U64, V>,
}

type OwnerMomentumSafes = {
  public_key: TEd25519PublicKey,
  pendings: TableMap<Types.Address, boolean>,
  msafes: TableMap<Types.Address, boolean>
};
export default OwnerMomentumSafes;

export type OwnerMomentumSafesChangeEvent = {
  public_key: Types.HexEncodedBytes,
  msafe: Types.Address,
  op_type: number,
  pendings_length: Types.U64,
  msafes_length: Types.U64,
}

export type RegisterEvent = {
  events: EventHandle<OwnerMomentumSafesChangeEvent>
}

export class Registry {

  static async getRegistryData(
    address: HexString
  ): Promise<{
    publicKey: HexString,
    pendings: HexString[],
    msafes: HexString[]
  }> {
    const res = await Aptos.getAccountResource(address, getStructType('REGISTRY').toMoveStructTag());
    if (!res) {
      throw new Error(`Address not registered in momentum safe: ${address}`);
    }
    const ownedMSafes = res.data as OwnerMomentumSafes;
    const msafes = await Registry.queryAllMsafes(ownedMSafes);
    return {
      publicKey: HexString.ensure(ownedMSafes.public_key),
      pendings: msafes.pendings.map((addr) => formatAddress(addr)),
      msafes: msafes.msafes.map((addr) => formatAddress(addr)),
    };
  }

  static async getRegisteredPublicKey(address: HexString) {
    const res = await Registry.getRegistryData(address);
    return HexString.ensure(res.publicKey);
  }

  static async isRegistered(address: HexString): Promise<boolean> {
    address = formatAddress(address);
    let res: any;
    try {
      res = await Aptos.getAccountResource(address, getStructType('REGISTRY').toMoveStructTag());
    } catch (e) {
      if (e instanceof ApiError && e.message.includes("Resource not found")) {
        return false;
      }
      throw e;
    }
    return res != undefined;
  }

  static async register(signer: Account) {
    const tx = await this.getRegisterTx(signer);
    const signedTx = signer.sign(tx);
    return await Aptos.sendSignedTransactionAsync(signedTx);
  }

  private static async getRegisterTx(signer: Account) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer.address());
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .addr(DEPLOYER)
      .module(MODULES.REGISTRY)
      .method(FUNCTIONS.REGISTRY_REGISTER)
      .from(signer.address())
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([
        BCS.bcsSerializeBytes(signer.publicKeyBytes()),
      ])
      .build();
  }


  static async queryAllMsafes(ownerMomentumSafes: OwnerMomentumSafes) {
    return {
      pendings: await this.queryAllPendingMsafes(ownerMomentumSafes),
      msafes: await this.queryAllOwnedMsafes(ownerMomentumSafes),
    };
  }

  static async queryAllPendingMsafes(ownerMomentumSafes: OwnerMomentumSafes): Promise<Vector<Types.Address>> {
    const indexes = Object.keys(Array(Number(ownerMomentumSafes.pendings.data.length)).fill(0));
    return Promise.all(indexes.map(index => this.queryPendingMsafe(ownerMomentumSafes, Number(index))));
  }

  static async queryAllOwnedMsafes(ownerMomentumSafes: OwnerMomentumSafes): Promise<Vector<Types.Address>> {
    const indexes = Object.keys(Array(Number(ownerMomentumSafes.msafes.data.length)).fill(0));
    return Promise.all(indexes.map(index => this.queryOwnedMsafe(ownerMomentumSafes, Number(index))));
  }

  static async queryPendingMsafe(ownerMomentumSafes: OwnerMomentumSafes, index: number): Promise<Types.Address> {
    const element = getStructType('REGISTRY_ELEMENT').args(['address', 'bool']);
    const msafe = await Aptos.client().getTableItem(ownerMomentumSafes.pendings.data.inner.handle, {
      key_type: 'u64',
      value_type: element.toString(),
      key: String(index),
    }) as Element<Types.Address, boolean>;
    return msafe.key;
  }

  static async queryOwnedMsafe(ownerMomentumSafes: OwnerMomentumSafes, index: number): Promise<Types.Address> {
    const element = getStructType('REGISTRY_ELEMENT').args(['address', 'bool']);
    const msafe = await Aptos.client().getTableItem(ownerMomentumSafes.msafes.data.inner.handle, {
      key_type: 'u64',
      value_type: element.toString(),
      key: String(index),
    }) as Element<Types.Address, boolean>;
    return msafe.key;
  }

  static async getRegisterEvent(owner: HexString): Promise<RegisterEvent> {
    const eventStruct = await Aptos.getAccountResource(owner, getStructType('REGISTRY_EVENT').toMoveStructTag());
    return eventStruct.data as any;
  }

  static async filterRegisterEvent(eventStruct: RegisterEvent, option: PaginationArgs) {
    return Aptos.filterEvent(eventStruct.events, option);
  }

}