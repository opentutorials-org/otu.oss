//@ts-ignore
import debug from 'debug';
export const withdrawLogger = debug('withdraw');
withdrawLogger.log = console.log.bind(console);
