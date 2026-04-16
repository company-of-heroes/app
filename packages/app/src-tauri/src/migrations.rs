use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        // Define your migrations here
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_lobbies_table",
            sql: "CREATE TABLE lobbies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sessionId INTEGER NOT NULL UNIQUE,
                isRanked BOOLEAN NOT NULL DEFAULT 0,
                map TEXT NOT NULL,
                outcome TEXT,
                matchType INTEGER NOT NULL,
                players TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TRIGGER update_lobbies_timestamp 
            AFTER UPDATE ON lobbies
            FOR EACH ROW
            BEGIN
                UPDATE lobbies SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END;",
            kind: MigrationKind::Up,
        },
    ]
}
