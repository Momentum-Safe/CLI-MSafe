import { BCS, TxnBuilderTypes } from "aptos";

export type Serializable = { serialize(serializer: BCS.Serializer): void };

export class TypeInfo {
  constructor(
    public readonly account_address: TxnBuilderTypes.AccountAddress,
    public readonly module_name: string,
    public readonly struct_name: string
  ) {}

  serialize(serializer: BCS.Serializer): void {
    this.account_address.serialize(serializer);
    serializer.serializeBytes(Buffer.from(this.module_name));
    serializer.serializeBytes(Buffer.from(this.struct_name));
  }

  toBytes(): BCS.Bytes {
    const serializer = new BCS.Serializer();
    this.serialize(serializer);
    return serializer.getBytes();
  }

  static deserialize(deserializer: BCS.Deserializer): TypeInfo {
    const account_address =
      TxnBuilderTypes.AccountAddress.deserialize(deserializer);
    const module_name = deserializer.deserializeStr();
    const struct_name = deserializer.deserializeStr();
    return new TypeInfo(account_address, module_name, struct_name);
  }

  static fromBytes(bytes: BCS.Bytes): TypeInfo {
    return TypeInfo.deserialize(new BCS.Deserializer(bytes));
  }
}

export class SignedMessage<T extends Serializable> {
  constructor(public readonly type_info: TypeInfo, public readonly inner: T) {}

  serialize(serializer: BCS.Serializer): void {
    this.type_info.serialize(serializer);
    this.inner.serialize(serializer);
  }

  toBytes(): BCS.Bytes {
    const serializer = new BCS.Serializer();
    this.serialize(serializer);
    return serializer.getBytes();
  }
}
