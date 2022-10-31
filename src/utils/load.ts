import {loadAptosYaml, setGlobal} from "../web3/global";
import {HexString} from "aptos";

export enum Network {
  Custom = 'custom',
  Mainnet = 'mainnet',
  Testnet = 'testnet',
  Devnet = 'devnet',
  Localnet = 'localnet',
}

export const DEFAULT_ENDPOINT = "default"; // Default to read the endpoint from the yaml file
export const DEFAULT_FAUCET = "default"; // Default to read the endpoint from the yaml file

export const DEFAULT_NETWORK = "default"; // Default to mainnet
export const DEFAULT_MSAFE = "default"; // Automatically get from network

export const DEPLOYED_MSAFE = new Map<string, string>([
  ["testnet", "0x74f14286e43d27ed0acc0c4548a5be99a7c2af3cf17a1344c87b7f026b2fcc23"],
  ["devnet", "0x74f14286e43d27ed0acc0c4548a5be99a7c2af3cf17a1344c87b7f026b2fcc23"],
  ["mainnet", "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"],
]);

export const DEVNET_NODE_URL = 'https://rpc.devnet.aptos.fernlabs.xyz/v1';
export const DEVNET_FAUCET_URL = 'https://faucet.devnet.aptoslabs.com';

export const TESTNET_NODE_URL = 'https://rpc.testnet.aptos.fernlabs.xyz/v1';
export const TESTNET_FAUCET_URL = 'https://faucet.testnet.aptoslabs.com';

export const MAINNET_NODE_URL = "https://rpc.mainnet.aptos.fernlabs.xyz/v1";
export const MAINNET_FAUCET_URL = "_";

export const LOCAL_NODE_URL = 'http://127.0.0.1:8080';
export const LOCAL_FAUCET_URL = 'http://127.0.0.1:8081';


type loadConfig = {
  configFilePath: string,
  profile: string,
  network: string,
  endpoint: string,
  faucet: string,
  msafeDeployer: string,
}

export async function loadConfigAndApply(c: loadConfig) {
  const config = await parseConfig(c);
  await setGlobal(config);
}

export async function parseConfig(c: loadConfig) {
  const profile = await loadProfile(c);

  const network = getNetwork(c);
  const endpoint = getEndpoint(c, network);
  const faucet = getFaucet(c, network);
  const msafe = getMSafeAddress(c, network);

  if (!checkNetworkMatchEndpoint(network, endpoint)) {
    throw Error(`Network does match the endpoint: ${network}/${endpoint}`);
  }

  return {
    nodeURL: endpoint,
    faucetURL: faucet,
    privateKey: profile.private_key,
    address: profile.account,
    network: c.network,
    msafe: msafe,
  };
}

async function loadProfile(c: loadConfig) {
  let yaml: any;
  try {
    yaml = await loadAptosYaml(c.configFilePath);
  } catch (e) {
    printSetupWalletMsg();
    process.exit(1);
  }
  const profile = yaml.profiles[c.profile];
  if (!profile) {
    console.log(`cannot find profile ${c.profile}`);
    process.exit(1);
  }
  return profile;
}

function getNetwork(c: loadConfig) {
  if (c.network === DEFAULT_NETWORK) {
    return Network.Mainnet;
  }
  return c.network;
}

// First get the endpoint from config, then from network, lastly from yaml profiles
function getEndpoint(c: loadConfig, network: string) {
  if (!c.endpoint || c.endpoint === DEFAULT_ENDPOINT) {
    return getEndpointFromNetwork(network);
  } else {
    return c.endpoint;
  }
}

function getEndpointFromNetwork(network: string) {
  if (network === Network.Mainnet) {
    return MAINNET_NODE_URL;
  }
  if (network === Network.Testnet) {
    return TESTNET_NODE_URL;
  }
  if (network === Network.Devnet) {
    return DEVNET_NODE_URL;
  }
  if (network === Network.Localnet) {
    return LOCAL_NODE_URL;
  }
  throw Error(`unknown network: ${network}`);
}

function getFaucet(c: loadConfig, network: string) {
  if (!c.faucet || c.faucet === DEFAULT_FAUCET) {
    return getFaucetFromNetwork(network);
  } else {
    let faucet: string;
    if (c.faucet.endsWith('/')) {
      faucet = c.faucet.substring(0, c.faucet.length - 1);
    } else {
      faucet = c.faucet;
    }
    return faucet;
  }
}

function getFaucetFromNetwork(network: string) {
  if (network === Network.Mainnet) {
    return MAINNET_FAUCET_URL;
  }
  if (network === Network.Testnet) {
    return TESTNET_FAUCET_URL;
  }
  if (network === Network.Devnet) {
    return DEVNET_FAUCET_URL;
  }
  if (network === Network.Localnet) {
    return LOCAL_FAUCET_URL;
  }
  throw undefined;
}

function checkNetworkMatchEndpoint(network: string, endpoint: string): boolean {
  const impliedNetwork = inferNetworkFromURL(endpoint);
  return !(impliedNetwork && impliedNetwork != network);
}

function inferNetworkFromURL(nodeURL: string) {
  if (isDevnet(nodeURL)) {
    return Network.Devnet;
  }
  if (isTestnet(nodeURL)) {
    return Network.Testnet;
  }
  if (isLocalnet(nodeURL)) {
    return Network.Localnet;
  }
  if (isMainnet(nodeURL)) {
    return Network.Mainnet;
  }
  return undefined;
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

function isMainnet(nodeURL: string) {
  return nodeURL.toLowerCase().includes('mainnet');
}

function getMSafeAddress(c: loadConfig, network: string) {
  if (!c.msafeDeployer || c.msafeDeployer === DEFAULT_MSAFE) {
    return getDefaultMSafeAddr(network as Network);
  }
  return HexString.ensure(c.msafeDeployer);
}

function getDefaultMSafeAddr(network: Network): HexString {
  if (!DEPLOYED_MSAFE.has(network)) {
    throw Error(`Deployed MSafe not found for the target network: ${network}`);
  }
  return HexString.ensure(DEPLOYED_MSAFE.get(network) as string);
}


function printSetupWalletMsg() {
  console.log('');
  console.log("Have you set up your Aptos address? Run the following command to setup your wallet\n");
  console.log("\taptos init\n");
  process.exit(1001);
}


