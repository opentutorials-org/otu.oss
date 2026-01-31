//@ts-ignore
import debug from 'debug';
export const controlLogger = debug('control');
controlLogger.log = console.log.bind(console);
