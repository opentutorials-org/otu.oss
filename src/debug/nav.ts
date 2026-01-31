//@ts-ignore
import debug from 'debug';
export const navBottomLogger = debug('nav:bottom');
navBottomLogger.log = console.log.bind(console);

export const navPageLogger = debug('nav:page');
navPageLogger.log = console.log.bind(console);
