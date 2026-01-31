//@ts-ignore
import debug from 'debug';
export const sortLogger = debug('sort');
sortLogger.log = console.log.bind(console);
