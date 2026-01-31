//@ts-ignore
import debug from 'debug';
export const refreshLogger = debug('refresh');
refreshLogger.log = console.log.bind(console);
