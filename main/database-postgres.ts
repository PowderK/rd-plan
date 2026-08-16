import { Pool, PoolClient, QueryResult } from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import { AsyncDB } from './database';

export interface PostgresConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean;
    max?: number; // max connections in pool
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}

/**
 * PostgreSQL Database Adapter
 * Provides the same AsyncDB interface as SQLite for drop-in replacement
 */
export class PostgreSQLDatabase implements AsyncDB {
    private pool: Pool;
    private config: PostgresConfig;

    constructor(config: PostgresConfig) {
        this.config = config;
        
        // Parse connection string if provided
        let poolConfig: any = {};
        
        if (config.connectionString) {
            const parsed = parseConnectionString(config.connectionString);
            poolConfig = {
                host: parsed.host || 'localhost',
                port: parsed.port ? parseInt(parsed.port) : 5432,
                database: parsed.database || 'rdplan',
                user: parsed.user || 'rdplan',
                password: parsed.password,
                ssl: parsed.ssl as any,
            };
        } else {
            poolConfig = {
                host: config.host || 'localhost',
                port: config.port || 5432,
                database: config.database || 'rdplan',
                user: config.user || 'rdplan',
                password: config.password,
                ssl: config.ssl ? { rejectUnauthorized: false } : false,
            };
        }

        // Pool configuration
        poolConfig.max = config.max || 20; // max connections
        poolConfig.idleTimeoutMillis = config.idleTimeoutMillis || 30000; // 30s
        poolConfig.connectionTimeoutMillis = config.connectionTimeoutMillis || 5000; // 5s

        this.pool = new Pool(poolConfig);

        // Error handling
        this.pool.on('error', (err) => {
            console.error('[PostgreSQL] Unexpected error on idle client', err);
        });

        console.log('[PostgreSQL] Pool created:', {
            host: poolConfig.host,
            port: poolConfig.port,
            database: poolConfig.database,
            user: poolConfig.user,
            max: poolConfig.max
        });
    }

    /**
     * Execute raw SQL (for schema creation, migrations, etc.)
     */
    async exec(sql: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(sql);
        } finally {
            client.release();
        }
    }

    /**
     * Run a query that modifies data (INSERT, UPDATE, DELETE)
     * Returns info about affected rows
     */
    async run(sql: string, params: any[] = []): Promise<any> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return {
                changes: result.rowCount || 0,
                lastID: result.rows[0]?.id || null
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get a single row from query
     */
    async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows[0] as T | undefined;
        } finally {
            client.release();
        }
    }

    /**
     * Get all rows from query
     */
    async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows as T[];
        } finally {
            client.release();
        }
    }

    /**
     * Prepare a statement (PostgreSQL doesn't really need prepared statements like SQLite)
     * This is for API compatibility
     */
    async prepare(sql: string) {
        return {
            run: async (...params: any[]) => await this.run(sql, params),
            get: async <T = any>(...params: any[]) => await this.get<T>(sql, params),
            all: async <T = any>(...params: any[]) => await this.all<T>(sql, params),
            finalize: async () => { /* no-op for PostgreSQL */ },
        };
    }

    /**
     * Health check - test if connection is working
     */
    async healthCheck(): Promise<boolean> {
        try {
            const result = await this.get<{ now: Date }>('SELECT NOW() as now');
            return !!result?.now;
        } catch (error) {
            console.error('[PostgreSQL] Health check failed:', error);
            return false;
        }
    }

    /**
     * Get connection pool stats
     */
    getPoolStats() {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
        };
    }

    /**
     * Close all connections in pool
     */
    async close(): Promise<void> {
        await this.pool.end();
        console.log('[PostgreSQL] Pool closed');
    }

    /**
     * Begin a transaction
     */
    async beginTransaction(): Promise<PoolClient> {
        const client = await this.pool.connect();
        await client.query('BEGIN');
        return client;
    }

    /**
     * Commit a transaction
     */
    async commitTransaction(client: PoolClient): Promise<void> {
        try {
            await client.query('COMMIT');
        } finally {
            client.release();
        }
    }

    /**
     * Rollback a transaction
     */
    async rollbackTransaction(client: PoolClient): Promise<void> {
        try {
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }
    }
}

