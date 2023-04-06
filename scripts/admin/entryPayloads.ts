import {BCS, HexString, TxnBuilderTypes} from "aptos";
import {EntryFunctionArgs} from "../../src/momentum-safe/msafe-txn";

// Vault Types
type InitializeCollateralArgs = {
    mcr_bps: number,
    mint_cap: number
}

type MintCapArgs = {
    cap: number,
}

type MinLiabilityAmountArgs = {
    amount: number
}

type OpenVaultArgs = {
    collateral_amount: number,
    borrow_amount: number,
    hint: string[]
}

type DepositCollateralArgs = {
    amount: number,
    hint: string[],
}

type BorrowArgs = {
    amount: number,
    hint: string[],
}

// Oracle Types
type ConfigurePythArgs = {
    new_feed_id: string
}

type ConfigureTier1OracleArgs = {
    new_oracle: number
}

type ConfigureSwitchboardArgs = {
    new_aggregator_address: string,
}

// THL Types
type MintTHLArgs = {
    recipient: string,
    amount: number
}

// LBP Types
type CreateLBPArgs = {
    asset_0_amount: number,
    asset_1_amount: number,
    start_weight_0: number,
    end_weight_0: number,
    swap_fee_bps: number,
    start_timestamp_seconds: number,
    end_timestamp_seconds: number
}

type GrantWhitelistArgs = {
    creator_address: string,
}

// AMM Types
type WeightedPoolAddLiquidityArgs = {
    in_0: number,
    in_1: number,
    in_2: number,
    in_3: number,
    min_amount_in_0: number,
    min_amount_in_1: number,
    min_amount_in_2: number,
    min_amount_in_3: number,
}

type StablePoolAddLiquidityArgs = {
    in_0: number,
    in_1: number,
    in_2: number,
    in_3: number,
}

type PancakeSwapExactInArgs = {
    x_in: number,
    y_min_out: number,
}

// Manager

export function acceptManagerProposal(): EntryFunctionArgs {
    return {
        fnName: "0x93aa044a65a27bd89b163f8b3be3777b160b09a25c336643dcc2878dfd8f2a8d::manager::accept_manager_proposal",
        typeArgs: [],
        args: []
    };
}

// Vault Operation Data
export function initializeCollateralOperationData(typeArgs: string[], args: InitializeCollateralArgs): EntryFunctionArgs {
    return {
        fnName: "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::init::initialize_collateral",
        typeArgs,
        args: [BCS.bcsSerializeUint64(args.mcr_bps), BCS.bcsSerializeUint64(args.mint_cap)]
    };
}

export function setMinLiabilityAmountOperationData(args: MinLiabilityAmountArgs): EntryFunctionArgs {
    return {
        fnName: "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::vault::set_min_liability_amount",
        typeArgs: [],
        args: [BCS.bcsSerializeUint64(args.amount)] // amount
    };
}

export function setMintCapOperationData(typeArgs: string[], args: MintCapArgs): EntryFunctionArgs {
    return {
        fnName: "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::vault::set_mint_cap",
        typeArgs,
        args: [BCS.bcsSerializeUint64(args.cap)] // amount
    };
}

export function depositCollateral(typeArgs: string[], args: DepositCollateralArgs): EntryFunctionArgs {
    const serializer = new BCS.Serializer();
    BCS.serializeVector([], serializer);
    return {
        fnName: "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::vault_scripts::deposit_collateral",
        typeArgs,
        args: [
            BCS.bcsSerializeUint64(args.amount),
            serializer.getBytes(),
        ]
    };
}

export function borrow(typeArgs: string[], args: BorrowArgs): EntryFunctionArgs {
    const serializer = new BCS.Serializer();
    BCS.serializeVector([], serializer);
    return {
        fnName: "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::vault_scripts::borrow",
        typeArgs,
        args: [
            BCS.bcsSerializeUint64(args.amount),
            serializer.getBytes(),
        ]
    };
}

// TODO: serialize hints
export function openVaultOperationData(typeArgs: string[], args: OpenVaultArgs): EntryFunctionArgs {
    const serializer = new BCS.Serializer();
    BCS.serializeVector([], serializer);
    return {
        fnName: "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::vault_scripts::open_vault",
        typeArgs,
        args: [
            BCS.bcsSerializeUint64(args.collateral_amount),
            BCS.bcsSerializeUint64(args.borrow_amount),
            serializer.getBytes(),
        ]
    };
}

