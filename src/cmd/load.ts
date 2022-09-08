import {load} from 'js-yaml';
import {readFile} from "fs/promises";
import * as path from 'path';
export const defaultPath = `.aptos/config.yaml`;

export type ConfigYaml = {
  profiles: {
    default:{
      private_key: string,
      public_key: string,
      account: string,
      rest_url: string,
      faucet_url: string,
    }
  }
}

export async function loadAptosYaml(filePath: string): Promise<ConfigYaml> {
  // const yaml = load(await readFile(path.join(path.resolve(), filePath), 'utf-8'));
  const yaml = load(await readFile(filePath, 'utf-8'));
  return yaml as ConfigYaml;
}

export async function loadDefault(): Promise<ConfigYaml> {
  return loadAptosYaml(defaultPath);
}
