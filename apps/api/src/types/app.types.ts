import type { Config } from './config.types.ts';
import type { Db } from './db.types.ts';
import type { Mailer } from './mail.types.ts';
import type { Clock } from './maquete.types.ts';

export type AppDeps = { config: Config; db: Db; mailer: Mailer; clock?: Clock };
