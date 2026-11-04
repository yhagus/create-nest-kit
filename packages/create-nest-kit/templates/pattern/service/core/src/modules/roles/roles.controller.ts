import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RequirePermissions } from '../../auth/decorators.js';
import { ValidBody } from '../../common/validation.js';
import { Permission } from '../permissions/permission.js';
import { type RoleView, toRoleView } from './role.view.js';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto.js';
import { RolesService } from './roles.service.js';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /** Every role, by name. */
  @Get()
  @RequirePermissions(Permission.RolesRead)
  async list(): Promise<RoleView[]> {
    const roles = await this.rolesService.listRoles();
    return roles.map(toRoleView);
  }

  @Get(':id')
  @RequirePermissions(Permission.RolesRead)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<RoleView> {
    return toRoleView(await this.rolesService.getRole(id));
  }

  @Post()
  @RequirePermissions(Permission.RolesCreate)
  async create(@ValidBody(CreateRoleDto) dto: CreateRoleDto): Promise<RoleView> {
    return toRoleView(await this.rolesService.createRole(dto));
  }

  /** System roles can't be renamed; the admin role keeps every permission. */
  @Patch(':id')
  @RequirePermissions(Permission.RolesUpdate)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateRoleDto) dto: UpdateRoleDto,
  ): Promise<RoleView> {
    return toRoleView(await this.rolesService.updateRole(id, dto));
  }

  /** Also takes the role away from every user. System roles can't be deleted. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.RolesDelete)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.rolesService.deleteRole(id);
  }
}
