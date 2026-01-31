//@ts-ignore
import debug from 'debug';
export const testLogger = debug('test');
testLogger.log = console.log.bind(console);
