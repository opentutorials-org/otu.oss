//@ts-ignore
import debug from 'debug';
export const reminderLogger = debug('reminder');
reminderLogger.log = console.log.bind(console);
