import type { ROLES, USER_STATUSES } from '../roles.ts';

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
