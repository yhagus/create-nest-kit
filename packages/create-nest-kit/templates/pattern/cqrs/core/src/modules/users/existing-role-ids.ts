import { RolesRepository } from '../roles/roles.repository.js';
import { UnknownRoleIdsException } from './users.repository.js';

/** Each of `roleIds` once, after checking that every one of them is a role. @throws UnknownRoleIdsException */
export async function existingRoleIds(
  roles: RolesRepository,
  roleIds: readonly string[],
): Promise<string[]> {
  const distinctIds = [...new Set(roleIds)];
  if (distinctIds.length === 0) return distinctIds;
  const found = new Set((await roles.findByIds(distinctIds)).map((role) => role.id));
  const unknownIds = distinctIds.filter((id) => !found.has(id));
  if (unknownIds.length > 0) throw new UnknownRoleIdsException(unknownIds);
  return distinctIds;
}
