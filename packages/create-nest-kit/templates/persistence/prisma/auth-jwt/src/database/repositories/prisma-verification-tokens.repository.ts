import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  type NewVerificationToken,
  type VerificationPurpose,
  VerificationTokensRepository,
} from '../../auth/verification-tokens.repository.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PrismaVerificationTokensRepository implements VerificationTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replace(token: NewVerificationToken): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.verificationToken.deleteMany({
        where: { userId: token.userId, purpose: token.purpose },
      }),
      this.prisma.verificationToken.create({ data: { id: uuidv7(), ...token } }),
    ]);
  }

  async consume(
    purpose: VerificationPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    const token = await this.prisma.verificationToken.findFirst({
      where: { tokenHash, purpose, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
    if (!token) return null;

    // Prisma can't return the rows a delete removed, so find the token first. Only one of
    // several concurrent calls deletes the row, and only that one gets the user id.
    const { count } = await this.prisma.verificationToken.deleteMany({ where: { id: token.id } });
    return count > 0 ? token.userId : null;
  }

  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.verificationToken.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return count;
  }
}
