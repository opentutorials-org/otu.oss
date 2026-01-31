//@ts-ignore
import debug from 'debug';
export const captionLogger = debug('caption');
captionLogger.log = console.log.bind(console);
