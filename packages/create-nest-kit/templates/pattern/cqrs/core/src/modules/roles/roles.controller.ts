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
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RequirePermissions } from '../../auth/decorators.js';
import { ValidBody } from '../../common/validation.js';
import { Permission } from '../permissions/permission.js';
import { CreateRoleCommand } from './commands/create-role/create-role.command.js';
import { DeleteRoleCommand } from './commands/delete-role/delete-role.command.js';
import { UpdateRoleCommand } from './commands/update-role/update-role.command.js';
import { GetRoleQuery } from './queries/get-role/get-role.query.js';
import { ListRolesQuery } from './queries/list-roles/list-roles.query.js';
import { type RoleView, toRoleView } from './role.view.js';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto.js';

@Controller('roles')
export class RolesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** Every role, by name. */
  @Get()
  @RequirePermissions(Permission.RolesRead)
  async list(): Promise<RoleView[]> {
    const roles = await this.queryBus.execute(new ListRolesQuery());
    return roles.map(toRoleView);
  }

  @Get(':id')
  @RequirePermissions(Permission.RolesRead)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<RoleView> {
    return toRoleView(await this.queryBus.execute(new GetRoleQuery(id)));
  }

  @Post()
  @RequirePermissions(Permission.RolesCreate)
  async create(@ValidBody(CreateRoleDto) dto: CreateRoleDto): Promise<RoleView> {
    return toRoleView(await this.commandBus.execute(new CreateRoleCommand(dto)));
  }

  /** System roles can't be renamed; the admin role keeps every permission. */
  @Patch(':id')
  @RequirePermissions(Permission.RolesUpdate)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateRoleDto) dto: UpdateRoleDto,
  ): Promise<RoleView> {
    return toRoleView(await this.commandBus.execute(new UpdateRoleCommand(id, dto)));
  }

  /** Also takes the role away from every user. System roles can't be deleted. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.RolesDelete)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.commandBus.execute(new DeleteRoleCommand(id));
  }
}
