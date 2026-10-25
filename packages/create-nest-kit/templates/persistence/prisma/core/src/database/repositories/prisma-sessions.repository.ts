import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Session } from '../../modules/sessions/session.js';
import { type NewSession, SessionsRepository } from '../../modules/sessions/sessions.repository.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(session: NewSession): Promise<Session> {
    return this.prisma.session.create({
      data: { id: uuidv7(), ...session, lastUsedAt: session.createdAt },
    });
  }

  findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  listActive(userId: string, now: Date): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, ...activeAt(now) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async touch(id: string, now: Date, expiresAt: Date): Promise<Session | null> {
    // Prisma can't set a column to least(value, other column), so read the cap first. It is
    // fixed at creation; the conditional update below is what keeps touch and revoke atomic.
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { absoluteExpiresAt: true },
    });
    if (!session) return null;

    const [touched] = await this.prisma.session.updateManyAndReturn({
      where: { id, ...activeAt(now) },
      data: { lastUsedAt: now, expiresAt: earliest(expiresAt, session.absoluteExpiresAt) },
    });
    return touched ?? null;
  }

  async revoke(id: string, now: Date, options: { userId?: string } = {}): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      // An undefined userId adds no condition.
      where: { id, revokedAt: null, userId: options.userId },
      data: { revokedAt: now },
    });
    return count > 0;
  }

  async revokeAllForUser(
    userId: string,
    now: Date,
    options: { exceptId?: string } = {},
  ): Promise<string[]> {
    const revoked = await this.prisma.session.updateManyAndReturn({
      where: {
        userId,
        revokedAt: null,
        id: options.exceptId === undefined ? undefined : { not: options.exceptId },
      },
      data: { revokedAt: now },
      select: { id: true },
    });
    return revoked.map((session) => session.id);
  }

  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({ where: { expiresAt: { lte: now } } });
    return count;
  }
}

function activeAt(now: Date): Prisma.SessionWhereInput {
  return { revokedAt: null, expiresAt: { gt: now } };
}

function earliest(first: Date, second: Date): Date {
  return first <= second ? first : second;
}
