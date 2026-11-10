import type { Config } from './config.types.ts';

export type EmailTokenPurpose = 'convite' | 'redefinicao';
export type LinkConfig = Pick<Config, 'APP_ORIGIN'>;
