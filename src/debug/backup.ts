//@ts-ignore
import debug from 'debug';
export const backupLogger = debug('backup');
backupLogger.log = console.log.bind(console);
