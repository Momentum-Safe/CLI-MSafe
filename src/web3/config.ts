import {DEPLOYED} from '../../deployed';
import {HexString} from "aptos";

export enum Network {
  Unknown = 'unknown',
  Mainnet = 'mainnet',
  Testnet = 'testnet',
  Devnet = 'devnet',
  Localnet = 'localnet',
}

const DEVNET_NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const DEVNET_FAUCET_URL = 'https://faucet.devnet.aptoslabs.com';

const TESTNET_NODE_URL = 'https://fullnode.testnet.aptoslabs.com/v1';
const TESTNET_FAUCET_URL = 'https://faucet.testnet.aptoslabs.com';

const LOCAL_NODE_URL = 'http://127.0.0.1:8080';
const LOCAL_FAUCET_URL = 'http://127.0.0.1:8000';


export function getDeployedAddrFromNodeURL(nodeURL: string): HexString {
  type ObjectKey = keyof typeof DEPLOYED;
  const network = getNetworkFromNodeURL(nodeURL) as ObjectKey;
  return HexString.ensure(DEPLOYED[network] as string);
}

export function getNetworkFromNodeURL(nodeURL: string): Network {
  if (isDevnet(nodeURL)) {
    return Network.Devnet;
  }
  if (isTestnet(nodeURL)) {
    return Network.Testnet;
  }
  if (isLocalnet(nodeURL)) {
    return Network.Localnet;
  }
  return Network.Unknown;
}

function isDevnet(nodeURL: string) {
  return nodeURL === DEVNET_NODE_URL || nodeURL.toLowerCase().includes('devnet');
}

function isTestnet(nodeURL: string) {
  return nodeURL === TESTNET_NODE_URL || nodeURL.toLowerCase().includes('testnet');
}

function isLocalnet(nodeURL: string) {
  return nodeURL === LOCAL_NODE_URL || nodeURL.toLowerCase().includes('localnet');
}
