package db

import (
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

// Migrate runs all SQL migration files in order
func Migrate(db *sql.DB, migrationsDir string) error {
	// Create migrations tracking table
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get list of migration files
	files, err := getMigrationFiles(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	// Apply each migration
	for _, file := range files {
		version := strings.TrimSuffix(filepath.Base(file), ".sql")

		// Check if already applied
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = ?", version).Scan(&count)
		if err != nil {
			return fmt.Errorf("failed to check migration status: %w", err)
		}

		if count > 0 {
			continue // Already applied
		}

		// Read migration file
		content, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", version, err)
		}

		// Execute migration in a transaction
		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("failed to begin transaction: %w", err)
		}

		// Split and execute each statement
		statements := splitSQL(string(content))
		for i, stmt := range statements {
			if stmt == "" {
				continue
			}
			if _, err := tx.Exec(stmt); err != nil {
				tx.Rollback()
				return fmt.Errorf("migration %s failed at statement %d: %w\nStatement: %s", version, i+1, err, truncate(stmt, 200))
			}
		}

		// Record migration
		if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", version, err)
		}

		fmt.Printf("Applied migration: %s\n", version)
	}

	return nil
}

// getMigrationFiles returns sorted list of .sql files in the migrations directory
func getMigrationFiles(dir string) ([]string, error) {
	var files []string

	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(d.Name(), ".sql") {
			files = append(files, path)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	sort.Strings(files)
	return files, nil
}

// splitSQL splits SQL content into individual statements
// Handles comments, string literals, and BEGIN...END blocks (triggers)
func splitSQL(content string) []string {
	// First, remove all comments
	content = removeComments(content)

	var statements []string
	var current strings.Builder
	inString := false
	stringChar := rune(0)
	inBlock := 0 // Track BEGIN...END nesting

	runes := []rune(content)
	for i := 0; i < len(runes); i++ {
		ch := runes[i]

		// Track string literals
		if (ch == '\'' || ch == '"') && !inString {
			inString = true
			stringChar = ch
		} else if inString && ch == stringChar {
			// Check for escaped quote ('' in SQL)
			if i+1 < len(runes) && runes[i+1] == stringChar {
				current.WriteRune(ch)
				i++
				current.WriteRune(runes[i])
				continue
			}
			inString = false
		}

		// Track BEGIN/END blocks (for triggers) - only outside strings
		if !inString {
			remaining := string(runes[i:])
			upperRemaining := strings.ToUpper(remaining)

			// Check for BEGIN keyword at word boundary
			if strings.HasPrefix(upperRemaining, "BEGIN") {
				afterBegin := 5
				if afterBegin >= len(remaining) || !isAlphaNum(runes[i+afterBegin]) {
					if i == 0 || !isAlphaNum(runes[i-1]) {
						inBlock++
					}
				}
			}

			// Check for END keyword at word boundary
			if strings.HasPrefix(upperRemaining, "END") {
				afterEnd := 3
				if afterEnd >= len(remaining) || !isAlphaNum(runes[i+afterEnd]) {
					if i == 0 || !isAlphaNum(runes[i-1]) {
						if inBlock > 0 {
							inBlock--
						}
					}
				}
			}
		}

		// Split on semicolons outside of strings and blocks
		if ch == ';' && !inString && inBlock == 0 {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			current.Reset()
		} else {
			current.WriteRune(ch)
		}
	}

	// Don't forget the last statement
	if stmt := strings.TrimSpace(current.String()); stmt != "" {
		statements = append(statements, stmt)
	}

	return statements
}

func isAlphaNum(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_'
}

// removeComments removes SQL comments from content
func removeComments(content string) string {
	// Remove block comments /* */
	blockComment := regexp.MustCompile(`/\*[\s\S]*?\*/`)
	content = blockComment.ReplaceAllString(content, "")

	// Remove line comments --
	lines := strings.Split(content, "\n")
	var result []string
	for _, line := range lines {
		inString := false
		stringChar := rune(0)
		commentStart := -1

		for i, ch := range line {
			if (ch == '\'' || ch == '"') && !inString {
				inString = true
				stringChar = ch
			} else if ch == stringChar && inString {
				inString = false
			} else if ch == '-' && i+1 < len(line) && line[i+1] == '-' && !inString {
				commentStart = i
				break
			}
		}

		if commentStart >= 0 {
			line = line[:commentStart]
		}
		result = append(result, line)
	}

	return strings.Join(result, "\n")
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// Initialize creates a new database connection and runs migrations
func Initialize(dbPath string, migrationsDir string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_foreign_keys=on&_busy_timeout=5000", dbPath)
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	if err := Migrate(db, migrationsDir); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}
