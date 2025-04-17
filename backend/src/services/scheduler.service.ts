import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Queue, Job } from 'bull';
import { CronJob } from 'cron';
import { EventEmitter } from 'events';

interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  data: any;
  options?: {
    timezone?: string;
    priority?: number;
    timeout?: number;
    retries?: number;
  };
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface JobResult {
  jobId: string;
  result: any;
  error?: string;
  duration: number;
  completedAt: Date;
}

export class SchedulerService extends BaseService {
  private readonly queue: Queue;
  private readonly eventEmitter: EventEmitter;
  private readonly jobs: Map<string, CronJob>;

  constructor(deps: any) {
    super(deps);
    
    this.queue = new Queue('scheduled-jobs', {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });
    
    this.eventEmitter = new EventEmitter();
    this.jobs = new Map();

    this.initializeQueue();
    this.restoreJobs();
  }

  async scheduleJob(
    name: string,
    cronExpression: string,
    data: any,
    options: ScheduledJob['options'] = {}
  ): Promise<ScheduledJob> {
    // Validate cron expression
    if (!this.isValidCronExpression(cronExpression)) {
      throw new ValidationError('Invalid cron expression');
    }

    // Create job record
    const job = await this.prisma.scheduledJob.create({
      data: {
        name,
        cronExpression,
        data,
        options,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Start the job
    await this.startJob(job);

    return job;
  }

  async updateJob(
    jobId: string,
    updates: {
      cronExpression?: string;
      data?: any;
      options?: ScheduledJob['options'];
    }
  ): Promise<ScheduledJob> {
    // Validate cron expression if provided
    if (updates.cronExpression && !this.isValidCronExpression(updates.cronExpression)) {
      throw new ValidationError('Invalid cron expression');
    }

    // Stop existing job
    await this.stopJob(jobId);

    // Update job record
    const job = await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });

    // Restart job if active
    if (job.status === 'active') {
      await this.startJob(job);
    }

    return job;
  }

  async deleteJob(jobId: string): Promise<void> {
    // Stop and remove job
    await this.stopJob(jobId);

    // Delete job record
    await this.prisma.scheduledJob.delete({
      where: { id: jobId }
    });
  }

  async pauseJob(jobId: string): Promise<ScheduledJob> {
    // Stop the job
    await this.stopJob(jobId);

    // Update status
    return this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'paused',
        updatedAt: new Date()
      }
    });
  }

  async resumeJob(jobId: string): Promise<ScheduledJob> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new ValidationError('Job not found');
    }

    // Start the job
    await this.startJob(job);

    // Update status
    return this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'active',
        updatedAt: new Date()
      }
    });
  }

  async getJob(jobId: string): Promise<ScheduledJob | null> {
    return this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });
  }

  async listJobs(
    options: {
      status?: ScheduledJob['status'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ScheduledJob[]> {
    return this.prisma.scheduledJob.findMany({
      where: {
        status: options.status
      },
      take: options.limit,
      skip: options.offset,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getJobHistory(
    jobId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<JobResult[]> {
    return this.prisma.jobResult.findMany({
      where: {
        jobId
      },
      take: options.limit,
      skip: options.offset,
      orderBy: {
        completedAt: 'desc'
      }
    });
  }

  onJobComplete(callback: (result: JobResult) => void): void {
    this.eventEmitter.on('job:complete', callback);
  }

  onJobError(callback: (error: Error, jobId: string) => void): void {
    this.eventEmitter.on('job:error', callback);
  }

  private async startJob(job: ScheduledJob): Promise<void> {
    const cronJob = new CronJob(
      job.cronExpression,
      () => this.executeJob(job),
      null,
      true,
      job.options?.timezone
    );

    this.jobs.set(job.id, cronJob);

    // Update next run time
    await this.prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        nextRun: cronJob.nextDate().toDate(),
        updatedAt: new Date()
      }
    });
  }

  private async stopJob(jobId: string): Promise<void> {
    const cronJob = this.jobs.get(jobId);
    if (cronJob) {
      cronJob.stop();
      this.jobs.delete(jobId);
    }
  }

  private async executeJob(job: ScheduledJob): Promise<void> {
    const startTime = Date.now();

    try {
      // Add job to queue
      const queueJob = await this.queue.add(
        job.data,
        {
          jobId: job.id,
          priority: job.options?.priority,
          timeout: job.options?.timeout,
          attempts: job.options?.retries
        }
      );

      // Wait for completion
      const result = await queueJob.finished();

      const completedAt = new Date();
      const duration = Date.now() - startTime;

      // Record result
      const jobResult = await this.prisma.jobResult.create({
        data: {
          jobId: job.id,
          result,
          duration,
          completedAt
        }
      });

      // Update job
      await this.prisma.scheduledJob.update({
        where: { id: job.id },
        data: {
          lastRun: completedAt,
          nextRun: this.jobs.get(job.id)?.nextDate().toDate(),
          updatedAt: new Date()
        }
      });

      this.eventEmitter.emit('job:complete', jobResult);
    } catch (error) {
      // Record error
      const completedAt = new Date();
      const duration = Date.now() - startTime;

      await this.prisma.jobResult.create({
        data: {
          jobId: job.id,
          error: error.message,
          duration,
          completedAt
        }
      });

      this.eventEmitter.emit('job:error', error, job.id);
    }
  }

  private async restoreJobs(): Promise<void> {
    const activeJobs = await this.prisma.scheduledJob.findMany({
      where: {
        status: 'active'
      }
    });

    for (const job of activeJobs) {
      await this.startJob(job);
    }
  }

  private initializeQueue(): void {
    this.queue.process(async (job: Job) => {
      // Execute job logic here
      // This could be customized based on job type/data
      return job.data;
    });

    this.queue.on('failed', (job, error) => {
      this.logger.error('Job failed:', {
        jobId: job.id,
        error: error.message
      });
    });
  }

  private isValidCronExpression(expression: string): boolean {
    try {
      new CronJob(expression, () => {});
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    // Stop all jobs
    for (const [jobId, cronJob] of this.jobs.entries()) {
      cronJob.stop();
      this.jobs.delete(jobId);
    }

    // Close queue
    await this.queue.close();
  }
} 