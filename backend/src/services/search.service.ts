import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Client } from '@elastic/elasticsearch';
import { Redis } from 'ioredis';

interface SearchableEntity {
  type: string;
  id: string;
  data: Record<string, any>;
  boost?: number;
}

interface SearchQuery {
  query: string;
  filters?: Record<string, any>;
  facets?: string[];
  page?: number;
  limit?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

interface SearchResult<T> {
  hits: Array<{
    id: string;
    type: string;
    score: number;
    data: T;
  }>;
  facets?: Record<string, Array<{
    value: string;
    count: number;
  }>>;
  total: number;
  page: number;
  totalPages: number;
}

export class SearchService extends BaseService {
  private readonly elasticsearch: Client;
  private readonly redis: Redis;
  private readonly indexPrefix: string;

  constructor(deps: any) {
    super(deps);
    
    this.elasticsearch = new Client({
      node: process.env.ELASTICSEARCH_URL
    });
    this.redis = deps.redis;
    this.indexPrefix = process.env.ELASTICSEARCH_INDEX_PREFIX || 'app';
  }

  async indexDocument(
    entity: SearchableEntity
  ): Promise<void> {
    const index = this.getIndexName(entity.type);

    // Ensure index exists
    await this.ensureIndex(index);

    // Index document
    await this.elasticsearch.index({
      index,
      id: entity.id,
      body: {
        ...entity.data,
        _boost: entity.boost || 1,
        _updated: new Date()
      }
    });
  }

  async bulkIndex(
    entities: SearchableEntity[]
  ): Promise<void> {
    const operations = entities.flatMap(entity => [
      {
        index: {
          _index: this.getIndexName(entity.type),
          _id: entity.id
        }
      },
      {
        ...entity.data,
        _boost: entity.boost || 1,
        _updated: new Date()
      }
    ]);

    // Ensure all indexes exist
    const indexes = new Set(entities.map(e => this.getIndexName(e.type)));
    await Promise.all(
      Array.from(indexes).map(index => this.ensureIndex(index))
    );

    // Bulk index
    await this.elasticsearch.bulk({
      refresh: true,
      body: operations
    });
  }

  async search<T>(
    type: string,
    query: SearchQuery
  ): Promise<SearchResult<T>> {
    const {
      query: queryString,
      filters,
      facets,
      page = 1,
      limit = 20,
      sort
    } = query;

    const index = this.getIndexName(type);

    // Build search query
    const searchQuery: any = {
      bool: {
        must: [
          {
            multi_match: {
              query: queryString,
              fields: ['*'],
              fuzziness: 'AUTO'
            }
          }
        ]
      }
    };

    // Add filters
    if (filters) {
      searchQuery.bool.filter = Object.entries(filters).map(
        ([field, value]) => ({
          term: { [field]: value }
        })
      );
    }

    // Execute search
    const response = await this.elasticsearch.search({
      index,
      body: {
        query: searchQuery,
        from: (page - 1) * limit,
        size: limit,
        sort: sort
          ? [{ [sort.field]: sort.order }]
          : undefined,
        aggs: facets?.reduce((acc, facet) => ({
          ...acc,
          [facet]: {
            terms: { field: facet }
          }
        }), {})
      }
    });

    // Process results
    const hits = response.hits.hits.map(hit => ({
      id: hit._id,
      type,
      score: hit._score,
      data: hit._source as T
    }));

    // Process facets
    const facetResults = facets
      ? Object.fromEntries(
          facets.map(facet => [
            facet,
            response.aggregations[facet].buckets.map(bucket => ({
              value: bucket.key,
              count: bucket.doc_count
            }))
          ])
        )
      : undefined;

    return {
      hits,
      facets: facetResults,
      total: response.hits.total.value,
      page,
      totalPages: Math.ceil(response.hits.total.value / limit)
    };
  }

