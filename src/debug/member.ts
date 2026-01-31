//@ts-ignore
import debug from 'debug';
export const memberRegisterLogger = debug('member:register');
memberRegisterLogger.log = console.log.bind(console);
