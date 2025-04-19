import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import nodemailer, { Transporter } from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Redis } from 'ioredis';
import { readFile } from 'fs/promises';
import { join } from 'path';
import Handlebars from 'handlebars';
import juice from 'juice';
import { Queue } from 'bull';
import { DateTime } from 'luxon';
import { Logger } from '../utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  data?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
}

interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
  variables?: string[];
}

export class EmailService extends BaseService {
  private transporter: Transporter;
  private sesClient: SESClient;
  private emailQueue: Queue;
  private readonly redis: Redis;
  private readonly templatePath: string;
  private readonly templates: Map<string, EmailTemplate>;
  private logger: Logger;

  constructor(deps: { prisma: any; redis: any; logger: Logger }) {
    super(deps.prisma, deps.redis, deps.logger);
    this.redis = deps.redis;
    this.templatePath = process.env.EMAIL_TEMPLATE_PATH || './templates/email';
    this.templates = new Map();
    this.logger = deps.logger;

    this.initializeTransport();
    this.initializeQueue();
    this.loadTemplates();

    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const command = new SendEmailCommand({
        Source: options.from || process.env.EMAIL_FROM,
        Destination: {
          ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
          CcAddresses: options.cc,
          BccAddresses: options.bcc,
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: options.body,
              Charset: 'UTF-8',
            },
          },
        },
      });

      await this.sesClient.send(command);
      this.logger.info('Email sent successfully', { to: options.to });
    } catch (error) {
      this.logger.error('Failed to send email', { error });
      throw new ValidationError('Failed to send email');
    }
  }

  async sendBulkEmails(
    options: Array<Omit<EmailOptions, 'template'> & { template: string }>
  ): Promise<void> {
    const template = await this.getTemplate(options[0].template);
    const compiledTemplate = Handlebars.compile(template.html);

    const emailJobs = options.map(opt => ({
      data: {
        to: Array.isArray(opt.to) ? opt.to.join(',') : opt.to,
        from: process.env.EMAIL_FROM,
        subject: opt.subject || template.subject,
        html: compiledTemplate(opt.data || {}),
        attachments: opt.attachments,
        priority: this.getPriorityHeader(opt.priority)
      },
      opts: {
        priority: this.getQueuePriority(opt.priority),
        delay: opt.scheduledFor
          ? opt.scheduledFor.getTime() - Date.now()
          : undefined
      }
    }));

    await this.emailQueue.addBulk(emailJobs);
  }

  async createTemplate(template: EmailTemplate): Promise<void> {
    // Validate template
    if (!template.name || !template.html) {
      throw new ValidationError('Template name and HTML content are required');
    }

    // Extract variables from template
    template.variables = this.extractTemplateVariables(template.html);

    // Store template
    await this.prisma.emailTemplate.create({
      data: {
        name: template.name,
        subject: template.subject,
        html: template.html,
        text: template.text,
        category: template.category,
        variables: template.variables
      }
    });

    // Update cache
    this.templates.set(template.name, template);
  }

  async updateTemplate(
    name: string,
    updates: Partial<EmailTemplate>
  ): Promise<void> {
    const template = await this.prisma.emailTemplate.update({
      where: { name },
      data: updates
    });

    this.templates.set(name, template);
  }

  async deleteTemplate(name: string): Promise<void> {
    await this.prisma.emailTemplate.delete({
      where: { name }
    });

    this.templates.delete(name);
  }

  async previewTemplate(
    template: string,
    data: Record<string, any>
  ): Promise<{
    html: string;
    text: string;
  }> {
    const templateData = await this.getTemplate(template);
    return this.compileTemplate(templateData, data);
  }

  async getEmailHistory(
    filter: {
      email?: string;
      template?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
    },
    pagination: {
      page?: number;
      limit?: number;
    } = {}
  ) {
    const where: any = {};

    if (filter.email) {
      where.to = { contains: filter.email };
    }
    if (filter.template) {
      where.template = filter.template;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.startDate || filter.endDate) {
      where.createdAt = {
        ...(filter.startDate && { gte: filter.startDate }),
        ...(filter.endDate && { lte: filter.endDate })
      };
    }

    const [total, emails] = await Promise.all([
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.findMany({
        where,
        skip: (pagination.page || 0) * (pagination.limit || 10),
        take: pagination.limit || 10,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      total,
      emails
    };
  }

  private async initializeTransport(): Promise<void> {
    const provider = process.env.EMAIL_PROVIDER || 'smtp';

    switch (provider) {
      case 'ses':
        this.transporter = nodemailer.createTransport({
          SES: this.sesClient
        });
        break;

      case 'smtp':
      default:
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        break;
    }

    // Verify transport
    await this.transporter.verify();
  }

  private initializeQueue(): void {
    this.emailQueue = new Queue('email-queue', {
      redis: this.redis as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    });

    this.emailQueue.process('sendEmail', async job => {
      try {
        await this.transporter.sendMail(job.data);
        
        await this.prisma.emailLog.update({
          where: { id: job.data.logId },
          data: { status: 'sent', sentAt: new Date() }
        });
      } catch (error) {
        await this.prisma.emailLog.update({
          where: { id: job.data.logId },
          data: {
            status: 'failed',
            error: error.message
          }
        });
        throw error;
      }
    });
  }

  private async loadTemplates(): Promise<void> {
    const templates = await this.prisma.emailTemplate.findMany();
    templates.forEach(template => {
      this.templates.set(template.name, template);
    });
  }

  private async validateEmailOptions(options: EmailOptions): Promise<void> {
    if (!options.to) {
      throw new ValidationError('Recipient email is required');
    }

    if (!options.template) {
      throw new ValidationError('Email template is required');
    }

    const emails = Array.isArray(options.to) ? options.to : [options.to];
    for (const email of emails) {
      if (!this.isValidEmail(email)) {
        throw new ValidationError(`Invalid email address: ${email}`);
      }
    }

    if (options.scheduledFor && options.scheduledFor < new Date()) {
      throw new ValidationError('Scheduled date must be in the future');
    }
  }

  private async getTemplate(name: string): Promise<EmailTemplate> {
    const template = this.templates.get(name);
    if (!template) {
      throw new ValidationError(`Email template '${name}' not found`);
    }
    return template;
  }

  private async compileTemplate(
    template: EmailTemplate,
    data: Record<string, any>
  ): Promise<{ html: string; text: string }> {
    // Compile HTML template
    const htmlTemplate = Handlebars.compile(template.html);
    let html = htmlTemplate(data);

    // Inline CSS
    html = juice(html);

    // Compile text template if exists, or generate from HTML
    let text: string;
    if (template.text) {
      const textTemplate = Handlebars.compile(template.text);
      text = textTemplate(data);
    } else {
      text = this.htmlToText(html);
    }

    return { html, text };
  }

  private async scheduleEmail(
    emailData: any,
    scheduledFor: Date
  ): Promise<void> {
    const delay = scheduledFor.getTime() - Date.now();
    await this.emailQueue.add('sendEmail', emailData, {
      delay,
      priority: this.getQueuePriority(emailData.priority)
    });
  }

  private async logEmail(data: {
    to: string | string[];
    subject: string;
    template: string;
    scheduledFor?: Date;
  }): Promise<void> {
    await this.prisma.emailLog.create({
      data: {
        to: Array.isArray(data.to) ? data.to.join(',') : data.to,
        subject: data.subject,
        template: data.template,
        status: data.scheduledFor ? 'scheduled' : 'queued',
        scheduledFor: data.scheduledFor
      }
    });
  }

  private getPriorityHeader(
    priority?: 'high' | 'normal' | 'low'
  ): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'low':
        return 5;
      default:
        return 3;
    }
  }

  private getQueuePriority(
    priority?: 'high' | 'normal' | 'low'
  ): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'low':
        return 3;
      default:
        return 2;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private extractTemplateVariables(template: string): string[] {
    const variables = new Set<string>();
    const regex = /{{([^}]+)}}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1].trim());
    }

    return Array.from(variables);
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
} 