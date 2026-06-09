package app

import (
	"database/sql"
	"net/http"
)

type Server struct {
	cfg    Config
	db     *sql.DB
	static http.FileSystem
}

func NewServer(cfg Config, static http.FileSystem) (*Server, error) {
	db, err := openDB(cfg.DBPath)
	if err != nil {
		return nil, err
	}
	server := &Server{cfg: cfg, db: db, static: static}
	if err := server.ensureAdminUser(); err != nil {
		db.Close()
		return nil, err
	}
	return server, nil
}

func (s *Server) Close() error {
	return s.db.Close()
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/api/auth/register", s.handleRegister)
	mux.HandleFunc("/api/auth/login", s.handleLogin)
	mux.HandleFunc("/api/auth/me", s.handleMe)
	mux.HandleFunc("/api/auth/password", s.handleChangePassword)
	mux.HandleFunc("/api/persons", s.handlePersons)
	mux.HandleFunc("/api/persons/", s.handlePersonByID)
	mux.HandleFunc("/api/transactions", s.handleTransactions)
	mux.HandleFunc("/api/transactions/", s.handleTransactionByID)
	mux.HandleFunc("/api/wages/check", s.handleWageCheck)
	mux.HandleFunc("/api/undo-redo", s.handleUndoRedo)
	mux.HandleFunc("/api/admin/users", s.handleAdminUsers)
	mux.HandleFunc("/api/admin/users/", s.handleAdminUserByID)
	mux.HandleFunc("/api/admin/reset-password", s.handleAdminResetPassword)
	mux.HandleFunc("/", s.handleStatic)
	return securityHeaders(mux)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}
