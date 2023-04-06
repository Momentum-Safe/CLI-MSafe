import {
    acceptManagerProposal,
    borrow,
    closeLBPOperationData,
    configurePythOperationData, configureSwitchboardOperationData,
    configureTier1OracleOperationData, depositCollateral, initializeCollateralOperationData,
    openVaultOperationData,
    pancakeSwapExactIn,
    setMinLiabilityAmountOperationData, setMintCapOperationData, stablePoolAddLiquidity, weightedPoolAddLiquidity
} from "./entryPayloads";

// apr 1, 8:40 UTC, txHash 0xc6c150c4fa78ac4902bd3c0b42074145f2e08295cb8a3b498cb67f8cb385bd85
export const ADMIN_OP_1 = configurePythOperationData(
    ["0x1::aptos_coin::AptosCoin"],
    { new_feed_id: "0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5" }
);

// apr 1, 8:40 UTC, txHash 0x8b81845ce731727508e1463ea7461735d434b5c2d7460595af9cb77023784f14
export const ADMIN_OP_2 = configureTier1OracleOperationData(["0x1::aptos_coin::AptosCoin"], { new_oracle: 3 });

// apr 1, 8:40 UTC, txHash 0x50714f28618477e137919968af233f40aca96b42b4f92fe50273bbf160217319
export const ADMIN_OP_3 = setMinLiabilityAmountOperationData({ amount: 100000000 });

// apr 3, 22:09 UTC, txHash 0x75349e3a7473cfb8a78a83cef7200617a9130bea3e271de8f4552a9d8e5de538
export const ADMIN_OP_4 = initializeCollateralOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC"],
    { mcr_bps: 11250, mint_cap: 4000000000000  }
);

// apr 3, 22:09 UTC, txHash 0x7ef4a9d20c1da48131c487978b414a8e7404c56ce0ba9fdde4c7e1d37d50d9fe
export const ADMIN_OP_5 = initializeCollateralOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT"],
    { mcr_bps: 11250, mint_cap: 2000000000000  }
);

// apr 3, 22:09 UTC, txHash 0x4a366c3be67bddab9b26896752f6f41dc7d9e827a5d8399a19f26e88e33ba8b9
export const ADMIN_OP_6 = initializeCollateralOperationData(
    ["0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T"],
    { mcr_bps: 11250, mint_cap: 3000000000000  }
);

// apr 3, 21:44 UTC, txHash 0xc2ca24587ec66b4d08c18e7525ebba8517e841d93fd95839015e35d7e20bc192
export const ADMIN_OP_7 = initializeCollateralOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH"],
    { mcr_bps: 12500, mint_cap: 1000000000000  }
);

// apr 3, 21:44 UTC, txHash 0x47e918098d403e3bad6a9a9c9dc1176fedc695ba59d32a5a08ca06def032e8f4
export const ADMIN_OP_8 = initializeCollateralOperationData(
    ["0xcc8a89c8dce9693d354449f1f73e60e14e347417854f029db5bc8e7454008abb::coin::T"],
    { mcr_bps: 12500, mint_cap: 100000000000000  }
);

// apr 3, 22:02 UTC, txHash 0x07deb1c1ebe51064759a030d4834e92f4957a76b10d66f3b5974aee7bbb26917
export const ADMIN_OP_9 = initializeCollateralOperationData(
    ["0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin"],
    { mcr_bps: 17000, mint_cap: 2500000000000  }
);

// apr 3, 22:08 UTC, txHash 0xc9ced85edaaf8688dd556fd70642041e1974e5931055b64265b654bc4d483845
export const ADMIN_OP_10 = initializeCollateralOperationData(
    ["0x159df6b7689437016108a019fd5bef736bac692b6d4a1f10c941f6fbb9a74ca6::oft::CakeOFT"],
    { mcr_bps: 16000, mint_cap: 50000000000000  }
);

// apr 3, 22:08 UTC, txHash 0xdef85c2eb87385123a9e754b141d922c2b5d81d21f1e337182815cb46944cb03
export const ADMIN_OP_11 = configureSwitchboardOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC"],
    { new_aggregator_address: "0xdc1045b4d9fd1f4221fc2f91b2090d88483ba9745f29cf2d96574611204659a5" }
);

