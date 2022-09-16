import {AptosClient, FaucetClient, HexString, BCS, ApiError} from 'aptos';
import {Account} from "./account";

let APTOS: AptosClient;
let FAUCET: FaucetClient;
export let MY_ACCOUNT: Account;

const APTOS_COIN_RESOURCE_TYPE = '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>';

interface Config {
  nodeURL: string;
  faucetURL?: string;
  privateKey: string,
  address: string,
}

export async function fundAddress(address: string, amount: number) {
  if (FAUCET === undefined) {
    throw new Error("faucet not set");
  }
  await FAUCET!.fundAccount(address, amount);
}

export function setGlobal(c: Config) {
  APTOS = new AptosClient(c.nodeURL);
  if (c.faucetURL) {
    if (c.faucetURL.endsWith('/')) {
      c.faucetURL = c.faucetURL.substring(0, c.faucetURL.length - 1);
    }
    FAUCET = new FaucetClient(c.nodeURL, c.faucetURL);
  }
  MY_ACCOUNT = new Account(HexString.ensure(c.privateKey).toUint8Array(), c.address);
}

export function setMyAccount(privateKey: string, address: string) {
  MY_ACCOUNT = new Account(HexString.ensure(privateKey).toUint8Array(), address);
}

export async function getSequenceNumber(address: HexString | string): Promise<number> {
  let res: any;
  try {
    res = await APTOS.getAccount(address instanceof HexString ? address : HexString.ensure(address));
  } catch (e) {
    if (e instanceof ApiError && e.message.includes("Resource not found")) {
      return 0;
    }
    throw e;
  }
  return parseInt(res.sequence_number);
}


export async function getChainId(): Promise<number> {
  return await APTOS.getChainId();
}


export async function sendSignedTransactionAsync(message: BCS.Bytes) {
  return await APTOS.submitSignedBCSTransaction(message as Uint8Array);
}


export async function waitForTransaction(txnHash: string) {
  await APTOS.waitForTransaction(txnHash);
  const tx = (await APTOS.getTransactionByHash(txnHash)) as any;
  if (!tx.success) {
    console.log('tx failed', tx);
    throw tx.vm_status;
  }
  return tx;
}

export async function getAccount(addr: HexString) {
  return await APTOS.getAccount(addr);
}

export async function getAccountResource(addr: HexString, resourceTag: string) {
  return APTOS.getAccountResource(addr, resourceTag);
}

export async function getBalance(addr: string | HexString): Promise<number> {
  const address = addr instanceof HexString ? addr : HexString.ensure(addr);
  const resources = await APTOS.getAccountResources(address);
  const coinResource = resources.find((r) => r.type == APTOS_COIN_RESOURCE_TYPE);
  return parseInt((coinResource?.data as any).coin.value);
}
