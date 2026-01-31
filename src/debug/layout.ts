//@ts-ignore
import debug from 'debug';
export const layoutChatLogger = debug('layout:chat');
layoutChatLogger.log = console.log.bind(console);
