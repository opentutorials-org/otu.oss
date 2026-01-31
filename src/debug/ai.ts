//@ts-ignore
import debug from 'debug';
export const aiLogger = debug('ai');
aiLogger.log = console.log.bind(console);
