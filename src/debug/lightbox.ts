//@ts-ignore
import debug from 'debug';
export const lightBoxLogger = debug('lightbox');
lightBoxLogger.log = console.log.bind(console);
