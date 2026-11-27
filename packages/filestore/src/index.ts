import type { BrunoCollection, BrunoItem, BrunoEnvironment } from '@tern/schema-types';
import dotenv from 'dotenv';

import {
  parseYmlItem,
  parseYmlCollection,
  parseYmlFolder,
  parseYmlEnvironment,
  stringifyYmlItem,
  stringifyYmlFolder,
  stringifyYmlCollection,
  stringifyYmlEnvironment
} from './formats/yml';
import FileParserWorker from './workers';
import { ParseOptions, StringifyOptions, CollectionFormat } from './types';
import { DEFAULT_COLLECTION_FORMAT } from './constants';

// YAML is the only supported format; the option is kept so callers stay explicit.
const assertYml = (options: { format?: CollectionFormat }): void => {
  if (options.format !== undefined && options.format !== 'yml') {
    throw new Error(`Unsupported format: ${options.format}`);
  }
};

const DEFAULT_OPTIONS = { format: DEFAULT_COLLECTION_FORMAT };

// request
export const parseRequest = (content: string, options: ParseOptions = DEFAULT_OPTIONS): any => {
  assertYml(options);
  return parseYmlItem(content);
};

export const stringifyRequest = (requestObj: BrunoItem, options: StringifyOptions = DEFAULT_OPTIONS): string => {
  assertYml(options);
  return stringifyYmlItem(requestObj);
};

// request via worker
let globalWorkerInstance: FileParserWorker | null = null;
const getWorkerInstance = (): FileParserWorker => {
  if (!globalWorkerInstance) {
    globalWorkerInstance = new FileParserWorker();
  }
  return globalWorkerInstance;
};

export const parseRequestViaWorker = async (content: string, options: { format?: CollectionFormat; filename?: string } = DEFAULT_OPTIONS): Promise<any> => {
  assertYml(options);
  return await getWorkerInstance().parseRequest(content);
};

export const stringifyRequestViaWorker = async (requestObj: any, options: { format?: CollectionFormat } = DEFAULT_OPTIONS): Promise<string> => {
  assertYml(options);
  return await getWorkerInstance().stringifyRequest(requestObj);
};

export const parseFolderViaWorker = async (content: string, options: { format?: CollectionFormat } = DEFAULT_OPTIONS): Promise<any> => {
  assertYml(options);
  return await getWorkerInstance().parseFolder(content);
};

export const stringifyFolderViaWorker = async (folderObj: any, options: { format?: CollectionFormat } = DEFAULT_OPTIONS): Promise<string> => {
  assertYml(options);
  return await getWorkerInstance().stringifyFolder(folderObj);
};

export const parseEnvironmentViaWorker = async (content: string, options: { format?: CollectionFormat } = DEFAULT_OPTIONS): Promise<any> => {
  assertYml(options);
  return await getWorkerInstance().parseEnvironment(content);
};

export const stringifyEnvironmentViaWorker = async (envObj: any, options: { format?: CollectionFormat } = DEFAULT_OPTIONS): Promise<string> => {
  assertYml(options);
  return await getWorkerInstance().stringifyEnvironment(envObj);
};

// collection
export const parseCollection = (content: string, options: ParseOptions = DEFAULT_OPTIONS): any => {
  assertYml(options);
  return parseYmlCollection(content);
};

export const stringifyCollection = (collectionObj: BrunoCollection, brunoConfig: any, options: StringifyOptions = DEFAULT_OPTIONS): string => {
  assertYml(options);
  return stringifyYmlCollection(collectionObj, brunoConfig);
};

// folder
export const parseFolder = (content: string, options: ParseOptions = DEFAULT_OPTIONS): any => {
  assertYml(options);
  return parseYmlFolder(content);
};

export const stringifyFolder = (folderObj: any, options: StringifyOptions = DEFAULT_OPTIONS): string => {
  assertYml(options);
  return stringifyYmlFolder(folderObj);
};

// environment
export const parseEnvironment = (content: string, options: ParseOptions = DEFAULT_OPTIONS): any => {
  assertYml(options);
  return parseYmlEnvironment(content);
};

export const stringifyEnvironment = (envObj: BrunoEnvironment, options: StringifyOptions = DEFAULT_OPTIONS): string => {
  assertYml(options);
  return stringifyYmlEnvironment(envObj);
};

export const parseDotEnv = (content: string): Record<string, string> => {
  return dotenv.parse(Buffer.from(content));
};

export { FileParserWorker };
export * from './types';
export * from './constants';
