//@ts-ignore
import debug from 'debug';
export const middleWareLogger = debug('middleware');
middleWareLogger.log = console.log.bind(console);

export const utf8Logger = debug('middleware:utf8');
utf8Logger.log = console.log.bind(console);

export const cookieLogger = debug('middleware:cookie');
cookieLogger.log = console.log.bind(console);
