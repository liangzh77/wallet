package app

import (
	"database/sql"
	"errors"
	"strings"
)

func (s *Server) ensureAdminUser() error {
	username := strings.TrimSpace(s.cfg.AdminUsername)
	password := s.cfg.AdminPassword
	if username == "" || password == "" {
		return nil
	}

	var id int64
	var isAdmin int
	var passwordHash string
	err := s.db.QueryRow(`SELECT id, password_hash, is_admin FROM users WHERE username = ?`, username).Scan(&id, &passwordHash, &isAdmin)
	if errors.Is(err, sql.ErrNoRows) {
		hash, err := hashPassword(password, s.cfg.BcryptCost)
		if err != nil {
			return err
		}
		_, err = s.db.Exec(`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)`, username, hash)
		return err
	}
	if err != nil {
		return err
	}
	if !checkPassword(passwordHash, password) {
		hash, err := hashPassword(password, s.cfg.BcryptCost)
		if err != nil {
			return err
		}
		_, err = s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, hash, id)
		if err != nil {
			return err
		}
	}
	if isAdmin != 1 {
		_, err = s.db.Exec(`UPDATE users SET is_admin = 1 WHERE id = ?`, id)
	}
	return err
}
