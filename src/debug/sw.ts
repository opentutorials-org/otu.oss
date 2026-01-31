//@ts-ignore
import debug from 'debug';
export const swLogger = debug('sw');
swLogger.log = console.log.bind(console);
