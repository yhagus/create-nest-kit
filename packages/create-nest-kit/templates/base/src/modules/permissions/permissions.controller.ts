import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../../auth/decorators.js';
import { ALL_PERMISSIONS, Permission } from './permission.js';

@Controller('permissions')
export class PermissionsController {
  /** Every permission a role can grant. */
  @Get()
  @RequirePermissions(Permission.RolesRead)
  list(): readonly Permission[] {
    return ALL_PERMISSIONS;
  }
}
