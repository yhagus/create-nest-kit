import { ConflictException, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../../common/error-code.js';

export class RoleNotFoundException extends NotFoundException {
  constructor() {
    super('Role not found');
  }
}

/** A change that would rename or delete a system role, or take a permission from admin. */
export class RoleProtectedException extends ConflictException {
  constructor(message: string) {
    super(message, { errorCode: ErrorCode.RoleProtected });
  }
}
