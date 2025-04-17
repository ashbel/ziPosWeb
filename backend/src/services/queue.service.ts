import { BaseService } from './base.service';
import Bull, { Queue, Job, JobOptions } from 'bull';
import { ValidationError } from '../utils/errors';

interface QueueConfig {
  name: string;
  concurrency?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  timeout?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

interface JobData {
  type: string;
  payload: any;
  metadata?: Record<string, any>;
}

interface JobStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export class QueueService extends BaseService {
  private queues: Map<string, Queue>;
  private processors: Map<string, (job: Job) => Promise<any>>;

  constructor(deps: any) {
    super(deps);
    
    this.queues = new Map();
    this.processors = new Map();

    // Initialize default queues
    this.initializeDefaultQueues();
  }

  async addJob(
    queueName: string,
    data: JobData,
    options: JobOptions = {}
  ): Promise<Job<JobData>> {
    const queue = this.getQueue(queueName);
    
    const job = await queue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 100,
      ...options
    });

    return job;
  }

  async addBulkJobs(
    queueName: string,
    jobs: Array<{
      data: JobData;
      options?: JobOptions;
    }>
  ): Promise<Job<JobData>[]> {
    const queue = this.getQueue(queueName);
    
    const bulkJobs = jobs.map(job => ({
      data: job.data,
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 100,
        ...job.options
      }
    }));

    return queue.addBulk(bulkJobs);
  }

  async getJob(
    queueName: string,
    jobId: string | number
  ): Promise<Job<JobData> | null> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async removeJob(
    queueName: string,
    jobId: string | number
  ): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  async getQueueStatus(queueName: string): Promise<JobStatus> {
    const queue = this.getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed
    };
  }

  async cleanQueue(
    queueName: string,
    options: {
      status?: ('completed' | 'failed' | 'delayed')[];
      olderThan?: number;
    } = {}
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(options.olderThan || 24 * 3600 * 1000, options.status || ['completed', 'failed']);
  }

  registerProcessor(
    queueName: string,
    processor: (job: Job) => Promise<any>
  ): void {
    const queue = this.getQueue(queueName);
    
    this.processors.set(queueName, processor);
    
    queue.process(async (job) => {
      try {
        return await processor(job);
      } catch (error) {
        this.logger.error(`Job processing error in queue ${queueName}:`, error);
        throw error;
      }
    });

    // Set up event listeners
    queue.on('completed', (job) => {
      this.logger.info(`Job ${job.id} completed in queue ${queueName}`);
    });

    queue.on('failed', (job, error) => {
      this.logger.error(`Job ${job.id} failed in queue ${queueName}:`, error);
    });

    queue.on('stalled', (job) => {
      this.logger.warn(`Job ${job.id} stalled in queue ${queueName}`);
    });
  }

  private getQueue(name: string): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new ValidationError(`Queue ${name} not found`);
    }
    return queue;
  }

  private initializeDefaultQueues(): void {
    const defaultQueues: QueueConfig[] = [
      {
        name: 'email',
        concurrency: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        timeout: 30000
      },
      {
        name: 'export',
        concurrency: 2,
        attempts: 2,
        timeout: 300000,
        removeOnComplete: 100
      },
      {
        name: 'import',
        concurrency: 1,
        attempts: 1,
        timeout: 600000
      }
    ];

    for (const config of defaultQueues) {
      this.createQueue(config);
    }
  }

  private createQueue(config: QueueConfig): Queue {
    const queue = new Bull(config.name, {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      },
      defaultJobOptions: {
        attempts: config.attempts,
        backoff: config.backoff,
        timeout: config.timeout,
        removeOnComplete: config.removeOnComplete,
        removeOnFail: config.removeOnFail
      }
    });

    if (config.concurrency) {
      queue.process(config.concurrency, async (job) => {
        const processor = this.processors.get(config.name);
        if (!processor) {
          throw new Error(`No processor registered for queue ${config.name}`);
        }
        return processor(job);
      });
    }

    this.queues.set(config.name, queue);
    return queue;
  }

  async shutdown(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
  }
} 