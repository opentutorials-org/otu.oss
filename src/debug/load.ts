//@ts-ignore
import debug from 'debug';
export const loadLogger = debug('load');
loadLogger.log = console.log.bind(console);
