import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

export interface UserAuthRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true },
    });
  }

  async findById(
    id: string,
  ): Promise<Omit<UserAuthRecord, 'passwordHash'> | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: dto.role },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: { ...(dto.role ? { role: dto.role } : {}) },
      select: { id: true, email: true, role: true, updatedAt: true },
    });
  }
}
