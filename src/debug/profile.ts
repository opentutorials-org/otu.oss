//@ts-ignore
import debug from 'debug';
export const profileLogger = debug('profile');
profileLogger.log = console.log.bind(console);
