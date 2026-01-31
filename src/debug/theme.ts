//@ts-ignore
import debug from 'debug';
export const themeLogger = debug('theme');
themeLogger.log = console.log.bind(console);
