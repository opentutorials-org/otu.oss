//@ts-ignore
import debug from 'debug';
export const publishLogger = debug('publish');
publishLogger.log = console.log.bind(console);
