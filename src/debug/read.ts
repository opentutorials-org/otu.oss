//@ts-ignore
import debug from 'debug';
export const readIndexLogger = debug('read:index');
readIndexLogger.log = console.log.bind(console);

export const readViewLogger = debug('read:view');
readViewLogger.log = console.log.bind(console);
