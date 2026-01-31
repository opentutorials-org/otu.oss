//@ts-ignore
import debug from 'debug';
export const cronLogger = debug('cron');
cronLogger.log = console.log.bind(console);
