import {
    configurePythOperationData,
    configureTier1OracleOperationData,
    setMinLiabilityAmountOperationData
} from "./entryPayloads";

// apr 1, 8:40am UTC, by 0xbe1, txHash 0xc6c150c4fa78ac4902bd3c0b42074145f2e08295cb8a3b498cb67f8cb385bd85
export const ADMIN_OP_1 = configurePythOperationData(
    ["0x1::aptos_coin::AptosCoin"],
    { new_feed_id: "0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5" }
);

// apr 1, 8:40am UTC, by 0xbe1, txHash 0x8b81845ce731727508e1463ea7461735d434b5c2d7460595af9cb77023784f14
export const ADMIN_OP_2 = configureTier1OracleOperationData(["0x1::aptos_coin::AptosCoin"], { new_oracle: 3 });

// apr 1, 8:40am UTC, by 0xbe1, txHash 0x50714f28618477e137919968af233f40aca96b42b4f92fe50273bbf160217319
export const ADMIN_OP_3 = setMinLiabilityAmountOperationData({ amount: 100000000 });
