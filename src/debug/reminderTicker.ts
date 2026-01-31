//@ts-ignore
import debug from 'debug';
export const reminderTickerLogger = debug('reminderTicker');
reminderTickerLogger.log = console.log.bind(console);
