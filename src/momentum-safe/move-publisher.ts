import {BCS, HexString, TxnBuilderTypes} from "aptos";
import * as child from "child_process";
import path from "path";
import fs from "fs";
import * as toml from "toml";
import {AptosEntryTxnBuilder} from "../web3/transaction";
import {
  APTOS_FRAMEWORK_HS,
  FUNCTIONS,
  MODULES,
  Options
} from "./common";


type MoveToml = {
  package: { name: string, version: string, upgrade_policy: string },
  addresses: { [addr: string]: string },
  dependencies: { [addr: string]: string }
}

type MoveProject = {
  moveToml: MoveToml,
  metadata: {
    raw: Buffer,
    info: PackageMetadata,
  },
  byteCode: Buffer[],
}

export enum IncludedArtifacts {
  All = "all",
  Sparse = "sparse",
  None = "none",
}

type NamedAddress = {
  addrName: string,
  addrValue: HexString,
}


// Move publisher is only used in CLI tools.
export class MovePublisher {
  constructor(public readonly moveInfo: MoveProject) { }

  static async fromMoveDir(
    moveDir: string,
    artifacts: IncludedArtifacts,
    namedAddress: NamedAddress,
  ): Promise<MovePublisher> {
    await MovePublisher.moveCompile(moveDir, artifacts, namedAddress);
    const moveInfo = MovePublisher.loadCompiledMoveProject(moveDir);
    return new MovePublisher(moveInfo);
  }

  getDeployTransaction(sender: HexString, config: Options) {
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .addr(APTOS_FRAMEWORK_HS)
      .module(MODULES.CODE)
      .method(FUNCTIONS.PUBLISH_PACKAGE)
      .from(sender)
      .sequenceNumber(config.sequenceNumber!)
      .maxGas(BigInt(config.maxGas!))
      .gasPrice(BigInt(config.gasPrice!))
      .chainId(config.chainID!)
      .expiration(config.expirationSec!)
      .args([
        BCS.bcsSerializeBytes(this.moveInfo.metadata.raw),
        this.serializeCodeBytes(),
      ])
      .build();
  }

  private serializeCodeBytes() {
    const bytes = (buf: Buffer) => ({
      serialize(serializer: BCS.Serializer) {
        serializer.serializeBytes(buf);
      }
    });
    const codeSerializer = new BCS.Serializer();
    BCS.serializeVector(this.moveInfo.byteCode.map(code => bytes(code)), codeSerializer);
    return codeSerializer.getBytes();
  }

  static moveCompile(
    moveDir: string,
    includedArtifacts: IncludedArtifacts,
    namedAddress: NamedAddress,
  ) {
    // Check for move module
    MovePublisher.loadMoveTomlFile(moveDir);

    let cmd = `aptos move compile`;
    cmd = cmd + ` --package-dir=${moveDir} --save-metadata`;
    cmd = cmd + ` --included-artifacts ${includedArtifacts}`;
    cmd = cmd + ` --named-addresses ${namedAddress.addrName}=${namedAddress.addrValue}`;
    console.log("Compiling:");
    console.log();
    console.log("\t"+cmd);
    console.log();
    try {
      const res = child.execSync(cmd, {});
      console.log("Compile successful.");
      console.log(String(res));
    } catch (e) {
      console.log("Compile failed!");
      console.log();
      throw new Error((e as any).message);
    }
  }

  static loadCompiledMoveProject(moveDir: string): MoveProject {
    const mt = MovePublisher.loadMoveTomlFile(moveDir);
    const [raw, metadata] = MovePublisher.loadMetadata(moveDir, mt);
    const byteCodes = MovePublisher.loadByteCode(moveDir, mt, metadata);
    return {
      moveToml: mt,
      metadata: {
        raw: raw,
        info: metadata,
      },
      byteCode: byteCodes,
    };
  }

  static isDirValid(moveDir: string): boolean {
    try {
      MovePublisher.loadMoveTomlFile(moveDir);
    } catch (e) {
      return false;
    }
    return true;
  }

  private static loadMoveTomlFile(moveDir: string): MoveToml {
    const moveTomlFile = path.join(moveDir, 'Move.toml');
    if (!fs.existsSync(moveTomlFile)) {
      throw new Error(`can't find 'Move.toml' in ${moveDir}`);
    }
    const s = fs.readFileSync(moveTomlFile).toString();
    return toml.parse(s) as MoveToml;
  }

  // load metadata from bcs file
  private static loadMetadata(moveDir: string, mt: MoveToml): [Buffer, PackageMetadata] {
    const packageName = mt.package.name;
    const metadataFile = path.join(moveDir, 'build', packageName, 'package-metadata.bcs');
    const metadataRaw = fs.readFileSync(metadataFile);
    const metadata = PackageMetadata.deserialize(new BCS.Deserializer(metadataRaw));
    if(!metadataRaw.equals(BCS.bcsToBytes(metadata))) {
      console.warn("struct of metadata changed!");
    }
    return [metadataRaw, metadata];
  }

  private static loadByteCode(moveDir: string, mt: MoveToml, metadata: PackageMetadata): Buffer[] {
    const packageName = mt.package.name;
    const bytecodeDir = path.join(moveDir, 'build', packageName, 'bytecode_modules');
    return metadata.modules.map(module=>fs.readFileSync(path.join(bytecodeDir, `${module.name}.mv`)));
  }
}