// apr 4, 2:47 UTC, txHash 0x42a740064967b6ec4935d15b0a63b6a54793779726a614c73221711691d5a909
export const ADMIN_OP_12 = configureSwitchboardOperationData(
    ["0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T"],
    { new_aggregator_address: "0xdc1045b4d9fd1f4221fc2f91b2090d88483ba9745f29cf2d96574611204659a5" }
);

// apr 3, 22:21 UTC, txHash 0xb349bcd905366fbfbfaec88534af16e51ba5663c8e4c5d22945570f75b4bef88
export const ADMIN_OP_13 = configureSwitchboardOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH"],
    { new_aggregator_address: "0x7b5f536d201280a10d33d8c2202a1892b1dd8247aecfef7762ea8e7565eac7b6" }
);

// apr 3, 22:25 UTC, txHash 0x2a9a84f4748118dc72fc3a496ea7fd5c172f3d5a7744261e689d897865a9a8ad
export const ADMIN_OP_14 = configureSwitchboardOperationData(
    ["0xcc8a89c8dce9693d354449f1f73e60e14e347417854f029db5bc8e7454008abb::coin::T"],
    { new_aggregator_address: "0x7b5f536d201280a10d33d8c2202a1892b1dd8247aecfef7762ea8e7565eac7b6" }
);

// apr 3, 22:33 UTC, txHash 0xec1878cd19503b9cc149411e5168e9a001db85a76004f7dbc55fc3bbe7134493
export const ADMIN_OP_15 = configureSwitchboardOperationData(
    ["0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin"],
    { new_aggregator_address: "0x638b524fa794b1fba6cbe0e1af088d8dbbaaab48523ac9baab285587af318a8d" }
);

// apr 3, 22:33 UTC, txHash 0x261ee290ef8c0949278980855dc5fb786a2ff11a36c4f410dbd3917aeb6f4871
export const ADMIN_OP_16 = configureSwitchboardOperationData(
    ["0x1::aptos_coin::AptosCoin"],
    { new_aggregator_address: "0xb8f20223af69dcbc33d29e8555e46d031915fc38cb1a4fff5d5167a1e08e8367" }
);

// apr 3, 22:35 UTC, txHash 0x23730f8ff162f3973e3a565cd15f250a455e8956c13082206c4f55444eea1354
export const ADMIN_OP_17 = configurePythOperationData(
    ["0x159df6b7689437016108a019fd5bef736bac692b6d4a1f10c941f6fbb9a74ca6::oft::CakeOFT"],
    { new_feed_id: "0x2356af9529a1064d41e32d617e2ce1dca5733afa901daba9e2b68dee5d53ecf9" }
);

// apr 3, 22:36 UTC, txHash 0xb44994902b90e45085fa3accd316303530def3c66895f4123c1bbb3cfa66a22a
export const ADMIN_OP_18 = setMintCapOperationData(
    ["0x1::aptos_coin::AptosCoin"],
    { cap: 250000000000000 }
);

// apr 4, 2:54 UTC, txHash 0xe625375bdd250c5e446c171e3251957a92e6e240671c208f0f918ed54ecd7322
export const ADMIN_OP_19 = configureTier1OracleOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC"],
    { new_oracle: 4 }
);

// apr 4, 2:49 UTC, 0x2f651d4dec22e2991aae13c0a525e5357f687d9156a1e91430ccfc45cc8d2c69
export const ADMIN_OP_20 = configureTier1OracleOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT"],
    { new_oracle: 1 }
);

// apr 4, 2:55 UTC, txHash 0xc6dfad7bc9eb753bdbd22872db581bcc4445ebfdfd5a997582a03f5fefec6026
export const ADMIN_OP_21 = configureTier1OracleOperationData(
    ["0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T"],
    { new_oracle: 4 }
);

// apr 4, 3:02 UTC, txHash 0x1c3807aa7e9f15026b3da13d6701d1c0c25a9a210b13a2b19db3212540c21c9f
export const ADMIN_OP_22 = configureTier1OracleOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH"],
    { new_oracle: 4 }
);

