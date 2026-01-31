//@ts-ignore
import debug from 'debug';
export const interactionLogger = debug('interaction');
interactionLogger.log = console.log.bind(console);
