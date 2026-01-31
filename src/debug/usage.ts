//@ts-ignore
import debug from 'debug';
export const usageLogger = debug('usage');
usageLogger.log = console.log.bind(console);
