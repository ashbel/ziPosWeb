import { PrismaClient } from '@prisma/client';
import { differenceInMinutes } from 'date-fns';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { EmployeeStatus, EmployeeRole } from '@prisma/client';
import { hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { config } from '../config';

interface EmployeeCreate {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: EmployeeRole;
  branchId: string;
  password: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export class EmployeeService extends BaseService {
  constructor(private prisma: PrismaClient) {
    super(prisma);
  }

  async createEmployee(data: EmployeeCreate) {
    // Validate unique email
    const existingEmail = await this.prisma.employee.findUnique({
      where: { email: data.email }
    });
    if (existingEmail) {
      throw new ValidationError('Email already registered');
    }

    // Hash password
    const hashedPassword = await hash(data.password, 10);

    return this.prisma.$transaction(async (prisma) => {
      // Create employee
      const employee = await prisma.employee.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          branchId: data.branchId,
          password: hashedPassword,
          status: EmployeeStatus.ACTIVE,
          address: data.address,
          emergencyContact: data.emergencyContact
        }
      });

      // Initialize employee settings
      await prisma.employeeSettings.create({
        data: {
          employeeId: employee.id,
          theme: 'light',
          language: 'en',
          notifications: true
        }
      });

      // Set up permissions based on role
      await this.setupRolePermissions(employee.id, data.role);

      return employee;
    });
  }

  async updateEmployee(id: string, data: Partial<EmployeeCreate>) {
    // Validate unique email if being updated
    if (data.email) {
      const existingEmail = await this.prisma.employee.findFirst({
        where: {
          email: data.email,
          NOT: { id }
        }
      });
      if (existingEmail) {
        throw new ValidationError('Email already registered');
      }
    }

    // Hash password if being updated
    if (data.password) {
      data.password = await hash(data.password, 10);
    }

    return this.prisma.employee.update({
      where: { id },
      data
    });
  }

  async authenticateEmployee(email: string, password: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { email },
      include: {
        permissions: true,
        branch: true
      }
    });

    if (!employee) {
      throw new ValidationError('Invalid credentials');
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new ValidationError('Account is not active');
    }

    const isValidPassword = await compare(password, employee.password);
    if (!isValidPassword) {
      throw new ValidationError('Invalid credentials');
    }

    // Generate JWT token
    const token = sign(
      {
        employeeId: employee.id,
        role: employee.role,
        branchId: employee.branchId
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    // Record login
    await this.prisma.employeeSession.create({
      data: {
        employeeId: employee.id,
        token,
        ipAddress: '127.0.0.1', // Should be provided from request
        userAgent: 'Unknown' // Should be provided from request
      }
    });

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        role: employee.role,
        branch: employee.branch,
        permissions: employee.permissions
      },
      token
    };
  }

  async trackAttendance(
    employeeId: string,
    data: {
      type: 'CLOCK_IN' | 'CLOCK_OUT';
      note?: string;
    }
  ) {
    const lastRecord = await this.prisma.attendance.findFirst({
      where: { employeeId },
      orderBy: { timestamp: 'desc' }
    });

    if (
      data.type === 'CLOCK_IN' &&
      lastRecord?.type === 'CLOCK_IN' &&
      !lastRecord.clockOutTime
    ) {
      throw new ValidationError('Already clocked in');
    }

    if (data.type === 'CLOCK_OUT' && (!lastRecord || lastRecord.type === 'CLOCK_OUT')) {
      throw new ValidationError('Not clocked in');
    }

    if (data.type === 'CLOCK_IN') {
      return this.prisma.attendance.create({
        data: {
          employeeId,
          type: data.type,
          clockInTime: new Date(),
          note: data.note
        }
      });
    } else {
      return this.prisma.attendance.update({
        where: { id: lastRecord!.id },
        data: {
          clockOutTime: new Date(),
          note: data.note
        }
      });
    }
  }

  async assignShift(data: {
    employeeId: string;
    startTime: Date;
    endTime: Date;
    branchId: string;
    notes?: string;
  }) {
    // Validate shift times
    if (data.startTime >= data.endTime) {
      throw new ValidationError('Invalid shift times');
    }

    // Check for overlapping shifts
    const overlapping = await this.prisma.shift.findFirst({
      where: {
        employeeId: data.employeeId,
        OR: [
          {
            startTime: {
              lte: data.endTime
            },
            endTime: {
              gte: data.startTime
            }
          }
        ]
      }
    });

    if (overlapping) {
      throw new ValidationError('Shift overlaps with existing shift');
    }

    return this.prisma.shift.create({
      data: {
        employeeId: data.employeeId,
        branchId: data.branchId,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
        status: 'SCHEDULED'
      }
    });
  }

  async getEmployeePerformance(employeeId: string, period: 'day' | 'week' | 'month') {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const [
      transactions,
      attendance,
      shifts
    ] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          employeeId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      this.prisma.attendance.findMany({
        where: {
          employeeId,
          clockInTime: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      this.prisma.shift.findMany({
        where: {
          employeeId,
          startTime: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);

    // Calculate metrics
    const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
    const transactionCount = transactions.length;
    const averageTransactionValue = transactionCount > 0
      ? totalSales / transactionCount
      : 0;

    const workHours = attendance.reduce((sum, a) => {
      if (!a.clockOutTime) return sum;
      const hours = (a.clockOutTime.getTime() - a.clockInTime.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    return {
      metrics: {
        totalSales,
        transactionCount,
        averageTransactionValue,
        workHours
      },
      transactions,
      attendance,
      shifts
    };
  }

  private async setupRolePermissions(employeeId: string, role: EmployeeRole) {
    const permissions = this.getDefaultPermissions(role);
    
    await this.prisma.employeePermission.createMany({
      data: permissions.map(permission => ({
        employeeId,
        permission
      }))
    });
  }

  private getDefaultPermissions(role: EmployeeRole): string[] {
    switch (role) {
      case EmployeeRole.ADMIN:
        return [
          'all:*'
        ];
      case EmployeeRole.MANAGER:
        return [
          'transactions:*',
          'inventory:*',
          'employees:read',
          'employees:create',
          'reports:*',
          'customers:*'
        ];
      case EmployeeRole.CASHIER:
        return [
          'transactions:create',
          'transactions:read',
          'inventory:read',
          'customers:read',
          'customers:create'
        ];
      default:
        return [];
    }
  }

  async clockIn(employeeId: string, branchId: string) {
    // Check if already clocked in
    const activeShift = await this.prisma.shift.findFirst({
      where: {
        employeeId,
        endTime: null
      }
    });

    if (activeShift) {
      throw new Error('Employee is already clocked in');
    }

    return this.prisma.shift.create({
      data: {
        employeeId,
        branchId,
        startTime: new Date()
      }
    });
  }

  async clockOut(employeeId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        employeeId,
        endTime: null
      }
    });

    if (!shift) {
      throw new Error('No active shift found');
    }

    const endTime = new Date();
    const duration = differenceInMinutes(endTime, shift.startTime);

    return this.prisma.shift.update({
      where: { id: shift.id },
      data: {
        endTime,
        duration
      }
    });
  }

  async calculateCommissions(params: {
    startDate: Date;
    endDate: Date;
    employeeId?: string;
  }) {
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: params.startDate,
          lte: params.endDate
        },
        employeeId: params.employeeId
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                commissionRate: true
              }
            }
          }
        },
        employee: {
          include: {
            commissionStructure: true
          }
        }
      }
    });

    const commissions = [];
    for (const sale of sales) {
      let saleCommission = 0;

      for (const item of sale.items) {
        const baseRate = item.product.commissionRate?.rate || 
                        sale.employee.commissionStructure?.defaultRate || 0;
        
        // Apply commission tiers
        let effectiveRate = baseRate;
        if (sale.employee.commissionStructure?.tiers) {
          const tier = sale.employee.commissionStructure.tiers.find(
            t => sale.total >= t.minimumSales
          );
          if (tier) {
            effectiveRate = tier.rate;
          }
        }

        saleCommission += (item.price * item.quantity) * (effectiveRate / 100);
      }

      commissions.push({
        saleId: sale.id,
        employeeId: sale.employeeId,
        amount: saleCommission
      });
    }

    // Create commission records
    await this.prisma.commission.createMany({
      data: commissions
    });

    return commissions;
  }

  async createSchedule(data: {
    employeeId: string;
    branchId: string;
    shifts: Array<{
      date: Date;
      startTime: string;
      endTime: string;
    }>;
  }) {
    const { employeeId, branchId, shifts } = data;

    // Validate no overlapping shifts
    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        if (shifts[i].date.getTime() === shifts[j].date.getTime()) {
          const shift1Start = new Date(`${shifts[i].date.toISOString().split('T')[0]}T${shifts[i].startTime}`);
          const shift1End = new Date(`${shifts[i].date.toISOString().split('T')[0]}T${shifts[i].endTime}`);
          const shift2Start = new Date(`${shifts[j].date.toISOString().split('T')[0]}T${shifts[j].startTime}`);
          const shift2End = new Date(`${shifts[j].date.toISOString().split('T')[0]}T${shifts[j].endTime}`);

          if (shift1Start < shift2End && shift2Start < shift1End) {
            throw new Error('Overlapping shifts detected');
          }
        }
      }
    }

    return this.prisma.schedule.createMany({
      data: shifts.map(shift => ({
        employeeId,
        branchId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime
      }))
    });
  }
} 