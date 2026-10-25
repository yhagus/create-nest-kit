import { describeRolesRepositoryContract } from '../contracts/roles-repository.contract.js';
import { describeSessionsRepositoryContract } from '../contracts/sessions-repository.contract.js';
import { describeUsersRepositoryContract } from '../contracts/users-repository.contract.js';
import { createInMemoryRepositories } from './in-memory-repositories.js';

// The fakes the unit tests use must behave like the real repositories.
const createRepositories = async () => createInMemoryRepositories();

describeUsersRepositoryContract(createRepositories);
describeRolesRepositoryContract(createRepositories);
describeSessionsRepositoryContract(createRepositories);
