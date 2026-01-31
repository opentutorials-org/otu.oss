//@ts-ignore
import debug from 'debug';
export const webviewLogger = debug('webview');
webviewLogger.log = console.log.bind(console);
