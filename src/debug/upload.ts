//@ts-ignore
import debug from 'debug';
export const syncLogger = debug('upload');
syncLogger.log = console.log.bind(console);

export const uploadLogger = debug('upload');
uploadLogger.log = console.log.bind(console);
