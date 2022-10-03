import { HexString, Types } from "aptos";
/*
example:
MoveStructType.fromString('0x3::mod::struct<0x2::mod::struct<0x1::mod::struct>,0x1::mod::struct>')
struct0x1 = new MoveStructType('0x1', 'mod', 'struct'); // '0x1::mod::struct'
struct0x2 = new MoveStructType('0x2', 'mod', 'struct<T>'); // '0x2::mod::struct<T>'
struct0x2.args([struct0x1]) // '0x2::mod::struct<0x1::mod::struct>'
struct0x3 = new MoveStructType('0x3', 'mod', 'struct<T,K>'); // '0x3::mod::struct<T,K>'
struct0x3.args([struct0x2, struct0x1]) // '0x3::mod::struct<0x2::mod::struct<0x1::mod::struct>,0x1::mod::struct>'
*/
export class MoveStructType {
    typeArgsOffset?: number;
    typeArgsNum = 0;
    TypeArgs: MoveStructType[] = [];
    // support type arguments
    constructor(public readonly Address: HexString, public readonly ModuleName: string, public readonly StructName: string) {
        const found = StructName.match(/<[a-zA-Z0-9]+(,[a-zA-Z0-9]+){0,}>/);
        if (found) {
            this.typeArgsOffset = found.index!;
            this.typeArgsNum = 1 + (StructName.match(/,/g)?.length || 0);
        }
    }

    args(typeArgs: MoveStructType[]): this {
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
    static readAddress(tag: string): [HexString, string] {
        if(!tag.startsWith('0x')) throw `invalid address: ${tag}`;
        const separatorIndex = tag.indexOf('::');
        return [new HexString(tag.slice(0, separatorIndex)), tag.slice(separatorIndex + 2)];
    }
    // take off module::
    static readModule(tag: string): [string, string] {
        const separatorIndex = tag.indexOf('::');
        return [tag.slice(0, separatorIndex), tag.slice(separatorIndex + 2)];
    }
    // take off structNmaeBase
    static readStructBase(tag: string): [string, string] {
        const match = tag.match(/[<>]/);
        if (!match) return [tag, ''];
        return [tag.slice(0, match.index), tag.slice(match.index)];
    }
    // take off <MoveStructType[,MoveStructType]+>
    static readStructTypeArgs(tag: string): [MoveStructType[], string] {
        if (!tag.startsWith('<')) return [[], tag];
        const structs = [] as MoveStructType[];
        do {
            const [struct, remain] = MoveStructType.readStructType(tag.slice(1));
            structs.push(struct);
            tag = remain;
            if (!['>', ','].includes(tag[0])) throw "expected ',' or '>'";
        } while (!tag.startsWith('>'));
        return [structs, tag.slice(1)];
    }

    static readStructType(tag: string): [MoveStructType, string] {
        let address: HexString;
        let module: string;
        let structBase: string;
        let structs: MoveStructType[];
        [address, tag] = MoveStructType.readAddress(tag);
        [module, tag] = MoveStructType.readModule(tag);
        [structBase, tag] = MoveStructType.readStructBase(tag);
        [structs, tag] = MoveStructType.readStructTypeArgs(tag);
        const semiStruct = new MoveStructType(address, module, `${structBase}<${structs.map(()=>'T').join(',')}>`);
        return [semiStruct.args(structs), tag];
    }

    static fromString(tag: string): MoveStructType {
        const [struct, remain] = MoveStructType.readStructType(tag);
        if (remain.length !== 0) {
            throw new Error("still have remain data");
        }
        return struct;
    }
}