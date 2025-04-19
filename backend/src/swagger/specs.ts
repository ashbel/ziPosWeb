import { OpenAPIV3 } from 'openapi-types';

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'POS System API',
    version: '1.0.0',
    description: 'API documentation for the POS System'
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          code: { type: 'string' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Product: {
        type: 'object',
        required: ['name', 'price', 'categoryId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number', format: 'float' },
          cost: { type: 'number', format: 'float' },
          categoryId: { type: 'string', format: 'uuid' },
          sku: { type: 'string' },
          barcode: { type: 'string' },
          image: { type: 'string' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ProductCategory: {
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      PricingRule: {
        type: 'object',
        required: ['type', 'value'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          productId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['percentage', 'fixed'] },
          value: { type: 'number' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'integer' },
                price: { type: 'number' }
              }
            }
          },
          total: { type: 'number' },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Inventory: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          productId: { type: 'string' },
          quantity: { type: 'integer' },
          location: { type: 'string' },
          lastUpdated: { type: 'string', format: 'date-time' }
        }
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string' },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Role: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          permissions: {
            type: 'array',
            items: { type: 'string' }
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Tax: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          rate: { type: 'number' },
          type: { type: 'string' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Shipping: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          cost: { type: 'number' },
          estimatedDays: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Discount: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string' },
          value: { type: 'number' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // Auth routes
    '/api/auth/login': {
      post: {
        summary: 'User login',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/register': {
      post: {
        summary: 'Register new user',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  name: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/users': {
      get: {
        summary: 'List users',
        tags: ['Users'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: {
          '200': {
            description: 'List of users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                    total: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/users/profile': {
      get: {
        summary: 'Get user profile',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'User profile',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          }
        }
      }
    },
    '/api/products': {
      get: {
        summary: 'List all products',
        tags: ['Products'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          '200': {
            description: 'List of products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create a new product',
        tags: ['Products'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Product' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Product created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/api/products/{id}': {
      get: {
        summary: 'Get a product by ID',
        tags: ['Products'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Product details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      put: {
        summary: 'Update a product',
        tags: ['Products'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Product' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Product updated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      delete: {
        summary: 'Delete a product',
        tags: ['Products'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '204': {
            description: 'Product deleted successfully'
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/api/products/categories': {
      post: {
        summary: 'Create a new product category',
        tags: ['Products'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  image: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Category created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductCategory' }
              }
            }
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/api/products/{productId}/pricing-rules': {
      post: {
        summary: 'Create a pricing rule for a product',
        tags: ['Products'],
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'value'],
                properties: {
                  type: { type: 'string', enum: ['percentage', 'fixed'] },
                  value: { type: 'number' },
                  startDate: { type: 'string', format: 'date-time' },
                  endDate: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Pricing rule created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PricingRule' }
              }
            }
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/api/products/import': {
      post: {
        summary: 'Import products from a file',
        tags: ['Products'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Products imported successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    imported: { type: 'integer' },
                    failed: { type: 'integer' },
                    errors: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid file format',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/api/orders': {
      get: {
        summary: 'List orders',
        tags: ['Orders'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of orders',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
                    total: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/inventory': {
      get: {
        summary: 'Get inventory status',
        tags: ['Inventory'],
        parameters: [
          { name: 'productId', in: 'query', schema: { type: 'string' } },
          { name: 'branchId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Inventory status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Inventory' }
              }
            }
          }
        }
      }
    },
    '/api/notifications': {
      get: {
        summary: 'Get user notifications',
        tags: ['Notifications'],
        parameters: [
          { name: 'userId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of notifications',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Notification' }
                }
              }
            }
          }
        }
      }
    },
    '/api/reports/sales': {
      get: {
        summary: 'Generate sales report',
        tags: ['Reports'],
        parameters: [
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          '200': {
            description: 'Sales report data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalSales: { type: 'number' },
                    totalOrders: { type: 'integer' },
                    averageOrderValue: { type: 'number' },
                    topProducts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          productId: { type: 'string' },
                          name: { type: 'string' },
                          quantity: { type: 'integer' },
                          revenue: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/customers': {
      get: {
        summary: 'List customers',
        tags: ['Customers'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: {
          '200': {
            description: 'List of customers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customers: { type: 'array', items: { $ref: '#/components/schemas/Customer' } },
                    total: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/health': {
      get: {
        summary: 'Check system health',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'System health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    services: {
                      type: 'object',
                      properties: {
                        database: { type: 'boolean' },
                        redis: { type: 'boolean' },
                        email: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/health/services/{name}': {
      get: {
        summary: 'Check specific service health',
        tags: ['Health'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Service health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/health/metrics': {
      get: {
        summary: 'Get system metrics',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'System metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    uptime: { type: 'number' },
                    memory: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        used: { type: 'number' },
                        free: { type: 'number' }
                      }
                    },
                    cpu: {
                      type: 'object',
                      properties: {
                        usage: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/tax': {
      get: {
        summary: 'List tax rates',
        tags: ['Tax'],
        responses: {
          '200': {
            description: 'List of tax rates',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Tax' }
                }
              }
            }
          }
        }
      }
    },
    '/api/shipping': {
      get: {
        summary: 'List shipping methods',
        tags: ['Shipping'],
        responses: {
          '200': {
            description: 'List of shipping methods',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Shipping' }
                }
              }
            }
          }
        }
      }
    },
    '/api/discounts': {
      get: {
        summary: 'List discounts',
        tags: ['Discounts'],
        responses: {
          '200': {
            description: 'List of discounts',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Discount' }
                }
              }
            }
          }
        }
      }
    },
    // Shipping routes
    '/api/shipping/rates': {
      post: {
        summary: 'Get shipping rates',
        tags: ['Shipping'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['carrier', 'origin', 'destination', 'weight'],
                properties: {
                  carrier: { type: 'string' },
                  origin: { type: 'string' },
                  destination: { type: 'string' },
                  weight: { type: 'number' },
                  dimensions: {
                    type: 'object',
                    properties: {
                      length: { type: 'number' },
                      width: { type: 'number' },
                      height: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Shipping rates retrieved successfully'
          }
        }
      }
    },
    '/api/shipping/shipments': {
      post: {
        summary: 'Create shipment',
        tags: ['Shipping'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'carrier', 'origin', 'destination', 'weight', 'items'],
                properties: {
                  orderId: { type: 'string' },
                  carrier: { type: 'string' },
                  origin: { type: 'string' },
                  destination: { type: 'string' },
                  weight: { type: 'number' },
                  dimensions: {
                    type: 'object',
                    properties: {
                      length: { type: 'number' },
                      width: { type: 'number' },
                      height: { type: 'number' }
                    }
                  },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string' },
                        quantity: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Shipment created successfully'
          }
        }
      }
    },
    '/api/shipping/tracking/{carrier}/{trackingNumber}': {
      get: {
        summary: 'Track shipment',
        tags: ['Shipping'],
        parameters: [
          {
            name: 'carrier',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'trackingNumber',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Tracking information retrieved successfully'
          }
        }
      }
    },
    // Search routes
    '/api/search/products': {
      get: {
        summary: 'Search products',
        tags: ['Search'],
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'number', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number', default: 10 }
          }
        ],
        responses: {
          '200': {
            description: 'Products found successfully'
          }
        }
      }
    },
    '/api/search/customers': {
      get: {
        summary: 'Search customers',
        tags: ['Search'],
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'number', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number', default: 10 }
          }
        ],
        responses: {
          '200': {
            description: 'Customers found successfully'
          }
        }
      }
    },
    '/api/search/orders': {
      get: {
        summary: 'Search orders',
        tags: ['Search'],
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'number', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number', default: 10 }
          }
        ],
        responses: {
          '200': {
            description: 'Orders found successfully'
          }
        }
      }
    },
    // Notification routes
    '/api/notifications/send': {
      post: {
        summary: 'Send notification',
        tags: ['Notifications'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'type', 'message'],
                properties: {
                  userId: { type: 'string' },
                  type: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Notification sent successfully'
          }
        }
      }
    },
    '/api/notifications/{userId}': {
      get: {
        summary: 'Get user notifications',
        tags: ['Notifications'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['read', 'unread'] }
          }
        ],
        responses: {
          '200': {
            description: 'Notifications retrieved successfully'
          }
        }
      }
    },
    '/api/notifications/{userId}/{notificationId}/read': {
      post: {
        summary: 'Mark notification as read',
        tags: ['Notifications'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'notificationId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Notification marked as read'
          }
        }
      }
    },
    '/api/notifications/templates': {
      post: {
        summary: 'Create notification template',
        tags: ['Notifications'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'content'],
                properties: {
                  name: { type: 'string' },
                  content: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Template created successfully'
          }
        }
      }
    },
    '/api/notifications/metrics': {
      get: {
        summary: 'Get notification metrics',
        tags: ['Notifications'],
        responses: {
          '200': {
            description: 'Metrics retrieved successfully'
          }
        }
      }
    },
    // Forecasting routes
    '/api/forecasting/sales': {
      get: {
        summary: 'Predict sales',
        tags: ['Forecasting'],
        parameters: [
          {
            name: 'productId',
            in: 'query',
            schema: { type: 'string' }
          },
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string' }
          },
          {
            name: 'days',
            in: 'query',
            schema: { type: 'number' }
          },
          {
            name: 'includeSeasonality',
            in: 'query',
            schema: { type: 'boolean' }
          }
        ],
        responses: {
          '200': {
            description: 'Sales forecast generated successfully'
          }
        }
      }
    },
    '/api/forecasting/inventory/{productId}': {
      get: {
        summary: 'Predict inventory',
        tags: ['Forecasting'],
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'days',
            in: 'query',
            schema: { type: 'number' }
          },
          {
            name: 'considerLeadTime',
            in: 'query',
            schema: { type: 'boolean' }
          }
        ],
        responses: {
          '200': {
            description: 'Inventory forecast generated successfully'
          }
        }
      }
    },
    '/api/forecasting/demand/{productId}': {
      get: {
        summary: 'Predict demand',
        tags: ['Forecasting'],
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'days',
            in: 'query',
            schema: { type: 'number' }
          },
          {
            name: 'considerPromotions',
            in: 'query',
            schema: { type: 'boolean' }
          },
          {
            name: 'considerSeasonality',
            in: 'query',
            schema: { type: 'boolean' }
          }
        ],
        responses: {
          '200': {
            description: 'Demand forecast generated successfully'
          }
        }
      }
    },
    '/api/forecasting/trends': {
      get: {
        summary: 'Get seasonal trends',
        tags: ['Forecasting'],
        responses: {
          '200': {
            description: 'Seasonal trends retrieved successfully'
          }
        }
      }
    },
    // Cache routes
    '/api/cache/{key}': {
      get: {
        summary: 'Get cache value',
        tags: ['Cache'],
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Cache value retrieved successfully'
          }
        }
      },
      post: {
        summary: 'Set cache value',
        tags: ['Cache'],
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['value'],
                properties: {
                  value: { type: 'string' },
                  ttl: { type: 'number' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Cache value set successfully'
          }
        }
      },
      delete: {
        summary: 'Delete cache value',
        tags: ['Cache'],
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Cache value deleted successfully'
          }
        }
      }
    },
    '/api/cache': {
      delete: {
        summary: 'Clear all cache',
        tags: ['Cache'],
        responses: {
          '200': {
            description: 'Cache cleared successfully'
          }
        }
      }
    },
    '/api/cache/stats': {
      get: {
        summary: 'Get cache statistics',
        tags: ['Cache'],
        responses: {
          '200': {
            description: 'Cache statistics retrieved successfully'
          }
        }
      }
    },
    // Discount routes
    '/api/discounts': {
      get: {
        summary: 'Get all discounts',
        tags: ['Discounts'],
        responses: {
          '200': {
            description: 'Discounts retrieved successfully'
          }
        }
      },
      post: {
        summary: 'Create discount',
        tags: ['Discounts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type', 'value'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
                  value: { type: 'number' },
                  startDate: { type: 'string', format: 'date-time' },
                  endDate: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Discount created successfully'
          }
        }
      }
    },
    '/api/discounts/{id}': {
      put: {
        summary: 'Update discount',
        tags: ['Discounts'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
                  value: { type: 'number' },
                  startDate: { type: 'string', format: 'date-time' },
                  endDate: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Discount updated successfully'
          }
        }
      },
      delete: {
        summary: 'Delete discount',
        tags: ['Discounts'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Discount deleted successfully'
          }
        }
      }
    },
    // Configuration routes
    '/api/configuration': {
      get: {
        summary: 'Get configuration',
        tags: ['Configuration'],
        responses: {
          '200': {
            description: 'Configuration retrieved successfully'
          }
        }
      }
    },
    '/api/configuration/set-configuration': {
      post: {
        summary: 'Set configuration',
        tags: ['Configuration'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key', 'value'],
                properties: {
                  key: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Configuration set successfully'
          }
        }
      }
    },
    '/api/configuration/bulk-update': {
      post: {
        summary: 'Bulk update configuration',
        tags: ['Configuration'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['updates'],
                properties: {
                  updates: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['key', 'value'],
                      properties: {
                        key: { type: 'string' },
                        value: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Configuration updated successfully'
          }
        }
      }
    },
    '/api/configuration/check-feature-flag': {
      post: {
        summary: 'Check feature flag',
        tags: ['Configuration'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['flag'],
                properties: {
                  flag: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Feature flag status retrieved successfully'
          }
        }
      }
    },
    '/api/configuration/history': {
      get: {
        summary: 'Get configuration history',
        tags: ['Configuration'],
        responses: {
          '200': {
            description: 'Configuration history retrieved successfully'
          }
        }
      }
    },
    '/api/configuration/feature-flags': {
      post: {
        summary: 'Set feature flag',
        tags: ['Configuration'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['flag', 'enabled'],
                properties: {
                  flag: { type: 'string' },
                  enabled: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Feature flag set successfully'
          }
        }
      }
    }
  }
}; 