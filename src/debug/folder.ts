//@ts-ignore
import debug from 'debug';
export const folderLogger = debug('folder');
folderLogger.log = console.log.bind(console);

export const folderLoadingLogger = debug('folder:loading');
folderLoadingLogger.log = console.log.bind(console);

export const folderSyncLogger = debug('folder:sync');
folderSyncLogger.log = console.log.bind(console);
