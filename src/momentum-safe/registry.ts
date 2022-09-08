import {AptosClient, HexString} from "aptos";
import * as Aptos from "../web3/global";
import {DEPLOYER, DEPLOYER_HS, HexStr, vector} from "./common";
import {Account} from "../web3/account";
import {AptosEntryTxnBuilder} from "../web3/txnBuilder";

const RegistryModule = 'Registry';
const RegisterFunction = 'register';
const RegistryResourceType = `${DEPLOYER}::${RegistryModule}::OwnerMomentumSafes`;


// Data in registry
type OwnerMomentumSafes = {
  pendings: vector<HexStr>,
  msafes: vector<HexStr>,
}

export class Registry {

  constructor() {}

  async getOwnedMomentumSafes(address: HexString): Promise<{pendings: HexString[], msafes: HexString[]}> {
    const res = await Aptos.getAccountResource(address, RegistryResourceType);
    if (!res) {
      throw new Error("not registered");
    }
    const ownedMSafes = res.data as OwnerMomentumSafes;
    return {
      pendings: ownedMSafes.pendings.map( (addr) => HexString.ensure(addr)),
      msafes:  ownedMSafes.msafes.map( (addr) => HexString.ensure(addr) ),
    };
  }

  async register(signer: Account): Promise<string> {
    const tx = await this.getRegisterTx(signer);
    const signedTx = signer.sign(tx);
    const res = await Aptos.sendSignedTransactionAsync(signedTx);
    return res.hash;
  }

  async getRegisterTx(signer: Account) {
    const chainID = await Aptos.getChainId();
    const sn = await Aptos.getSequenceNumber(signer.address());
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .contract(DEPLOYER_HS)
      .module(RegistryModule)
      .method(RegisterFunction)
      .from(signer.address())
      .chainId(chainID)
      .sequenceNumber(sn)
      .args([])
      .build();
  }
}