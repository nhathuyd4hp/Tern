import { describe, it, expect } from '@jest/globals';
import { swagger2ToBruno } from '../../../src/openapi/swagger2-to-bruno';
import { findRequestByName, findFolderByName } from '../../common/find-items';

describe('Swagger 2.0 Import - Tags', () => {
  it('should preserve spaces in tags', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['User Management'],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual(['User Management']);
  });

  it('should preserve dots in tags', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['api.v1.users'],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    // Dots are replaced with underscores for BRU format compatibility
    expect(request.tags).toEqual(['api.v1.users']);
  });

  it('should preserve special characters in tags', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            tags: ['users/admin', 'data@v2', 'test#tag'],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual(['users/admin', 'data@v2', 'test#tag']);
  });

  it('should preserve valid tags', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            tags: ['users', 'admin_panel', 'v2-api'],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toContain('users');
    expect(request.tags).toContain('admin_panel');
  });

  it('should handle empty tags array', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            tags: [],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual([]);
  });

  it('should handle missing tags property', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual([]);
  });

  it('should remove duplicate tags after sanitization', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            tags: ['user management', 'user_management'],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    // After sanitization both become user_management, duplicates should be removed
    const uniqueTags = new Set(request.tags);
    expect(uniqueTags.size).toBe(request.tags.length);
  });

  it('should use tag names verbatim for folder grouping', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            tags: ['User Management'],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };
    const result = swagger2ToBruno(spec);

    // The folder name is the first tag, verbatim
    const folder = findFolderByName(result.items, 'User Management');
    expect(folder).toBeDefined();
  });

  it('should handle UTF-8 characters in tags', () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Tags API', version: '1.0' },
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            tags: ['Ünïcödé', '日本語'],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    };

    // Should not throw
    expect(() => swagger2ToBruno(spec)).not.toThrow();
    const result = swagger2ToBruno(spec);
    expect(result).toBeDefined();
  });
});