// Oracle Operation Data
export function configurePythOperationData(typeArgs: string[], args: ConfigurePythArgs): EntryFunctionArgs {
    return {
        fnName: "0x092e95ed77b5ac815d3fbc2227e76db238339e9ca43ace45031ec2589bea5b8c::pyth_oracle::configure_pyth",
        typeArgs,
        args: [BCS.bcsSerializeBytes(new HexString(args.new_feed_id).toUint8Array())]
    };
}

export function configureTier1OracleOperationData(typeArgs: string[], args: ConfigureTier1OracleArgs): EntryFunctionArgs {
    return {
        fnName: "0x092e95ed77b5ac815d3fbc2227e76db238339e9ca43ace45031ec2589bea5b8c::tiered_oracle::configure_tier_1",
        typeArgs,
        args: [BCS.bcsSerializeU8(args.new_oracle)]
    };
}

export function configureSwitchboardOperationData(typeArgs: string[], args: ConfigureSwitchboardArgs): EntryFunctionArgs {
    return {
        fnName: "0x092e95ed77b5ac815d3fbc2227e76db238339e9ca43ace45031ec2589bea5b8c::switchboard_oracle::configure_switchboard",
        typeArgs,
        args: [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(args.new_aggregator_address))]
    };
}

// THL Operation Data
export function mintTHLOperationData(args: MintTHLArgs): EntryFunctionArgs {
    return {
        fnName: "0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::mint",
        typeArgs: [],
        args: [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(args.recipient)),
            BCS.bcsSerializeUint64(args.amount)
        ]
    };
}

// LBP Operation Data
export function createLBPOperationData(typeArgs: string[], args: CreateLBPArgs): EntryFunctionArgs {
    return {
        fnName: "0x6970b4878c3aea96732be3f31c2dded12d94d9455ff0c76c67d84859dce35136::lbp_scripts::create_lbp",
        typeArgs,
        args: [
            BCS.bcsSerializeUint64(args.asset_0_amount),
            BCS.bcsSerializeUint64(args.asset_1_amount),
            BCS.bcsSerializeUint64(args.start_weight_0),
            BCS.bcsSerializeUint64(args.end_weight_0),
            BCS.bcsSerializeUint64(args.swap_fee_bps),
            BCS.bcsSerializeUint64(args.start_timestamp_seconds),
            BCS.bcsSerializeUint64(args.end_timestamp_seconds),
        ]
    };
}

export function grantWhitelistOperationData(typeArgs: string[], args: GrantWhitelistArgs): EntryFunctionArgs {
    return {
        fnName: "0x6970b4878c3aea96732be3f31c2dded12d94d9455ff0c76c67d84859dce35136::lbp::grant_whitelist",
        typeArgs,
        args: [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(args.creator_address))
        ]
    };
}

export function closeLBPOperationData(typeArgs: string[]): EntryFunctionArgs {
    return {
        fnName: "0x6970b4878c3aea96732be3f31c2dded12d94d9455ff0c76c67d84859dce35136::lbp_scripts::close_lbp",
        typeArgs,
        args: []
    };
}

// AMM Operation Data
export function weightedPoolAddLiquidity(typeArgs: string[], args: WeightedPoolAddLiquidityArgs): EntryFunctionArgs {
    return {
        fnName: "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::weighted_pool_scripts::add_liquidity",
        typeArgs,
        args: [
            BCS.bcsSerializeUint64(args.in_0),
            BCS.bcsSerializeUint64(args.in_1),
            BCS.bcsSerializeUint64(args.in_2),
            BCS.bcsSerializeUint64(args.in_3),
            BCS.bcsSerializeUint64(args.min_amount_in_0),
            BCS.bcsSerializeUint64(args.min_amount_in_1),
            BCS.bcsSerializeUint64(args.min_amount_in_2),
            BCS.bcsSerializeUint64(args.min_amount_in_3),
        ]
    };
}

export function stablePoolAddLiquidity(typeArgs: string[], args: StablePoolAddLiquidityArgs): EntryFunctionArgs {
    return {
        fnName: "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af::stable_pool_scripts::add_liquidity",
        typeArgs,
        args: [
            BCS.bcsSerializeUint64(args.in_0),
            BCS.bcsSerializeUint64(args.in_1),
            BCS.bcsSerializeUint64(args.in_2),
            BCS.bcsSerializeUint64(args.in_3),
        ]
    };
}

export function pancakeSwapExactIn(typeArgs: string[], args: PancakeSwapExactInArgs): EntryFunctionArgs {
    return {
        fnName: "c7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa::router::swap_exact_input",
        typeArgs,
        args: [
            BCS.bcsSerializeUint64(args.x_in),
            BCS.bcsSerializeUint64(args.y_min_out),
        ]
    };
}