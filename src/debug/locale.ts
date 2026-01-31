//@ts-ignore
import debug from 'debug';
export const localeLogger = debug('locale');
localeLogger.log = console.log.bind(console);
