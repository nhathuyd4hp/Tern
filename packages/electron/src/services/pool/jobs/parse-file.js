const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const filestore = require('@tern/filestore');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const parseContent = (content, type) => {
  switch (type) {
    case 'request':
      return filestore.parseRequest(content);
    case 'collection':
      return filestore.parseCollection(content);
    case 'folder':
      return filestore.parseFolder(content);
    case 'environment':
      return filestore.parseEnvironment(content);
    default:
      throw new Error(`Unknown type: ${type}`);
  }
};

const parseFile = ({ collectionPath, relativePath, type }) => {
  const absolutePath = path.join(collectionPath, relativePath);
  const buf = fs.readFileSync(absolutePath);
  const stat = fs.statSync(absolutePath, { bigint: true });
  const mtime = stat.mtimeNs;
  const hash = sha256(buf);
  const content = buf.toString('utf8');
  try {
    const data = parseContent(content, type);
    return { relativePath, mtime, hash, data, type, raw: content };
  } catch (err) {
    return { relativePath, mtime, hash, data: {}, type, raw: content, partial: true, error: { message: err.message, stack: err.stack } };
  }
};

module.exports = parseFile;
