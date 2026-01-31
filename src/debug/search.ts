//@ts-ignore
import debug from 'debug';
export const searchLogger = debug('search');
searchLogger.log = console.log.bind(console);
