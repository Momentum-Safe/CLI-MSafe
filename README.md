# CLI-MSafe

The CLI interface for interacting Momentum Safe. This repository majorly has two components:

1. The CLI interface for users to interact with Momentum Safe. 
2. Scripts to interact with the Momentum Safe.
3. The underlying typescript SDK of for smart contract interaction.

## 1. Installation

Clone the repository and change directory:

```
git clone git@github.com:Momentum-Safe/CLI-MSafe.git
cd CLI-MSafe
```

Install dependencies:

```
yarn install
```

### Install Aptos CLI tools. 

The CLI tool is used for setting up the initial account. Install with github release or compile from source. 

* [Github release](https://github.com/aptos-labs/aptos-core/releases?q=cli&expanded=true) (Recommended)
* [Install from source](https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli)

### Initialize a wallet

Use aptos CLI to setup the wallet and environment. 

```
aptos init 
```

Choose all default settings to create a new wallet with the devnet endpoint settings.

The command will create a config file `.aptos/config.yaml` under the current directory, which includes 
the wallet information as well as the network endpoint message.

## 2. Interactive CLI

### Start Momentum Safe CLI 

```
yarn start
```

And follow the instructions to operate with momemtum safe.

### Interact with Momentum Safe

Please check [Gitbook](https://momentum-safe.gitbook.io/momentum-safe/cli-tool) for handbook
of interactive CLI tools.

The following features are currently supported by Momentum Safe:

1. Momentum Safe creation
2. APT coin transfer
3. View momentum safe owned by the account
4. View pending transactions of the momentum safe
5. Coin registry.
6. Coin transfer of any coin type.
7. Custom MOVE module interaction (For simple types).
8. MOVE module publish.
9. Revert transaction.

We will add more features shortly:

1. Add coin decimal and bigint
2. Add more custom ABI, struct, e.t.c.

## 3. Running script using SDK

Several scripts are provided as example to interact with SDK. 

1. `scripts/deploy.ts` Can be used to deploy a MOVE module with momentum safe.
2. `scripts/entry-function.ts` An example script to interact with an entry function.
3. `scripts/thala-admin-commands.ts` A script for interacting with common thala admin entry functions

### 3.1. `deploy.ts`

`deploy.ts` is the script used to deploy the move module. 

You will need to finish the following items as the prerequisite before calling this script.

1. You have ready have a momentum safe wallet created with the account in `config.yaml` in step 1.
2. Deployer address is replaced with the momentum safe address in `Move.toml`
3. MOVE module is compiled with flag `--save-metadata`

After compiled the move module, call

```aidl
yarn run deploy --msafe ${MSAFE_ADDRESS} --move-dir ./tests/move
```

There is some test contracts in folder `./test/move` that you may try it out. 

```aidl
Action:			Module publish
Verify Hash:		0x80e3c2779b714ab355ecc6fc4c8db221e770adb127a18ebfb150f11d9ca65edc
Deployer:		0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0
Package:		MomentumSafe-test
Upgrade Policy:		compatible
Upgrade Number:		0
Source Digest:		BC36D67FB3DE5ABD5541BCAF633C28E1EFECF0DDDED20544296DCA98F744DE82
Modules:		0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0::message
			0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0::test_coin
Dependency:		0x0000000000000000000000000000000000000000000000000000000000000001::AptosFramework
			0x0000000000000000000000000000000000000000000000000000000000000001::AptosStdlib
			0x0000000000000000000000000000000000000000000000000000000000000001::MoveStdlib
Sender:			0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0
Sequence Number:	8
Expiration:		Thu Oct 13 2022 18:00:20 GMT-0700 (Pacific Daylight Time)
Gas Price:		100
Max Gas:		5000

--------------------

Do you confirm with the transaction? [Y/n]
```

The script will load compiled move modules from move directory and print message about the code deployment. 

After confirm, the transaction to initiate the multi-sig transaction request will be confirmed on 
blockchain. 

### 3.2 Call an entry function

Run an entry function using `scripts/entry-function.ts`.

In the script, a function calling the test script is called.  

### 3.3 Call a common thala admin entry function

Run a common thala admin entry function using `scripts/thala-admin-commands.ts`.

Before running this script, please add a new line item to `scripts/admin/history.ts` fetching the operation data for your intended call

Please submit a PR to ThalaLabs/CLI-MSafe addition to any admin operations to amend and track history

Supported method names can be found in `scripts/admin/entryPayloads.ts`

```aidl
0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0::message::set_message
```

You may change the entry function, type arguments and arguments as you want for your own usage.

Run script with yarn 

```aidl
yarn run entry-function --msafe ${MSAFE_ADDR}
```

```
Action:			Entry function
Call function:		0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0::message::set_message
Arguments (1):		[string]	Hello momentum safe
Sender:			0x1908fe0d337d7bd718c8465030c5f306377ac396f3d7acce92f526ae41637cc0
Sequence Number:	10
Expiration:		Thu Oct 13 2022 20:45:55 GMT-0700 (Pacific Daylight Time)
Gas Price:		100
Max Gas:		5000

--------------------

Do you confirm with the transaction? [Y/n]
```

After confirming the entry function, a transaction to initiate a transaction from momentum safe wallet calling `message::set_message` is submitted on chain. 

