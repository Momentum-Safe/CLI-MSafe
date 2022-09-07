import {AptosClient, FaucetClient, HexString, BCS} from 'aptos';
import * as Gen from 'aptos/src/generated';
import {Account} from "../common/types";

let APTOS: AptosClient;
let FAUCET: FaucetClient;


interface Config {
  nodeURL: string;
  faucetURL?: string;
}

export async function fundAddress(address: string, amount: number) {
  await FAUCET!.fundAccount(address, amount);
}

export function setProvider(c: Config) {
  APTOS = new AptosClient(c.nodeURL);
  if (c.faucetURL) {
    FAUCET = new FaucetClient(c.nodeURL, c.faucetURL);
  }
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
