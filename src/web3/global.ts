import {AptosClient, FaucetClient, HexString, BCS} from 'aptos';
import * as Gen from 'aptos/src/generated';
import {Account} from "./account";

let APTOS: AptosClient;
let FAUCET: FaucetClient;
export let MY_ACCOUNT: Account;


interface Config {
  nodeURL: string;
  faucetURL?: string;
  privateKey: string,
  address: string,
}

export async function fundAddress(address: string, amount: number) {
  await FAUCET!.fundAccount(address, amount);
}

export function setGlobal(c: Config) {
  APTOS = new AptosClient(c.nodeURL);
  if (c.faucetURL) {
    FAUCET = new FaucetClient(c.nodeURL, c.faucetURL);
  }
  MY_ACCOUNT = new Account(HexString.ensure(c.privateKey).toUint8Array(), c.address);
}

export function setMyAccount(privateKey: string, address: string) {
  MY_ACCOUNT = new Account(HexString.ensure(privateKey).toUint8Array(), address);
}

export async function getSequenceNumber(address: HexString | string): Promise<number> {
  const res = await APTOS.getAccount(address instanceof HexString ? address : HexString.ensure(address));
  return parseInt(res.sequence_number);
}


export async function getChainId(): Promise<number> {
  return await APTOS.getChainId();
}


export async function sendSignedTransactionAsync(message: BCS.Bytes): Promise<Gen.PendingTransaction> {
  return await APTOS.submitSignedBCSTransaction(message as Uint8Array);
}


export async function waitForTransaction(txnHash: string): Promise<Gen.Transaction_UserTransaction> {
  await APTOS.waitForTransaction(txnHash);
  const tx = (await APTOS.getTransactionByHash(txnHash)) as Gen.Transaction_UserTransaction;
  if (!tx.success) {
    console.log('tx failed', tx);
    throw tx.vm_status;
  }
  return tx;
}

export async function getAccountResource(addr: HexString, resourceTag: string): Promise<Gen.MoveResource> {
  return APTOS.getAccountResource(addr, resourceTag);
}
