import { Pool } from 'pg';

class DatabaseSingleton {
    private static instance: DatabaseSingleton;
    public pool: Pool;

    private constructor() {
        let connectionString;
        if (process.env.SUPABASE_DATABASE_URL) {
            connectionString = process.env.SUPABASE_DATABASE_URL;
        } else {
            throw new Error(
                '.env에 process.env.SUPABASE_DATABASE_URL 설정이 누락 되었습니다. .env.template 파일을 참고해주세요.'
            );
        }

        this.pool = new Pool({
            connectionString: connectionString,
        });

        this.pool.on('error', (err) => {
            //winston.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
    }

    static getInstance() {
        if (!DatabaseSingleton.instance) {
            DatabaseSingleton.instance = new DatabaseSingleton();
        }
        return DatabaseSingleton.instance;
    }
}

export const pool = DatabaseSingleton.getInstance().pool;
