# Bruno Filestore

A generic file storage and parsing package for Bruno API client.

## Purpose

This package abstracts the file format operations for Bruno, providing a clean interface for parsing and stringifying Bruno requests, collections, folders, and environments.

## Features

- YAML (OpenCollection `.yml`) is the only supported file format

## Usage

```javascript
const {
  parseRequest,
  stringifyRequest,
  parseCollection,
  stringifyCollection,
  parseEnvironment,
  stringifyEnvironment,
  parseDotEnv
} = require('@tern/filestore');

// Parse a .yml request file
const requestData = parseRequest(ymlContent);

// Stringify request data to .yml format
const ymlContent = stringifyRequest(requestData);
```

## API

The package provides the following functions:

- `parseRequest(content, options = { format: 'yml' })`: Parse request file content
- `stringifyRequest(requestObj, options = { format: 'yml' })`: Convert request object to file content
- `parseCollection(content, options = { format: 'yml' })`: Parse collection file content
- `stringifyCollection(collectionObj, options = { format: 'yml' })`: Convert collection object to file content
- `parseFolder(content, options = { format: 'yml' })`: Parse folder file content
- `stringifyFolder(folderObj, options = { format: 'yml' })`: Convert folder object to file content
- `parseEnvironment(content, options = { format: 'yml' })`: Parse environment file content
- `stringifyEnvironment(envObj, options = { format: 'yml' })`: Convert environment object to file content
- `parseDotEnv(content)`: Parse .env file content