/// Metadata for a package. All byte blobs are represented as base64-of-gzipped-bytes
export class PackageMetadata {
  constructor(
    /// Name of this package.
    public readonly name: string,
    /// The upgrade policy of this package.
    public readonly upgrade_policy: UpgradePolicy,
    /// The numbers of times this module has been upgraded. Also serves as the on-chain version.
    /// This field will be automatically assigned on successful upgrade.
    public readonly upgrade_number: number,
    /// The source digest of the sources in the package. This is constructed by first building the
    /// sha256 of each individual source, than sorting them alphabetically, and sha256 them again.
    public readonly source_digest: string,
    /// The package manifest, in the Move.toml format. Gzipped text.
    public readonly manifest: BCS.Bytes,
    /// The list of modules installed by this package.
    public readonly modules: vector<ModuleMetadata>,
    /// Holds PackageDeps.
    public readonly deps: vector<PackageDep>,
    /// For future extensions.
    public readonly extension: Option<Any>,
  ) {
  }

  static deserialize(deserializer: BCS.Deserializer): PackageMetadata {
    const name = deserializer.deserializeStr();
    const upgrade_policy = UpgradePolicy.deserialize(deserializer);
    const upgrade_number = deserializer.deserializeU64();
    const source_digest = deserializer.deserializeStr();
    const manifest = deserializer.deserializeBytes();
    const modules = BCS.deserializeVector(deserializer, ModuleMetadata);
    const deps = BCS.deserializeVector(deserializer, PackageDep);
    const extension = Option.deserialize<Any>(deserializer);
    return new PackageMetadata(name, upgrade_policy, Number(upgrade_number), source_digest, manifest, modules, deps, extension);
  }

  serialize(serializer: BCS.Serializer): void {
    serializer.serializeStr(this.name);
    this.upgrade_policy.serialize(serializer);
    serializer.serializeU64(this.upgrade_number);
    serializer.serializeStr(this.source_digest);
    serializer.serializeBytes(this.manifest);
    BCS.serializeVector(this.modules, serializer);
    BCS.serializeVector(this.deps, serializer);
    this.extension.serialize(serializer);
  }
}

type Any = any
type vector<T> = T[];

class Option<T> {
  constructor(public readonly raw: BCS.Bytes) {
  }

  static deserialize<T>(deserializer: BCS.Deserializer): Option<T> {
    const raw = deserializer.deserializeBytes();
    return new Option<T>(raw);
  }

  get(cls: any): T {
    return cls.deserialize(new BCS.Deserializer(this.raw)) as T;
  }

  serialize(serializer: BCS.Serializer): void {
    serializer.serializeBytes(this.raw);
  }
}

/// A dependency to a package published at address
class PackageDep {
  constructor(
    public readonly account: TxnBuilderTypes.AccountAddress,
    public readonly package_name: string,
  ) {
  }

  static deserialize(deserializer: BCS.Deserializer): PackageDep {
    const account = TxnBuilderTypes.AccountAddress.deserialize(deserializer);
    const package_name = deserializer.deserializeStr();
    return new PackageDep(account, package_name);
  }

  serialize(serializer: BCS.Serializer): void {
    this.account.serialize(serializer);
    serializer.serializeStr(this.package_name);
  }
}

class ModuleMetadata {
  constructor(
    /// Name of the module.
    public readonly name: string,
    /// Source text, gzipped String. Empty if not provided.
    public readonly source: BCS.Bytes,
    /// Source map, in compressed BCS. Empty if not provided.
    public readonly source_map: BCS.Bytes,
    /// For future extensions.
    public readonly extension: Option<Any>,
  ) {
  }

  static deserialize(deserializer: BCS.Deserializer): ModuleMetadata {
    const name = deserializer.deserializeStr();
    const source = deserializer.deserializeBytes();
    const source_map = deserializer.deserializeBytes();
    const extension = Option.deserialize<Any>(deserializer);
    return new ModuleMetadata(name, source, source_map, extension);
  }

  serialize(serializer: BCS.Serializer): void {
    serializer.serializeStr(this.name);
    serializer.serializeBytes(this.source);
    serializer.serializeBytes(this.source_map);
    this.extension.serialize(serializer);
  }
}

class UpgradePolicy {
  constructor(public readonly policy: number) {
  }

  static deserialize(deserializer: BCS.Deserializer): UpgradePolicy {
    const policy = deserializer.deserializeU8();
    return new UpgradePolicy(policy);
  }

  serialize(serializer: BCS.Serializer): void {
    serializer.serializeU8(this.policy);
  }

  name(): string {
    switch (this.policy) {
      case (0):
        return 'arbitrary';
      case (1):
        return 'compatible';
      case (2):
        return 'immutable';
      default:
        return 'unknown';
    }
  }
}

export function isStrIncludedArtifacts(s: string): boolean {
  try {
    strToIncludedArtifacts(s);
  } catch (e) {
    return false;
  }
  return true;
}

export function strToIncludedArtifacts(s: string): IncludedArtifacts {
  switch (s) {
    case (IncludedArtifacts.Sparse):
      return IncludedArtifacts.Sparse;
    case (IncludedArtifacts.All):
      return IncludedArtifacts.All;
    case (IncludedArtifacts.None):
      return IncludedArtifacts.None;
    default:
      throw new Error("unknown included artifacts");
  }
}