  async suggest(
    type: string,
    field: string,
    prefix: string,
    options: {
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<string[]> {
    const cacheKey = `suggest:${type}:${field}:${prefix}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await this.elasticsearch.search({
      index: this.getIndexName(type),
      body: {
        suggest: {
          suggestions: {
            prefix,
            completion: {
              field,
              size: options.limit || 5,
              skip_duplicates: true,
              fuzzy: {
                fuzziness: 'AUTO'
              }
            }
          }
        },
        _source: false
      }
    });

    const suggestions = response.suggest.suggestions[0].options
      .filter(option => option._score >= (options.minScore || 0))
      .map(option => option.text);

    await this.redis.set(
      cacheKey,
      JSON.stringify(suggestions),
      'EX',
      300 // Cache for 5 minutes
    );

    return suggestions;
  }

  async deleteDocument(
    type: string,
    id: string
  ): Promise<void> {
    await this.elasticsearch.delete({
      index: this.getIndexName(type),
      id
    });
  }

  async reindex(
    type: string,
    options: {
      batchSize?: number;
      progressCallback?: (progress: number) => void;
    } = {}
  ): Promise<void> {
    const { batchSize = 100 } = options;

    // Get total count
    const total = await this.getEntityCount(type);
    let processed = 0;

    // Process in batches
    for (let offset = 0; offset < total; offset += batchSize) {
      const entities = await this.getEntitiesBatch(
        type,
        offset,
        batchSize
      );

      await this.bulkIndex(entities);

      processed += entities.length;
      options.progressCallback?.(processed / total);
    }
  }

  private getIndexName(type: string): string {
    return `${this.indexPrefix}_${type}`;
  }

  private async ensureIndex(index: string): Promise<void> {
    const exists = await this.elasticsearch.indices.exists({
      index
    });

    if (!exists) {
      await this.elasticsearch.indices.create({
        index,
        body: {
          settings: {
            analysis: {
              analyzer: {
                default: {
                  type: 'standard',
                  stopwords: '_english_'
                }
              }
            }
          },
          mappings: {
            dynamic: true,
            properties: {
              _boost: { type: 'float' },
              _updated: { type: 'date' }
            }
          }
        }
      });
    }
  }

  private async getEntityCount(type: string): Promise<number> {
    switch (type) {
      case 'products':
        return this.prisma.product.count();
      case 'orders':
        return this.prisma.order.count();
      case 'customers':
        return this.prisma.customer.count();
      default:
        throw new ValidationError(`Unknown entity type: ${type}`);
    }
  }

  private async getEntitiesBatch(
    type: string,
    offset: number,
    limit: number
  ): Promise<SearchableEntity[]> {
    let entities: any[];

    switch (type) {
      case 'products':
        entities = await this.prisma.product.findMany({
          skip: offset,
          take: limit,
          include: {
            category: true,
            variants: true
          }
        });
        return entities.map(product => ({
          type: 'products',
          id: product.id,
          data: {
            name: product.name,
            description: product.description,
            category: product.category?.name,
            price: product.price,
            sku: product.sku,
            variants: product.variants.map(v => v.name)
          }
        }));

      case 'orders':
        entities = await this.prisma.order.findMany({
          skip: offset,
          take: limit,
          include: {
            customer: true,
            items: {
              include: {
                product: true
              }
            }
          }
        });
        return entities.map(order => ({
          type: 'orders',
          id: order.id,
          data: {
            orderNumber: order.orderNumber,
            customerName: `${order.customer?.firstName} ${order.customer?.lastName}`,
            status: order.status,
            total: order.total,
            items: order.items.map(item => item.product.name)
          }
        }));

      case 'customers':
        entities = await this.prisma.customer.findMany({
          skip: offset,
          take: limit
        });
        return entities.map(customer => ({
          type: 'customers',
          id: customer.id,
          data: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone
          }
        }));

      default:
        throw new ValidationError(`Unknown entity type: ${type}`);
    }
  }
} 