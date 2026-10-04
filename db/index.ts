import {env} from 'cloudflare:workers';
export function database(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw Error('Online rooms are unavailable. You can still play solo.');return db;}
