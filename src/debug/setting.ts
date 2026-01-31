//@ts-ignore
import debug from 'debug';
export const settingLogger = debug('setting');
settingLogger.log = console.log.bind(console);