// apr 4, 2:56 UTC, txHash 0xb06c814837ade3076c1f60401a85f9974d27d8c0bb2a9e0a0e5645ca9641b40b
export const ADMIN_OP_23 = configureTier1OracleOperationData(
    ["0xcc8a89c8dce9693d354449f1f73e60e14e347417854f029db5bc8e7454008abb::coin::T"],
    { new_oracle: 4 }
);

// apr 4, 3:03 UTC, txHash 0x2d79074020ac546557b626f442aeccdecc304d2f8a20c4b19e961b8cfb931b65
export const ADMIN_OP_24 = configureTier1OracleOperationData(
    ["0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114::staked_aptos_coin::StakedAptosCoin"],
    { new_oracle: 4 }
);

// apr 4, 3:04 UTC, txHash 0x8cf8b6849c686af986c9ab16e53d9297838f81896c7b056f5adc792c90072b4a
export const ADMIN_OP_25 = configureTier1OracleOperationData(
    ["0x1::aptos_coin::AptosCoin"],
    { new_oracle: 4 }
);

// apr 4, 3:05 UTC, txHash 0x09ec0b5507cfb2bd94b4bda98e182d777b96271acbb40f6d71358cfc4dc206b9
export const ADMIN_OP_26 = configureTier1OracleOperationData(
    ["0x159df6b7689437016108a019fd5bef736bac692b6d4a1f10c941f6fbb9a74ca6::oft::CakeOFT"],
    { new_oracle: 3 }
);

// 
export const ADMIN_OP_27 = closeLBPOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC", "0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL"]
);

export const ADMIN_OP_28 = setMinLiabilityAmountOperationData(
    {amount: 50000000000}
);

export const ADMIN_OP_29 = setMintCapOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC"],
    {cap: 400000000000000}
);

export const ADMIN_OP_30 = openVaultOperationData(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC"],
    {
        collateral_amount: 768000_000000,
        borrow_amount: 640000_00000000,
        hint: []
    }
);

export const ADMIN_OP_31 = weightedPoolAddLiquidity(
    [
        "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::mod_coin::MOD",
"0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::Weight_20",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::Weight_80",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null"
    ],
    {
        in_0: 240_000_00000000,
        in_1: 1_555_000_00000000,
        in_2: 0,
        in_3: 0,
        min_amount_in_0: 240_000_00000000 * 0.9,
        min_amount_in_1: 1_555_000_00000000 * 0.9,
        min_amount_in_2: 0,
        min_amount_in_3: 0,
    }
);

export const ADMIN_OP_32 = stablePoolAddLiquidity(
    [
        "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::mod_coin::MOD",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null"
    ],
    {
        in_0: 300_000_00000000,
        in_1: 300_000_000000,
        in_2: 0,
        in_3: 0,
    }
);

export const ADMIN_OP_33 = weightedPoolAddLiquidity(
    [
        "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::mod_coin::MOD",
        "0x1::aptos_coin::AptosCoin",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::Weight_50",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::Weight_50",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
        "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null"
    ],
    {
        in_0: 100_000_00000000,
        in_1: 8_500_00000000,
        in_2: 0,
        in_3: 0,
        min_amount_in_0: 100_000_00000000 * 0.9,
        min_amount_in_1: 8_500_00000000 * 0.9,
        min_amount_in_2: 0,
        min_amount_in_3: 0,
    }
);

export const ADMIN_OP_34 = depositCollateral(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC"],
    {
        amount: 288_000_000000,
        hint: []
    }
);

export const ADMIN_OP_35 = borrow(
    ["0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC"],
    {
        amount: 240_000_00000000,
        hint: []
    }
);

export const ADMIN_OP_36 = weightedPoolAddLiquidity(
    [
        "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::mod_coin::MOD",
"0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::Weight_20",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool::Weight_80",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null",
"0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::base_pool::Null"
    ],
    {
        in_0: 240_000_00000000,
        in_1: 154_5893_00000000,
        in_2: 0,
        in_3: 0,
        min_amount_in_0: 240_000_00000000 * 0.71,
        min_amount_in_1: 154_5893_00000000 * 0.71,
        min_amount_in_2: 0,
        min_amount_in_3: 0,
    }
);

export const ADMIN_OP_37 = acceptManagerProposal();