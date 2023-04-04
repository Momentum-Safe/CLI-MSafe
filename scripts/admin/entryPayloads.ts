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
