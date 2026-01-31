import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import migrations from './migrations';
import { Database } from '@nozbe/watermelondb';
import Page from './model/Page';
import Folder from './model/Folder';
import Alarm from './model/Alarm';

const adapter = new LokiJSAdapter({
    schema,
    // (You might want to comment out migrations for development purposes -- see Migrations documentation)
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    // dbName: 'myapp', // optional db name

    // --- Optional, but recommended event handlers:

    onQuotaExceededError: (error) => {
        // Browser ran out of disk space -- offer the user to reload the app or log out
    },
    onSetUpError: (error) => {
        // Database failed to load -- offer the user to reload the app or log out
    },
    extraIncrementalIDBOptions: {
        onDidOverwrite: () => {
            // Called when this adapter is forced to overwrite contents of IndexedDB.
            // This happens if there's another open tab of the same app that's making changes.
            // Try to synchronize the app now, and if user is offline, alert them that if they close this
            // tab, some data may be lost
        },
        onversionchange: () => {
            // database was deleted in another browser tab (user logged out), so we must make sure we delete
            // it in this tab as well - usually best to just refresh the page
            // if (checkIfUserIsLoggedIn()) {
            //   window.location.reload();
            // }
        },
    },
});
export const database = new Database({
    adapter,
    modelClasses: [Page, Folder, Alarm],
});
