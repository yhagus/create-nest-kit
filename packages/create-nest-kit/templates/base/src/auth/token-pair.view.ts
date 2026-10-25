import { UserView } from '../modules/users/user.view.js';

export class TokenPairView {
  accessToken!: string;
  /** Also set as the `refresh_token` cookie. */
  refreshToken!: string;
  /** Lifetime of the access token, in seconds. */
  expiresIn!: number;
  tokenType!: 'Bearer';
}

export class LoginView extends TokenPairView {
  user!: UserView;
}
