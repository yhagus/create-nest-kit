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
import { CurrentUser, RequirePermissions } from '../../auth/decorators.js';
import type { Page } from '../../common/pagination.js';
import { ValidBody, ValidQuery } from '../../common/validation.js';
import { Permission } from '../permissions/permission.js';
import type { User } from './user.js';
import { toUserView, type UserView } from './user.view.js';
import { CreateUserDto, ListUsersQuery, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.UsersRead)
  async list(@ValidQuery(ListUsersQuery) query: ListUsersQuery): Promise<Page<UserView>> {
    const page = await this.usersService.listUsers(query);
    return { ...page, items: page.items.map(toUserView) };
  }

  @Get(':id')
  @RequirePermissions(Permission.UsersRead)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<UserView> {
    return toUserView(await this.usersService.getUser(id));
  }

  @Post()
  @RequirePermissions(Permission.UsersCreate)
  async create(@ValidBody(CreateUserDto) dto: CreateUserDto): Promise<UserView> {
    return toUserView(await this.usersService.createUser(dto));
  }

  @Patch(':id')
  @RequirePermissions(Permission.UsersUpdate)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateUserDto) dto: UpdateUserDto,
  ): Promise<UserView> {
    return toUserView(await this.usersService.updateUser(id, dto));
  }

  /** Signs the user out everywhere, then deletes them. Admins can't delete themselves. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.UsersDelete)
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: User): Promise<void> {
    return this.usersService.deleteUser(id, actor.id);
  }
}
