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
import { CurrentUser, RequirePermissions } from '../../auth/decorators.js';
import type { Page } from '../../common/pagination.js';
import { ValidBody, ValidQuery } from '../../common/validation.js';
import { Permission } from '../permissions/permission.js';
import { CreateUserCommand } from './commands/create-user/create-user.command.js';
import { DeleteUserCommand } from './commands/delete-user/delete-user.command.js';
import { UpdateUserCommand } from './commands/update-user/update-user.command.js';
import { GetUserQuery } from './queries/get-user/get-user.query.js';
import { ListUsersQuery } from './queries/list-users/list-users.query.js';
import type { User } from './user.js';
import { toUserView, type UserView } from './user.view.js';
// The query-string DTO shares its name with the CQRS query.
import { CreateUserDto, ListUsersQuery as ListUsersQueryDto, UpdateUserDto } from './users.dto.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @RequirePermissions(Permission.UsersRead)
  async list(@ValidQuery(ListUsersQueryDto) query: ListUsersQueryDto): Promise<Page<UserView>> {
    const page = await this.queryBus.execute(new ListUsersQuery(query));
    return { ...page, items: page.items.map(toUserView) };
  }

  @Get(':id')
  @RequirePermissions(Permission.UsersRead)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<UserView> {
    return toUserView(await this.queryBus.execute(new GetUserQuery(id)));
  }

  @Post()
  @RequirePermissions(Permission.UsersCreate)
  async create(@ValidBody(CreateUserDto) dto: CreateUserDto): Promise<UserView> {
    return toUserView(await this.commandBus.execute(new CreateUserCommand(dto)));
  }

  @Patch(':id')
  @RequirePermissions(Permission.UsersUpdate)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateUserDto) dto: UpdateUserDto,
  ): Promise<UserView> {
    return toUserView(await this.commandBus.execute(new UpdateUserCommand(id, dto)));
  }

  /** Signs the user out everywhere, then deletes them. Admins can't delete themselves. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.UsersDelete)
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: User): Promise<void> {
    return this.commandBus.execute(new DeleteUserCommand(id, actor.id));
  }
}
