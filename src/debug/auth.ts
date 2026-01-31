//@ts-ignore
import debug from 'debug';
export const authLogger = debug('auth');
authLogger.log = console.log.bind(console);
