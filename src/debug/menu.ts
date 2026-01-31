//@ts-ignore
import debug from 'debug';
export const menuLogger = debug('menu');
menuLogger.log = console.log.bind(console);
