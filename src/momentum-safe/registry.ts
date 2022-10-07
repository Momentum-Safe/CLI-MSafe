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
import { TEd25519PublicKey, Vector } from "../moveTypes/moveTypes";

// Data in registry

export type OwnerMomentumSafes = {
  public_key: TEd25519PublicKey,
  pendings: Vector<Types.Address>,
  msafes: Vector<Types.Address>
};

export type RegisterEvent = {
  events: EventHandle<OwnerMomentumSafes>
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
    return {
      publicKey: HexString.ensure(ownedMSafes.public_key),
      pendings: ownedMSafes.pendings.map((addr) => formatAddress(addr)),
      msafes: ownedMSafes.msafes.map((addr) => formatAddress(addr)),
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

  static async getRegisterEvent(owner: HexString): Promise<RegisterEvent> {
    const eventStruct = await Aptos.getAccountResource(owner, getStructType('REGISTRY_EVENT').toMoveStructTag());
    return eventStruct.data as any;
  }

  static async filterRegisterEvent(eventStruct: RegisterEvent, option: PaginationArgs) {
    return Aptos.filterEvent(eventStruct.events, option);
  }

}