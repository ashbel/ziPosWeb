import { RateLimiter } from 'limiter';
import { createHmac } from 'crypto';
import { PrismaClient } from '@prisma/client';

export class ApiGatewayService {
  private rateLimiters: Map<string, RateLimiter> = new Map();
  
  constructor(private prisma: PrismaClient) {}

  async validateApiKey(apiKey: string, signature: string, payload: any): Promise<boolean> {
    const apiClient = await this.prisma.apiClient.findUnique({
      where: { apiKey }
    });

    if (!apiClient) return false;

    // Verify signature
    const computedSignature = this.computeSignature(payload, apiClient.secretKey);
    if (signature !== computedSignature) return false;

    // Check rate limits
    if (!this.rateLimiters.has(apiKey)) {
      this.rateLimiters.set(
        apiKey,
        new RateLimiter({
          tokensPerInterval: apiClient.rateLimit,
          interval: 'minute'
        })
      );
    }

    const limiter = this.rateLimiters.get(apiKey)!;
    const hasToken = await limiter.tryRemoveTokens(1);
    if (!hasToken) throw new Error('Rate limit exceeded');

    // Log API usage
    await this.prisma.apiUsage.create({
      data: {
        apiClientId: apiClient.id,
        endpoint: payload.endpoint,
        method: payload.method,
        responseTime: payload.responseTime,
        status: payload.status
      }
    });

    return true;
  }

  private computeSignature(payload: any, secretKey: string): string {
    return createHmac('sha256', secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
} 