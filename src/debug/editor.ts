//@ts-ignore
import debug from 'debug';
export const editorRedactorLogger = debug('editor:redactor');
export const editorViewLogger = debug('editor:view');
export const editorIndexLogger = debug('editor:index');
export const editorBackupLogger = debug('editor:backup');
export const editorBlockNoteLogger = debug('editor:blocknote');
export const editorOcrLogger = debug('editor:ocr');
export const editorAutoSaveLogger = debug('editor:autosave');
editorRedactorLogger.log = console.log.bind(console);
editorViewLogger.log = console.log.bind(console);
editorIndexLogger.log = console.log.bind(console);
editorBackupLogger.log = console.log.bind(console);
editorBlockNoteLogger.log = console.log.bind(console);
editorOcrLogger.log = console.log.bind(console);
editorAutoSaveLogger.log = console.log.bind(console);
