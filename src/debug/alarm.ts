//@ts-ignore
import debug from 'debug';
export const alarmLogger = debug('alarm');
alarmLogger.log = console.log.bind(console);
