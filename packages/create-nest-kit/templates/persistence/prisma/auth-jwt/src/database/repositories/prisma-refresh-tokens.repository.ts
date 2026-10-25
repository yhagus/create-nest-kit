import { Injectable } from '@nestjs/common';
import { RefreshTokensRepository } from '../../auth/refresh-tokens.repository.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PrismaRefreshTokensRepository implements RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(sessionId: string, tokenHash: string): Promise<void> {
    await this.prisma.sessionRefreshToken.create({ data: { sessionId, tokenHash } });
  }

  async rotate(sessionId: string, currentHash: string, nextHash: string): Promise<boolean> {
    const { count } = await this.prisma.sessionRefreshToken.updateMany({
      where: { sessionId, tokenHash: currentHash },
      data: { tokenHash: nextHash },
    });
    return count > 0;
  }
}
