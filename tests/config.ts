// Define the default value for unit test
// TODO: replace with the localhost node.

// Test only config
import {setGlobal} from "../src/web3/global";
import {DEPLOYED_MSAFE} from "../src/utils/load";
import {HexString} from "aptos";

export const NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
export const FAUCET_URL = "https://faucet.devnet.aptoslabs.com/";
export const PRIVATE_KEY = "0x5a0df2184c8c55f4950cdc6907d86735558bdcc4e2de3f03ce93cc934d2dbc5d";
export const ADDRESS = "abca607b56f41f02150914a088e3e2f26a291fe0db092dcad50d71a8d6355020";

export async function init() {
  await setGlobal({
    nodeURL: NODE_URL,
    faucetURL: FAUCET_URL,
    privateKey: PRIVATE_KEY,
    address: ADDRESS,
    network: "devnet",
    msafe: HexString.ensure(DEPLOYED_MSAFE.get("devnet")!),
  });
}