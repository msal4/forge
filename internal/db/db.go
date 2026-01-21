package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

// DB wraps the sql.DB with helper methods
type DB struct {
	*sql.DB
}

// New creates a new DB wrapper from an existing sql.DB
func New(sqlDB *sql.DB) *DB {
	return &DB{sqlDB}
}

// Open creates a new database connection with standard settings
func Open(dbPath string) (*DB, error) {
	// Ensure the data directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	// Open SQLite database with WAL mode for better performance
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_foreign_keys=on&_busy_timeout=5000", dbPath)
	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxOpenConns(1) // SQLite only supports one writer
	sqlDB.SetMaxIdleConns(1)

	return &DB{sqlDB}, nil
}

// OpenAndMigrate creates a new database connection and runs migrations
func OpenAndMigrate(dbPath string, migrationsDir string) (*DB, error) {
	db, err := Open(dbPath)
	if err != nil {
		return nil, err
	}

	// Run migrations
	if err := Migrate(db.DB, migrationsDir); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}
