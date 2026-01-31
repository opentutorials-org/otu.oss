//@ts-ignore
import debug from 'debug';
export const chatLogger = debug('chat');
chatLogger.log = console.log.bind(console);
