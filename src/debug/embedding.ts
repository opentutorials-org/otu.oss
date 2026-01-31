//@ts-ignore
import debug from 'debug';
export const embeddingLogger = debug('embedding');
embeddingLogger.log = console.log.bind(console);