/**
 * Initialize PostgreSQL database with schema
 */
export async function initializePostgreSQLDatabase(config: PostgresConfig): Promise<AsyncDB> {
    const db = new PostgreSQLDatabase(config);

    console.log('[PostgreSQL] Initializing database schema...');

    // Test connection
    const healthy = await db.healthCheck();
    if (!healthy) {
        throw new Error('PostgreSQL connection failed. Please check your configuration.');
    }

    // Create schema (converted from SQLite)
    await db.exec(`
        -- Personnel table
        CREATE TABLE IF NOT EXISTS personnel (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            vorname VARCHAR(255) NOT NULL,
            teilzeit INTEGER NOT NULL,
            fahrzeugfuehrer INTEGER NOT NULL,
            fahrzeugfuehrerHLFB INTEGER NOT NULL,
            nef INTEGER NOT NULL DEFAULT 0,
            itwMaschinist INTEGER NOT NULL DEFAULT 0,
            itwFahrzeugfuehrer INTEGER NOT NULL DEFAULT 0,
            sort INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            street VARCHAR(255) DEFAULT '',
            postalCode VARCHAR(20) DEFAULT '',
            city VARCHAR(255) DEFAULT '',
            phone VARCHAR(50) DEFAULT '',
            mobile VARCHAR(50) DEFAULT '',
            email VARCHAR(255) DEFAULT ''
        );

        -- Settings table
        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Holidays table
        CREATE TABLE IF NOT EXISTS holidays (
            date DATE PRIMARY KEY,
            name VARCHAR(255) NOT NULL DEFAULT ''
        );

        -- Department patterns table
        CREATE TABLE IF NOT EXISTS dept_patterns (
            start_date DATE PRIMARY KEY,
            pattern TEXT NOT NULL
        );

        -- Shift types table
        CREATE TABLE IF NOT EXISTS shift_types (
            id SERIAL PRIMARY KEY,
            code VARCHAR(50) NOT NULL UNIQUE,
            description TEXT NOT NULL
        );

        -- Qualification types table
        CREATE TABLE IF NOT EXISTS qualification_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            category VARCHAR(100),
            active INTEGER DEFAULT 1,
            sort INTEGER DEFAULT 0
        );

        -- Duty roster table
        CREATE TABLE IF NOT EXISTS duty_roster (
            id SERIAL PRIMARY KEY,
            personId INTEGER NOT NULL,
            personType VARCHAR(50) NOT NULL DEFAULT 'person',
            date DATE NOT NULL,
            value VARCHAR(50) NOT NULL,
            type VARCHAR(50) NOT NULL,
            manual_edit INTEGER DEFAULT 0,
            version INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(personId, personType, date)
        );

        -- Azubis table
        CREATE TABLE IF NOT EXISTS azubis (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            vorname VARCHAR(255) NOT NULL,
            lehrjahr INTEGER NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        );

        -- Azubi periods table
        CREATE TABLE IF NOT EXISTS azubi_periods (
            id SERIAL PRIMARY KEY,
            azubi_id INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            description TEXT,
            lehrjahr INTEGER DEFAULT 1,
            FOREIGN KEY (azubi_id) REFERENCES azubis (id) ON DELETE CASCADE
        );

        -- Qualification periods table
        CREATE TABLE IF NOT EXISTS qualification_periods (
            id SERIAL PRIMARY KEY,
            personId INTEGER NOT NULL,
            qualType VARCHAR(255) NOT NULL,
            startYM VARCHAR(7) NOT NULL,
            endYM VARCHAR(7),
            active INTEGER DEFAULT 1,
            FOREIGN KEY (personId) REFERENCES personnel (id) ON DELETE CASCADE
        );

        -- ITW doctors table
        CREATE TABLE IF NOT EXISTS itw_doctors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            vorname VARCHAR(255) NOT NULL,
            anrede VARCHAR(50) DEFAULT '',
            title VARCHAR(100) DEFAULT '',
            sort INTEGER NOT NULL DEFAULT 0
        );
        await client.query("ALTER TABLE itw_doctors ADD COLUMN IF NOT EXISTS anrede VARCHAR(50) DEFAULT ''");
        await client.query("ALTER TABLE itw_doctors ADD COLUMN IF NOT EXISTS title VARCHAR(100) DEFAULT ''");

        -- RTW vehicles table
        CREATE TABLE IF NOT EXISTS rtw_vehicles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER
        );

        -- NEF vehicles table
        CREATE TABLE IF NOT EXISTS nef_vehicles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER,
            occupancy_mode VARCHAR(10) NOT NULL DEFAULT '24h'
        );

        -- RTW vehicle months table
        CREATE TABLE IF NOT EXISTS rtw_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        );

        -- NEF vehicle months table
        CREATE TABLE IF NOT EXISTS nef_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        );

        -- Schema migrations tracking table
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Create indexes for performance
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_duty_roster_person ON duty_roster (personId, personType);
        CREATE INDEX IF NOT EXISTS idx_duty_roster_date ON duty_roster (date);
        CREATE INDEX IF NOT EXISTS idx_qualification_periods_person ON qualification_periods (personId);
        CREATE INDEX IF NOT EXISTS idx_qualification_periods_type ON qualification_periods (qualType);
        CREATE INDEX IF NOT EXISTS idx_qualification_periods_period ON qualification_periods (startYM, endYM);
        CREATE INDEX IF NOT EXISTS idx_azubi_periods_azubi ON azubi_periods (azubi_id);
    `);

    console.log('[PostgreSQL] Database schema initialized successfully');

    return db;
}

