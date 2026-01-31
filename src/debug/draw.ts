//@ts-ignore
import debug from 'debug';
export const drawLogger = debug('draw');
drawLogger.log = console.log.bind(console);
