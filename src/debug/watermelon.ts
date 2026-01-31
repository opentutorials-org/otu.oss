//@ts-ignore
import debug from 'debug';
export const watermelonLogger = debug('watermelon');
watermelonLogger.log = console.log.bind(console);

export const turbopackLogger = debug('turbopack');
turbopackLogger.log = console.log.bind(console);
