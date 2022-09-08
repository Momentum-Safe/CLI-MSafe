import {load} from 'js-yaml';
import {readFile} from "fs/promises";
export const defaultPath = `.aptos/config.yaml`;

export async function loadAptosYaml(filePath: string) {
  return load(await readFile(filePath, 'utf-8'));
}

export async function loadDefault() {
  return loadAptosYaml(defaultPath);
}
