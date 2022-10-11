import { HexString, TxnBuilderTypes, Types } from "aptos";

export type MoveTypeTag = MovePrimeTypeTag | MoveVectorTypeTag | MoveStructTypeTag;

export type MovePrimeTypeTag = 'bool'|'u8'|'u64'|'u128'|'address'|'signer';

export class MoveVectorTypeTag {
    constructor(public readonly element: MoveTypeTag) {

    }
    toString():string {
        return this.element.toString();
    }
}

/*
example:
MoveStructTypeTag.fromString('0x3::mod::struct<0x2::mod::struct<0x1::mod::struct>,0x1::mod::struct>')
struct0x1 = new MoveStructTypeTag('0x1', 'mod', 'struct'); // '0x1::mod::struct'
struct0x2 = new MoveStructTypeTag('0x2', 'mod', 'struct<T>'); // '0x2::mod::struct<T>'
struct0x2.args([struct0x1]) // '0x2::mod::struct<0x1::mod::struct>'
struct0x3 = new MoveStructTypeTag('0x3', 'mod', 'struct<T,K>'); // '0x3::mod::struct<T,K>'
struct0x3.args([struct0x2, struct0x1]) // '0x3::mod::struct<0x2::mod::struct<0x1::mod::struct>,0x1::mod::struct>'
*/
export class MoveStructTypeTag {
    typeArgsOffset?: number;
    typeArgsNum = 0;
    TypeArgs: MoveTypeTag[] = [];
    // support type arguments
    constructor(public readonly Address: HexString, public readonly ModuleName: string, public readonly StructName: string) {
        const found = StructName.match(/<[a-zA-Z0-9]+(,[a-zA-Z0-9]+){0,}>/);
        if (found) {
            this.typeArgsOffset = found.index!;
            this.typeArgsNum = 1 + (StructName.match(/,/g)?.length || 0);
        }
    }

    args(typeArgs: MoveTypeTag[]): this {
        if (this.typeArgsNum != typeArgs.length) {
            throw `wrong number of type arguments, expected ${this.typeArgsNum}, got ${typeArgs.length}`;
        }
        this.TypeArgs = typeArgs;
        return this;
    }

    typeArgsString(): string {
        if (this.typeArgsNum != this.TypeArgs.length) {
            throw `wrong number of type arguments, expected ${this.typeArgsNum}, got ${this.TypeArgs.length}`;
        }
        return this.typeArgsNum ? `<${this.TypeArgs.map(arg => arg.toString()).join(',')}>` : '';
    }

    toString() {
        return `${this.Address.hex()}::${this.ModuleName}::${this.StructName.slice(0, this.typeArgsOffset)}${this.typeArgsString()}`;
    }
    toMoveStructTag(): Types.MoveStructTag {
        return this.toString();
    }

    // get off address::
    static parseAddress(tag: string): [HexString, string] {
        if(!tag.startsWith('0x')) throw `invalid address: ${tag}`;
        const separatorIndex = tag.indexOf('::');
        return [new HexString(tag.slice(0, separatorIndex)), tag.slice(separatorIndex + 2)];
    }
    // take off module::
    static parseModuleName(tag: string): [string, string] {
        const separatorIndex = tag.indexOf('::');
        return [tag.slice(0, separatorIndex), tag.slice(separatorIndex + 2)];
    }
    // take off struct name
    static parseStructName(tag: string): [string, string] {
        const match = tag.match(/[<>]/);
        if (!match) return [tag, ''];
        return [tag.slice(0, match.index), tag.slice(match.index)];
    }
    // take off type arguments <MoveStructTypeTag[,MoveStructTypeTag]+>
    static parseTypeArgs(tag: string): [MoveTypeTag[], string] {
        if (!tag.startsWith('<')) return [[], tag];
        const typeTags = [] as MoveTypeTag[];
        do {
            const [struct, remain] = MoveStructTypeTag.parseMoveType(tag.slice(1));
            typeTags.push(struct);
            tag = remain;
            if (!['>', ','].includes(tag[0])) throw "expected ',' or '>'";
        } while (!tag.startsWith('>'));
        return [typeTags, tag.slice(1)];
    }

    static parseMoveType(tag: string): [MoveTypeTag, string] {
        if(tag.startsWith('0x')) return MoveStructTypeTag.parseStructType(tag);
        if(tag.startsWith('address')) return ['address', tag.slice(7)];
        if(tag.startsWith('bool')) return ['bool', tag.slice(4)];
        if(tag.startsWith('u8')) return ['u8', tag.slice(2)];
        if(tag.startsWith('u64')) return ['u64', tag.slice(3)];
        if(tag.startsWith('u128')) return ['u128', tag.slice(4)];
        if(tag.startsWith('vector<')) {
            const [elem,remain] = MoveStructTypeTag.parseMoveType(tag.slice(7));
            return [new MoveVectorTypeTag(elem), remain];
        }
        throw `unknow type: ${tag}`;
    }

    static parseStructType(tag: string): [MoveStructTypeTag, string] {
        let address: HexString;
        let module: string;
        let structName: string;
        let structs: MoveTypeTag[];
        [address, tag] = MoveStructTypeTag.parseAddress(tag);
        [module, tag] = MoveStructTypeTag.parseModuleName(tag);
        [structName, tag] = MoveStructTypeTag.parseStructName(tag);
        [structs, tag] = MoveStructTypeTag.parseTypeArgs(tag);
        const semiStruct = new MoveStructTypeTag(address, module, `${structName}<${structs.map(()=>'T').join(',')}>`);
        return [semiStruct.args(structs), tag];
    }

    static fromString(tag: string): MoveStructTypeTag {
        const [struct, remain] = MoveStructTypeTag.parseStructType(tag);
        if (remain.length !== 0) {
            throw new Error("still have remain data");
        }
        return struct;
    }
}

export function fromApotsMoveTag(type_tag: TxnBuilderTypes.TypeTag): MoveTypeTag {
    if(type_tag instanceof TxnBuilderTypes.TypeTagBool) {
        return 'bool';
    }
    if(type_tag instanceof TxnBuilderTypes.TypeTagU8){
        return 'u8';
    }
    if(type_tag instanceof TxnBuilderTypes.TypeTagU64){
        return 'u64';
    }
    if(type_tag instanceof TxnBuilderTypes.TypeTagU128){
        return 'u128';
    }
    if(type_tag instanceof TxnBuilderTypes.TypeTagAddress){
        return 'address';
    }
    if(type_tag instanceof TxnBuilderTypes.TypeTagSigner){
        return 'signer';
    }
    if(type_tag instanceof TxnBuilderTypes.TypeTagVector){
        const elemTypeTag = fromApotsMoveTag(type_tag.value);
        return new MoveVectorTypeTag(elemTypeTag);
    }
    if(type_tag instanceof TxnBuilderTypes.TypeTagStruct){
        const struct_tag = type_tag.value;
        const structTypeArgs = struct_tag.type_args.map(arg=>fromApotsMoveTag(arg));
        const address = HexString.fromUint8Array(struct_tag.address.address);
        const module_name = struct_tag.module_name.value;
        const struct_name = struct_tag.name.value;
        return new MoveStructTypeTag(address, module_name, struct_name).args(structTypeArgs);
    }
    console.log(type_tag);
    throw Error("unknow type args");
}