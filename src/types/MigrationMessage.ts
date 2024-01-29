import { BCS, HexString, MaybeHexString, TxnBuilderTypes } from "aptos";
import { SignedMessage, TypeInfo } from "./SignedMessage";

class MultisigAccountCreationMessage {
  constructor(
    // Chain id is included to prevent cross-chain replay.
    public readonly chain_id: TxnBuilderTypes.ChainId,
    // Account address is included to prevent cross-account replay (when multiple accounts share the same auth key).
    public readonly account_address: TxnBuilderTypes.AccountAddress,
    // Sequence number is not needed for replay protection as the multisig account can only be created once.
    // But it's included to ensure timely execution of account creation.
    public readonly sequence_number: BCS.Uint64,
    // The list of owners for the multisig account.
    public readonly owners: BCS.Seq<TxnBuilderTypes.AccountAddress>,
    // The number of signatures required (signature threshold).
    public readonly num_signatures_required: BCS.Uint64
  ) {}

  serialize(serializer: BCS.Serializer): void {
    this.chain_id.serialize(serializer);
    this.account_address.serialize(serializer);
    serializer.serializeU64(this.sequence_number);
    BCS.serializeVector(this.owners, serializer);
    serializer.serializeU64(this.num_signatures_required);
  }

  static deserialize(
    deserializer: BCS.Deserializer
  ): MultisigAccountCreationMessage {
    const chain_id = TxnBuilderTypes.ChainId.deserialize(deserializer);
    const account_address =
      TxnBuilderTypes.AccountAddress.deserialize(deserializer);
    const sequence_number = deserializer.deserializeU64();
    const owners = BCS.deserializeVector(
      deserializer,
      TxnBuilderTypes.AccountAddress
    );
    const num_signatures_required = deserializer.deserializeU64();
    return new MultisigAccountCreationMessage(
      chain_id,
      account_address,
      sequence_number,
      owners,
      num_signatures_required
    );
  }
}

export class MigrationProofMessage extends SignedMessage<MultisigAccountCreationMessage> {
  // aptos_framework::multisig_account::MultisigAccountCreationMessage
  static TYPE_INFO = new TypeInfo(
    TxnBuilderTypes.AccountAddress.fromHex("0x1"),
    "multisig_account",
    "MultisigAccountCreationWithAuthKeyRevocationMessage"
  );
  constructor(
    chain_id: BCS.Uint8,
    account_address: MaybeHexString,
    sequence_number: BCS.Uint64,
    owners: BCS.Seq<MaybeHexString>,
    num_signatures_required: BCS.Uint64
  ) {
    const innerMessage = new MultisigAccountCreationMessage(
      new TxnBuilderTypes.ChainId(chain_id),
      TxnBuilderTypes.AccountAddress.fromHex(account_address),
      sequence_number,
      owners.map(TxnBuilderTypes.AccountAddress.fromHex),
      num_signatures_required
    );
    super(MigrationProofMessage.TYPE_INFO, innerMessage);
  }

  toString(): string {
    return `${toHexAddress(this.type_info.account_address)}::${
      this.type_info.module_name
    }::${this.type_info.struct_name} {
        chain_id: ${this.inner.chain_id.value},
        account_address: ${toHexAddress(this.inner.account_address)},
        sequence_number: ${this.inner.sequence_number.toString()},
        owners: [${this.inner.owners.map(toHexAddress).join(",")}],
        num_signatures_required: ${this.inner.num_signatures_required.toString()},\n}`;
  }

  static deserialize(deserializer: BCS.Deserializer): MigrationProofMessage {
    TypeInfo.deserialize(deserializer);
    const innerMessage =
      MultisigAccountCreationMessage.deserialize(deserializer);
    return new MigrationProofMessage(
      innerMessage.chain_id.value,
      toHexAddress(innerMessage.account_address),
      innerMessage.sequence_number,
      innerMessage.owners.map(toHexAddress),
      innerMessage.num_signatures_required
    );
  }

  static fromBytes(bytes: BCS.Bytes): MigrationProofMessage {
    if (!this.isMigrationProofMessage(bytes)) {
      throw new Error("Invalid type info");
    }
    const deserializer = new BCS.Deserializer(bytes);
    return this.deserialize(deserializer);
  }

  static isMigrationProofMessage(bytes: BCS.Bytes): boolean {
    const type_encoded = this.TYPE_INFO.toBytes();
    return (
      Buffer.compare(bytes.slice(0, type_encoded.length), type_encoded) === 0
    );
  }
}

const toHexAddress = (account: TxnBuilderTypes.AccountAddress) =>
  HexString.fromUint8Array(account.address).hex();
