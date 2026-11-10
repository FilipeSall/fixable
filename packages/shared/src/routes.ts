export const API = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  tokenInfo: (token: string) => `/api/auth/tokens/${token}`,
  acceptInvite: '/api/auth/invite/accept',
  forgot: '/api/auth/password/forgot',
  reset: '/api/auth/password/reset',
};
