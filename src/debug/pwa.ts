//@ts-ignore
import debug from 'debug';
export const pwaLogger = debug('pwa');
pwaLogger.log = console.log.bind(console);
