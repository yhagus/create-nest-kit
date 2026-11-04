import { Command } from '@nestjs/cqrs';

/** Marks the user's email as verified, keeping the original time if it already was. @throws UserNotFoundException */
export class MarkEmailVerifiedCommand extends Command<void> {
  constructor(readonly userId: string) {
    super();
  }
}
