//@ts-ignore
import debug from 'debug';
export const viewportLogger = debug('viewport');
viewportLogger.log = console.log.bind(console);
