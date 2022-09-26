import {ApiError, BCS, HexString} from "aptos";
import * as Aptos from "../web3/global";
import {
  DEPLOYER_HS,
  FUNCTIONS,
  MODULES,
  RESOURCES,
  vector,
  HexStr,
} from "./common";
import {Account} from "../web3/account";
import {AptosEntryTxnBuilder} from "../web3/transaction";
import {formatAddress} from "../utils/parse";

// Data in registry
type OwnerMomentumSafes = {
  public_key: string,
  pendings: vector<HexStr>,
  msafes: vector<HexStr>,
}

export class Registry {

  static async getRegistryData(
    address: HexString
  ): Promise<{
    publicKey: HexString,
    pendings: HexString[],
    msafes: HexString[]
  }> {
    const res = await Aptos.getAccountResource(address, RESOURCES.REGISTRY);
    if (!res) {
      throw new Error(`Address not registered in momentum safe: ${address}`);
    }
    const ownedMSafes = res.data as OwnerMomentumSafes;
    return {
      publicKey: HexString.ensure(ownedMSafes.public_key),
      pendings: ownedMSafes.pendings.map( (addr) => formatAddress(addr)),
      msafes:  ownedMSafes.msafes.map( (addr) => formatAddress(addr) ),
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
      res = await Aptos.getAccountResource(address, RESOURCES.REGISTRY);
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
      .addr(DEPLOYER_HS)
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
}