import { PrismaClient, User } from '@prisma/client';
import { hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { config } from '../config';

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    roleId: string;
    branchId: string;
  }) {
    const hashedPassword = await hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword
      },
      include: {
        role: true,
        branch: true
      }
    });
  }

  async updateUser(id: string, data: Partial<User>) {
    if (data.password) {
      data.password = await hash(data.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        role: true,
        branch: true
      }
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        branch: true
      }
    });
  }

  async getUsers(filters: {
    branchId?: string;
    roleId?: string;
    search?: string;
  }) {
    return this.prisma.user.findMany({
      where: {
        branchId: filters.branchId,
        roleId: filters.roleId,
        OR: filters.search ? [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } }
        ] : undefined
      },
      include: {
        role: true,
        branch: true
      }
    });
  }

  async createRole(data: {
    name: string;
    permissions: string[];
    description?: string;
  }) {
    return this.prisma.role.create({
      data
    });
  }

  async getRoles() {
    return this.prisma.role.findMany();
  }
} 