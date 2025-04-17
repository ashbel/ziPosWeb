import { BaseService } from './base.service';
import { Redis } from 'ioredis';
import { ValidationError } from '../utils/errors';
import crypto from 'crypto';

interface Session {
  id: string;
  userId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  userAgent?: string;
  ipAddress?: string;
}

interface SessionOptions {
  duration?: number; // in milliseconds
  metadata?: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
}

export class SessionService extends BaseService {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly defaultDuration: number;

  constructor(deps: any) {
    super(deps);
    
    this.redis = deps.redis;
    this.keyPrefix = 'session:';
    this.defaultDuration = 24 * 60 * 60 * 1000; // 24 hours
  }

  async createSession(
    userId: string,
    options: SessionOptions = {}
  ): Promise<Session> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const duration = options.duration || this.defaultDuration;
    const expiresAt = new Date(now.getTime() + duration);

    const session: Session = {
      id: sessionId,
      userId,
      metadata: options.metadata || {},
      createdAt: now,
      expiresAt,
      lastActivity: now,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress
    };

    // Store session in Redis
    await this.redis.set(
      `${this.keyPrefix}${sessionId}`,
      JSON.stringify(session),
      'PX',
      duration
    );

    // Add to user's session list
    await this.redis.sadd(
      `${this.keyPrefix}user:${userId}`,
      sessionId
    );

    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const data = await this.redis.get(`${this.keyPrefix}${sessionId}`);
    if (!data) {
      return null;
    }

    const session: Session = JSON.parse(data);

    // Check if session has expired
    if (new Date(session.expiresAt) <= new Date()) {
      await this.revokeSession(sessionId);
      return null;
    }

    return session;
  }

  async updateSession(
    sessionId: string,
    updates: {
      metadata?: Record<string, any>;
      extend?: boolean;
    }
  ): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession = {
      ...session,
      metadata: {
        ...session.metadata,
        ...updates.metadata
      },
      lastActivity: new Date()
    };

    if (updates.extend) {
      updatedSession.expiresAt = new Date(
        Date.now() + this.defaultDuration
      );
    }

    await this.redis.set(
      `${this.keyPrefix}${sessionId}`,
      JSON.stringify(updatedSession),
      'PX',
      updatedSession.expiresAt.getTime() - Date.now()
    );

    return updatedSession;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await Promise.all([
        this.redis.del(`${this.keyPrefix}${sessionId}`),
        this.redis.srem(
          `${this.keyPrefix}user:${session.userId}`,
          sessionId
        )
      ]);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redis.smembers(
      `${this.keyPrefix}user:${userId}`
    );

    if (sessionIds.length > 0) {
      await Promise.all([
        this.redis.del(...sessionIds.map(id => `${this.keyPrefix}${id}`)),
        this.redis.del(`${this.keyPrefix}user:${userId}`)
      ]);
    }
  }

  async listUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = await this.redis.smembers(
      `${this.keyPrefix}user:${userId}`
    );

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions = await Promise.all(
      sessionIds.map(id => this.getSession(id))
    );

    return sessions.filter((s): s is Session => s !== null);
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    let removed = 0;

    for (const key of keys) {
      if (key.startsWith(`${this.keyPrefix}user:`)) {
        continue;
      }

      const data = await this.redis.get(key);
      if (!data) {
        continue;
      }

      const session: Session = JSON.parse(data);
      if (new Date(session.expiresAt) <= new Date()) {
        await this.revokeSession(session.id);
        removed++;
      }
    }

    return removed;
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
} 