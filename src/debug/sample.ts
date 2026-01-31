//@ts-ignore
import debug from 'debug';
export const sampleLogger = debug('sample');
sampleLogger.log = console.log.bind(console);
