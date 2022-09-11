export enum Network {
  None = 'None',
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet = 'Devnet',
  Localnet = 'localnet',
}

export const DEVNET_NODE_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
export const DEVNET_FAUCET_URL = 'https://faucet.devnet.aptoslabs.com';
export const LOCAL_NODE_URL = 'http://127.0.0.1:8080';
export const LOCAL_FAUCET_URL = 'http://127.0.0.1:8000';


export class Default {
  static getDefaultNodeURL(network: Network) {
    switch (network) {
      case Network.Devnet:
        return DEVNET_NODE_URL;
      case Network.Localnet:
        return LOCAL_NODE_URL;
      default:
        return undefined;
    }
  }

  static getDefaultFaucetURL(network: Network) {
    switch (network) {
      case Network.Devnet:
        return DEVNET_FAUCET_URL;
      case Network.Localnet:
        return LOCAL_FAUCET_URL;
      default:
        return undefined;
    }
  }
}
