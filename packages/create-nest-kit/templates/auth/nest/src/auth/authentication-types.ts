import type { User } from '../modules/users/user.js';

// Types `@CurrentUser()`, `AuthenticationContext.user` and the providers' results as our domain user.
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
