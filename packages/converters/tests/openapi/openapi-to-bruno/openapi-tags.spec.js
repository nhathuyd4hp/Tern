import { describe, it, expect } from '@jest/globals';
import openApiToBruno from '../../../src/openapi/openapi-to-bruno';
import { findRequestByName, findFolderByName } from '../../common/find-items';

describe('OpenAPI Import - Tags', () => {
  it('should preserve spaces in tags', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['User Management'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    // Spaces are replaced with underscores for BRU format compatibility
    expect(request.tags).toEqual(['User Management']);
  });

  it('should preserve dots in tags', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['api.v1', 'user.service'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    // Dots should be replaced with underscores
    expect(request.tags).toEqual(['api.v1', 'user.service']);
  });

  it('should preserve special characters in tags', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['API (v1)', 'user-service:v2'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    // Parentheses, colons, and spaces should be replaced with underscores
    // 'API (v1)' becomes 'API_v1' (space and parentheses become underscores, collapsed)
    expect(request.tags).toEqual(['API (v1)', 'user-service:v2']);
  });

  it('should preserve valid tags', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['users', 'api-v1', 'user_service'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual(['users', 'api-v1', 'user_service']);
  });

  it('should handle empty tags array', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: [],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual([]);
  });

  it('should handle missing tags property', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual([]);
  });

  it('should remove duplicate tags', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['User Management', 'User Management', 'user-management'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    // 'User Management' becomes 'User Management', which is different from 'user-management'
    expect(request.tags).toEqual(['User Management', 'user-management']);
  });

  it('should keep punctuation-only tags', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['...', 'valid-tag', '---'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const request = findRequestByName(result.items, 'Get users');
    expect(request).toBeDefined();
    expect(request.tags).toEqual(['...', 'valid-tag', '---']);
  });

  it('should use tag names verbatim for folder grouping', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['User Management'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        },
        '/posts': {
          get: {
            operationId: 'getPosts',
            summary: 'Get posts',
            tags: ['User Management'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    // Find the folder created from the tag
    const folder = findFolderByName(result.items, 'User Management');
    expect(folder).toBeDefined();
    expect(folder.name).toBe('User Management');
    expect(folder.items).toHaveLength(2);
  });

  it('should keep dots in folder names from tags', () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['api.v1'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    // Find the folder created from the tag - dots preserved
    const folder = findFolderByName(result.items, 'api.v1');
    expect(folder).toBeDefined();
    expect(folder.name).toBe('api.v1');
  });

  it('should handle utf characters as well', () => {
    const openApiSpec = {
      openapi: '3.0.1',
      info: {
        title: 'CBC-MODEL3D-API',
        description: 'POWER BY WARE4U',
        termsOfService: 'http://swagger.io/terms/',
        contact: {
          name: '陈洪',
          email: 'sendreams@hotmail.com'
        },
        license: {
          name: 'Apache 2.0',
          url: 'http://springdoc.org'
        },
        version: '1.0.0'
      },
      tags: [
        {
          name: '模型管理',
          description: '发布和管理3d模型'
        },
        {
          name: '模型集市',
          description: '模型查询、评价、下单等'
        }
      ],
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users',
            tags: ['模型管理'],
            responses: {
              200: {
                description: 'Success'
              }
            }
          }
        }
      }
    };

    const result = openApiToBruno(JSON.stringify(openApiSpec));
    const folder = findFolderByName(result.items, '模型管理');
    expect(folder).toBeDefined();
  });
});

describe('OpenAPI Import - tag preservation (BRU-3175)', () => {
  const buildSpec = (tag) => ({
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/x': {
        get: {
          operationId: 'getX',
          summary: 'Get X',
          tags: [tag],
          responses: { 200: { description: 'OK' } }
        }
      }
    }
  });

  it.each([
    ['Pets & Dogs', 'Pets & Dogs'],
    ['R&D', 'R&D'],
    ['&', '&'],
    ['API (v1)', 'API (v1)'],
    ['api.v1', 'api.v1']
  ])('preserves tag %p verbatim on request and folder ', (sourceTag, expected) => {
    const result = openApiToBruno(JSON.stringify(buildSpec(sourceTag)));

    const request = findRequestByName(result.items, 'Get X');
    expect(request).toBeDefined();
    expect(request.tags).toEqual([expected]);

    const folder = findFolderByName(result.items, expected);
    expect(folder).toBeDefined();
  });
});
