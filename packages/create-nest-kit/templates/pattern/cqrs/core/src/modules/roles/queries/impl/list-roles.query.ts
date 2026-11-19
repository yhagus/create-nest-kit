import { Query } from '@nestjs/cqrs';
import type { Role } from '../../role.js';

/** Every role, by name. */
export class ListRolesQuery extends Query<Role[]> {}
