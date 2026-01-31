//@ts-ignore
import debug from 'debug';
export const blocknoteLogger = debug('blocknote');
blocknoteLogger.log = console.log.bind(console);
