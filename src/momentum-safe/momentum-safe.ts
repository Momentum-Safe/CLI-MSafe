import * as Aptos from "../web3/global";
import {HexString, TxnBuilderTypes} from 'aptos';
import {AptosEntryTxnBuilder} from '../web3/txnBuilder';
import {BCS} from 'aptos';
import {Transaction} from "../common/types";
import {Account} from '../web3/account';
import {vector, SimpleMap, HexStr, DEPLOYER, DEPLOYER_HS} from './common';


// Data stored in MomentumSafe.move
type Momentum = {
  info: Info,
  txnBook: TxnBook,
}

type Info = {
  public_keys: vector<HexStr>, // vector of public_keys
  nonce: number,
  threshold: number,
  metadata: HexStr, // plain text / json / uri
}

type TxnBook = {
  tx_hashes: SimpleMap<vector<HexStr>>, // nonce => vector<tx hash>
  // sequence number => a list of transactions (with the same sequence number)
  pendings: SimpleMap<TransactionType>, // Hash => Tx
}

type TransactionType = {
  nonce: number,
  payload: HexStr,
  metadata: HexStr, // json or uri
  signatures: SimpleMap<HexStr>, // public_key => signature
}






