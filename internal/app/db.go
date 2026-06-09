package app

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

func openDB(path string) (*sql.DB, error) {
	dsn := sqliteFileURI(path) +
		"?_pragma=busy_timeout(5000)" +
		"&_pragma=foreign_keys(ON)" +
		"&_pragma=journal_mode(WAL)" +
		"&_pragma=synchronous(NORMAL)" +
		"&_pragma=temp_store(MEMORY)"

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(2)
	db.SetConnMaxIdleTime(5 * time.Minute)

	if err := ensureTables(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func ensureTables(db *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			is_admin INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS persons (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			daily_wage REAL NOT NULL DEFAULT 0,
			balance REAL NOT NULL DEFAULT 0,
			last_wage_date TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS transactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
			type TEXT NOT NULL,
			amount REAL NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			undone INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_person_id ON transactions(person_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transactions_undone ON transactions(person_id, undone, created_at)`,
	}

	for _, stmt := range stmts {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("初始化数据库失败: %w", err)
		}
	}
	return nil
}

func sqliteFileURI(path string) string {
	normalized := filepath.ToSlash(path)
	if filepath.IsAbs(path) {
		if filepath.VolumeName(path) != "" && !strings.HasPrefix(normalized, "/") {
			normalized = "/" + normalized
		}
		return (&url.URL{Scheme: "file", Path: normalized}).String()
	}
	return "file:" + strings.ReplaceAll(url.PathEscape(normalized), "%2F", "/")
}
