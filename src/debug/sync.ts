//@ts-ignore
import debug from 'debug';
export const syncLogger = debug('sync');
syncLogger.log = console.log.bind(console);