/**
 * Convert SQLite parameter syntax to PostgreSQL ($1, $2, etc.)
 */
export function convertSQLiteToPostgreSQL(sql: string, params: any[] = []): { sql: string; params: any[] } {
    let pgSql = sql;
    let paramIndex = 1;
    
    // Replace ? with $1, $2, etc.
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    // Convert SQLite-specific syntax
    pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
    pgSql = pgSql.replace(/AUTOINCREMENT/gi, 'SERIAL');
    
    return { sql: pgSql, params };
}

/**
 * Initialize ITW planning database schema (separate from main database)
 */
export async function initializeItwPlanningDatabase(config: PostgresConfig): Promise<AsyncDB> {
    const db = new PostgreSQLDatabase(config);

    // Create ITW-specific tables
    await db.exec(`
        -- ITW patterns table
        CREATE TABLE IF NOT EXISTS itw_patterns (
            start_date DATE PRIMARY KEY,
            pattern TEXT NOT NULL
        );

        -- ITW phase assignments table
        CREATE TABLE IF NOT EXISTS itw_phase_assignments (
            id SERIAL PRIMARY KEY,
            start_date DATE NOT NULL,
            person_id INTEGER NOT NULL,
            role VARCHAR(100) NOT NULL,
            UNIQUE(start_date, person_id)
        );

        -- ITW duty roster table
        CREATE TABLE IF NOT EXISTS itw_duty_roster (
            id SERIAL PRIMARY KEY,
            personId INTEGER NOT NULL,
            personType VARCHAR(50) NOT NULL DEFAULT 'person',
            date DATE NOT NULL,
            value VARCHAR(50) NOT NULL,
            type VARCHAR(50) NOT NULL,
            manual_edit INTEGER DEFAULT 0,
            UNIQUE(personId, personType, date)
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_itw_phase_assignments_date ON itw_phase_assignments (start_date);
        CREATE INDEX IF NOT EXISTS idx_itw_phase_assignments_person ON itw_phase_assignments (person_id);
        CREATE INDEX IF NOT EXISTS idx_itw_duty_roster_date_person ON itw_duty_roster (date, personId, personType);
        CREATE INDEX IF NOT EXISTS idx_itw_duty_roster_type ON itw_duty_roster (type) WHERE type != '';
    `);

    console.log('[PostgreSQL] ITW planning database schema initialized successfully');

    return db;
}
