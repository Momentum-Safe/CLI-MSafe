import {MY_ACCOUNT} from "../src/web3/global";
import {loadMomentumSafe} from "./common";
import {HexString} from "aptos";
import {makeEntryFunctionTx} from "../src/momentum-safe/msafe-txn";
import {printSeparator, printTxDetails, promptForYN} from "../src/cmd/common";
import * as Aptos from "../src/web3/global";
import {ADMIN_OP_3} from "./admin/history";

const thalaManagerAddress = "0x4dcae85fc5559071906cd5c76b7420fcbb4b0a92f00ab40ffc394aadbbff5ee9";

async function main() {
    // load msafe
    const msafe = await loadMomentumSafe(HexString.ensure(thalaManagerAddress));

    // Make module publish transaction
    const sn = await msafe.getNextSN();

    // ** REQUIRED: Replace entryPayload with ADMIN_OP_X from ./admin/history.ts **
    const entryPayload = ADMIN_OP_3;
    console.log('making entry function call with data: ', entryPayload);

    // Apply your function call and arguments here
    const msafeTxn = await makeEntryFunctionTx(
        msafe,
        entryPayload,
        {
            sequenceNumber: sn
        },
    );

    // Confirm transaction details
    await printTxDetails(msafeTxn.getTxnInfo());
    printSeparator();
    const userConfirm = await promptForYN("Do you confirm with the transaction?", true);
    if (!userConfirm) {
        console.error("User canceled operation");
        process.exit(1);
    }

    // Submit transaction
    const res = await msafe.initTransaction(MY_ACCOUNT, msafeTxn, {});
    const myHash = (res.pendingTx as any).hash;
    console.log(`\tTransaction ${myHash} submitted to blockchain`);
    await Aptos.waitForTransaction(myHash);
    console.log(`\tTransaction confirmed on chain.`);
}

(async () => main())();