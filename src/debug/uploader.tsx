'use client';
export const uploaderLogger = require('debug')('uploader');
uploaderLogger.log = console.log.bind(console);
