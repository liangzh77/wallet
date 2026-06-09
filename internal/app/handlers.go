package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type userDTO struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	IsAdmin   bool   `json:"isAdmin"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type personDTO struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	DailyWage    float64 `json:"dailyWage"`
	Balance      float64 `json:"balance"`
	LastWageDate *string `json:"lastWageDate"`
	CreatedAt    string  `json:"createdAt"`
}

type transactionDTO struct {
	ID          int64   `json:"id"`
	PersonID    int64   `json:"personId"`
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	CreatedAt   string  `json:"createdAt"`
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodGet) {
		return
	}
	var ok int
	if err := s.db.QueryRow(`SELECT 1`).Scan(&ok); err != nil || ok != 1 {
		errorJSON(w, http.StatusServiceUnavailable, "数据库不可用")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodPost) {
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		errorJSON(w, http.StatusBadRequest, "用户名和密码不能为空")
		return
	}

	var userCount int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount); err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	isAdmin := s.isAdminUsername(req.Username) || userCount == 0
	hash, err := hashPassword(req.Password, s.cfg.BcryptCost)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}

	res, err := s.db.Exec(`INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)`, req.Username, hash, boolInt(isAdmin))
	if err != nil {
		if strings.Contains(err.Error(), "constraint") {
			errorJSON(w, http.StatusConflict, "该用户名已被占用")
			return
		}
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	id, _ := res.LastInsertId()
	s.authResponse(w, http.StatusCreated, id, req.Username, isAdmin)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodPost) {
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		errorJSON(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	var id int64
	var hash string
	var storedAdmin int
	err := s.db.QueryRow(`SELECT id, password_hash, is_admin FROM users WHERE username = ?`, req.Username).Scan(&id, &hash, &storedAdmin)
	if errors.Is(err, sql.ErrNoRows) || !checkPassword(hash, req.Password) {
		errorJSON(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}

	isAdmin := s.isAdminUsername(req.Username)
	if boolInt(isAdmin) != storedAdmin {
		_, _ = s.db.Exec(`UPDATE users SET is_admin = ? WHERE id = ?`, boolInt(isAdmin), id)
	}
	s.authResponse(w, http.StatusOK, id, req.Username, isAdmin)
}

func (s *Server) authResponse(w http.ResponseWriter, status int, id int64, username string, isAdmin bool) {
	token, err := s.signToken(userClaims{UserID: id, Username: username, IsAdmin: isAdmin})
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	writeJSON(w, status, map[string]any{
		"token": token,
		"user":  userDTO{ID: id, Username: username, IsAdmin: isAdmin},
	})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodGet) {
		return
	}
	user, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, userDTO{ID: user.UserID, Username: user.Username, IsAdmin: user.IsAdmin})
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodPost) {
		return
	}
	user, ok := s.requireAuth(w, r)
	if !ok {
		return
	}
	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	if req.OldPassword == "" || len(req.NewPassword) < 6 {
		errorJSON(w, http.StatusBadRequest, "旧密码不能为空，新密码至少 6 位")
		return
	}

	var passwordHash string
	err := s.db.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, user.UserID).Scan(&passwordHash)
	if errors.Is(err, sql.ErrNoRows) {
		errorJSON(w, http.StatusNotFound, "用户不存在")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	if !checkPassword(passwordHash, req.OldPassword) {
		errorJSON(w, http.StatusUnauthorized, "旧密码不正确")
		return
	}
	newHash, err := hashPassword(req.NewPassword, s.cfg.BcryptCost)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	if _, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, newHash, user.UserID); err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handlePersons(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireWalletUser(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := s.db.Query(`
			SELECT id, name, daily_wage, balance, last_wage_date, created_at
			FROM persons WHERE user_id = ? ORDER BY created_at ASC, id ASC`, user.UserID)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		defer rows.Close()

		persons := []personDTO{}
		for rows.Next() {
			p, err := scanPerson(rows)
			if err != nil {
				errorJSON(w, http.StatusInternalServerError, "服务器错误")
				return
			}
			persons = append(persons, p)
		}
		writeJSON(w, http.StatusOK, persons)
	case http.MethodPost:
		var req struct {
			Name      string  `json:"name"`
			DailyWage float64 `json:"dailyWage"`
		}
		if !readJSON(w, r, &req) {
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			errorJSON(w, http.StatusBadRequest, "姓名不能为空")
			return
		}
		res, err := s.db.Exec(`INSERT INTO persons (user_id, name, daily_wage, balance) VALUES (?, ?, ?, 0)`, user.UserID, req.Name, cleanAmount(req.DailyWage))
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		id, _ := res.LastInsertId()
		p, err := s.getPerson(id, user.UserID)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		writeJSON(w, http.StatusCreated, p)
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "方法不允许")
	}
}

func (s *Server) handlePersonByID(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireWalletUser(w, r)
	if !ok {
		return
	}
	personID, ok := idFromPath(w, r.URL.Path, "/api/persons/")
	if !ok {
		return
	}
	if !s.personBelongsToUser(personID, user.UserID) {
		errorJSON(w, http.StatusNotFound, "成员不存在")
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req struct {
			Name      *string  `json:"name"`
			DailyWage *float64 `json:"dailyWage"`
			Balance   *float64 `json:"balance"`
		}
		if !readJSON(w, r, &req) {
			return
		}
		changed := false
		if req.Name != nil {
			name := strings.TrimSpace(*req.Name)
			if name == "" {
				errorJSON(w, http.StatusBadRequest, "姓名不能为空")
				return
			}
			_, _ = s.db.Exec(`UPDATE persons SET name = ? WHERE id = ?`, name, personID)
			changed = true
		}
		if req.DailyWage != nil {
			_, _ = s.db.Exec(`UPDATE persons SET daily_wage = ? WHERE id = ?`, cleanAmount(*req.DailyWage), personID)
			changed = true
		}
		if req.Balance != nil {
			_, _ = s.db.Exec(`UPDATE persons SET balance = ? WHERE id = ?`, cleanAmount(*req.Balance), personID)
			changed = true
		}
		if !changed {
			errorJSON(w, http.StatusBadRequest, "无更新内容")
			return
		}
		p, err := s.getPerson(personID, user.UserID)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		writeJSON(w, http.StatusOK, p)
	case http.MethodDelete:
		_, err := s.db.Exec(`DELETE FROM persons WHERE id = ?`, personID)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "方法不允许")
	}
}

func (s *Server) handleTransactions(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireWalletUser(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		personID := r.URL.Query().Get("personId")
		if personID == "all" {
			s.listAllTransactions(w, user.UserID)
			return
		}
		id, err := strconv.ParseInt(personID, 10, 64)
		if err != nil || id <= 0 {
			errorJSON(w, http.StatusBadRequest, "personId 不能为空")
			return
		}
		if !s.personBelongsToUser(id, user.UserID) {
			errorJSON(w, http.StatusNotFound, "成员不存在")
			return
		}
		txs, err := s.queryTransactions(`
			SELECT id, person_id, type, amount, description, created_at
			FROM transactions
			WHERE person_id = ? AND undone = 0
			ORDER BY created_at DESC, id DESC`, id)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		writeJSON(w, http.StatusOK, txs)
	case http.MethodPost:
		var req struct {
			PersonID    int64   `json:"personId"`
			Type        string  `json:"type"`
			Amount      float64 `json:"amount"`
			Description string  `json:"description"`
		}
		if !readJSON(w, r, &req) {
			return
		}
		if req.PersonID <= 0 || req.Type == "" {
			errorJSON(w, http.StatusBadRequest, "参数不完整")
			return
		}
		if !validTxType(req.Type) || !s.personBelongsToUser(req.PersonID, user.UserID) {
			errorJSON(w, http.StatusNotFound, "成员不存在")
			return
		}
		tx, err := s.db.Begin()
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		defer tx.Rollback()
		if _, err := tx.Exec(`DELETE FROM transactions WHERE undone = 1 AND person_id = ?`, req.PersonID); err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		res, err := tx.Exec(`INSERT INTO transactions (person_id, type, amount, description) VALUES (?, ?, ?, ?)`,
			req.PersonID, req.Type, cleanAmount(req.Amount), strings.TrimSpace(req.Description))
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		if err := tx.Commit(); err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		id, _ := res.LastInsertId()
		item, err := s.getTransaction(id)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		writeJSON(w, http.StatusCreated, item)
	default:
		errorJSON(w, http.StatusMethodNotAllowed, "方法不允许")
	}
}

func (s *Server) listAllTransactions(w http.ResponseWriter, userID int64) {
	txs, err := s.queryTransactions(`
		SELECT t.id, t.person_id, t.type, t.amount, t.description, t.created_at
		FROM transactions t
		JOIN persons p ON t.person_id = p.id
		WHERE p.user_id = ? AND t.undone = 0
		ORDER BY t.created_at DESC, t.id DESC`, userID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}

	rows, err := s.db.Query(`
		SELECT DISTINCT t.person_id
		FROM transactions t
		JOIN persons p ON t.person_id = p.id
		WHERE p.user_id = ? AND t.undone = 1`, userID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	defer rows.Close()

	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"transactions": txs, "undonePersonIds": ids})
}

func (s *Server) handleTransactionByID(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodDelete) {
		return
	}
	user, ok := s.requireWalletUser(w, r)
	if !ok {
		return
	}
	txID, ok := idFromPath(w, r.URL.Path, "/api/transactions/")
	if !ok {
		return
	}
	var exists int
	err := s.db.QueryRow(`
		SELECT 1 FROM transactions t
		JOIN persons p ON t.person_id = p.id
		WHERE t.id = ? AND p.user_id = ?`, txID, user.UserID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		errorJSON(w, http.StatusNotFound, "交易记录不存在")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	_, err = s.db.Exec(`DELETE FROM transactions WHERE id = ?`, txID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleUndoRedo(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodPost) {
		return
	}
	user, ok := s.requireWalletUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Action   string `json:"action"`
		PersonID int64  `json:"personId"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	if req.Action != "undo" && req.Action != "redo" {
		errorJSON(w, http.StatusBadRequest, "action 必须是 undo 或 redo")
		return
	}
	if !s.personBelongsToUser(req.PersonID, user.UserID) {
		errorJSON(w, http.StatusNotFound, "成员不存在")
		return
	}
	if err := s.applyUndoRedo(req.Action, req.PersonID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			if req.Action == "undo" {
				errorJSON(w, http.StatusBadRequest, "没有可撤销的操作")
			} else {
				errorJSON(w, http.StatusBadRequest, "没有可重做的操作")
			}
			return
		}
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"personId": req.PersonID})
}

func (s *Server) handleWageCheck(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodPost) {
		return
	}
	user, ok := s.requireWalletUser(w, r)
	if !ok {
		return
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("Asia/Shanghai", 8*60*60)
	}
	today := time.Now().In(loc).Format("2006-01-02")

	rows, err := s.db.Query(`SELECT id, daily_wage, balance, last_wage_date FROM persons WHERE user_id = ?`, user.UserID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	defer rows.Close()

	type payment struct {
		PersonID int64   `json:"personId"`
		Days     int     `json:"days"`
		Amount   float64 `json:"amount"`
	}
	payments := []payment{}
	for rows.Next() {
		var id int64
		var dailyWage, balance float64
		var last sql.NullString
		if err := rows.Scan(&id, &dailyWage, &balance, &last); err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		if dailyWage <= 0 {
			continue
		}
		if !last.Valid || last.String == "" {
			_, _ = s.db.Exec(`UPDATE persons SET last_wage_date = ? WHERE id = ?`, today, id)
			continue
		}
		days := daysBetween(last.String[:10], today)
		if days <= 0 {
			continue
		}
		amount := cleanAmount(float64(days) * dailyWage)
		description := fmt.Sprintf("日薪发放（%d天 x ¥%.2f）", days, dailyWage)
		tx, err := s.db.Begin()
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		_, err = tx.Exec(`DELETE FROM transactions WHERE undone = 1 AND person_id = ?`, id)
		if err == nil {
			_, err = tx.Exec(`UPDATE persons SET balance = ?, last_wage_date = ? WHERE id = ?`, cleanAmount(balance+amount), today, id)
		}
		if err == nil {
			_, err = tx.Exec(`INSERT INTO transactions (person_id, type, amount, description) VALUES (?, 'daily_wage', ?, ?)`, id, amount, description)
		}
		if err != nil {
			tx.Rollback()
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		if err := tx.Commit(); err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		payments = append(payments, payment{PersonID: id, Days: days, Amount: amount})
	}
	writeJSON(w, http.StatusOK, map[string]any{"payments": payments, "today": today})
}

func (s *Server) handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodGet) {
		return
	}
	user, ok := s.requireAdmin(w, r)
	if !ok || user.UserID == 0 {
		return
	}
	rows, err := s.db.Query(`SELECT id, username, is_admin, created_at FROM users ORDER BY created_at ASC, id ASC`)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	defer rows.Close()
	users := []userDTO{}
	for rows.Next() {
		var item userDTO
		var isAdmin int
		if err := rows.Scan(&item.ID, &item.Username, &isAdmin, &item.CreatedAt); err != nil {
			errorJSON(w, http.StatusInternalServerError, "服务器错误")
			return
		}
		item.IsAdmin = isAdmin == 1
		users = append(users, item)
	}
	writeJSON(w, http.StatusOK, users)
}

func (s *Server) handleAdminUserByID(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodDelete) {
		return
	}
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	userID, ok := idFromPath(w, r.URL.Path, "/api/admin/users/")
	if !ok {
		return
	}
	res, err := s.db.Exec(`DELETE FROM users WHERE id = ?`, userID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		errorJSON(w, http.StatusNotFound, "用户不存在")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAdminResetPassword(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodPost) {
		return
	}
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	var req struct {
		UserID int64 `json:"userId"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	if req.UserID <= 0 {
		errorJSON(w, http.StatusBadRequest, "用户 ID 不能为空")
		return
	}
	password := randomPassword()
	hash, err := hashPassword(password, s.cfg.BcryptCost)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	res, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, hash, req.UserID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "服务器错误")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		errorJSON(w, http.StatusNotFound, "用户不存在")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"newPassword": password})
}

func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		file, err := s.static.Open("index.html")
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "静态文件不存在")
			return
		}
		defer file.Close()
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.Copy(w, file)
		return
	}
	http.FileServer(s.static).ServeHTTP(w, r)
}

func (s *Server) requireAuth(w http.ResponseWriter, r *http.Request) (userClaims, bool) {
	user, ok := s.authenticate(r)
	if !ok {
		errorJSON(w, http.StatusUnauthorized, "未登录")
		return userClaims{}, false
	}
	return user, true
}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) (userClaims, bool) {
	user, ok := s.requireAuth(w, r)
	if !ok {
		return userClaims{}, false
	}
	if !user.IsAdmin {
		errorJSON(w, http.StatusForbidden, "无管理员权限")
		return userClaims{}, false
	}
	return user, true
}

func (s *Server) requireWalletUser(w http.ResponseWriter, r *http.Request) (userClaims, bool) {
	user, ok := s.requireAuth(w, r)
	if !ok {
		return userClaims{}, false
	}
	if user.IsAdmin {
		errorJSON(w, http.StatusForbidden, "管理员只用于用户管理")
		return userClaims{}, false
	}
	return user, true
}

func (s *Server) personBelongsToUser(personID, userID int64) bool {
	var exists int
	err := s.db.QueryRow(`SELECT 1 FROM persons WHERE id = ? AND user_id = ?`, personID, userID).Scan(&exists)
	return err == nil
}

func (s *Server) getPerson(personID, userID int64) (personDTO, error) {
	row := s.db.QueryRow(`
		SELECT id, name, daily_wage, balance, last_wage_date, created_at
		FROM persons WHERE id = ? AND user_id = ?`, personID, userID)
	return scanPerson(row)
}

func (s *Server) getTransaction(id int64) (transactionDTO, error) {
	row := s.db.QueryRow(`SELECT id, person_id, type, amount, description, created_at FROM transactions WHERE id = ?`, id)
	return scanTransaction(row)
}

func (s *Server) queryTransactions(query string, args ...any) ([]transactionDTO, error) {
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	txs := []transactionDTO{}
	for rows.Next() {
		item, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		txs = append(txs, item)
	}
	return txs, rows.Err()
}

func (s *Server) applyUndoRedo(action string, personID int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	whereUndone := 0
	order := "DESC"
	if action == "redo" {
		whereUndone = 1
		order = "ASC"
	}
	query := fmt.Sprintf(`SELECT id, type, amount FROM transactions WHERE person_id = ? AND undone = ? ORDER BY created_at %s, id %s LIMIT 1`, order, order)

	var txID int64
	var txType string
	var amount float64
	if err := tx.QueryRow(query, personID, whereUndone).Scan(&txID, &txType, &amount); err != nil {
		return err
	}
	var balance float64
	if err := tx.QueryRow(`SELECT balance FROM persons WHERE id = ?`, personID).Scan(&balance); err != nil {
		return err
	}
	newBalance := balanceAfter(action, txType, balance, amount)
	newUndone := 1
	if action == "redo" {
		newUndone = 0
	}
	if _, err := tx.Exec(`UPDATE transactions SET undone = ? WHERE id = ?`, newUndone, txID); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE persons SET balance = ? WHERE id = ?`, cleanAmount(newBalance), personID); err != nil {
		return err
	}
	return tx.Commit()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanPerson(row scanner) (personDTO, error) {
	var p personDTO
	var last sql.NullString
	if err := row.Scan(&p.ID, &p.Name, &p.DailyWage, &p.Balance, &last, &p.CreatedAt); err != nil {
		return p, err
	}
	if last.Valid {
		value := last.String
		p.LastWageDate = &value
	}
	p.DailyWage = cleanAmount(p.DailyWage)
	p.Balance = cleanAmount(p.Balance)
	return p, nil
}

func scanTransaction(row scanner) (transactionDTO, error) {
	var t transactionDTO
	if err := row.Scan(&t.ID, &t.PersonID, &t.Type, &t.Amount, &t.Description, &t.CreatedAt); err != nil {
		return t, err
	}
	t.Amount = cleanAmount(t.Amount)
	return t, nil
}

func balanceAfter(action, txType string, balance, amount float64) float64 {
	if action == "undo" {
		switch txType {
		case "add", "daily_wage":
			return balance - amount
		case "subtract":
			return balance + amount
		case "clear":
			return amount
		}
		return balance
	}
	switch txType {
	case "add", "daily_wage":
		return balance + amount
	case "subtract":
		return balance - amount
	case "clear":
		return 0
	}
	return balance
}

func daysBetween(from, to string) int {
	start, err1 := time.Parse("2006-01-02", from)
	end, err2 := time.Parse("2006-01-02", to)
	if err1 != nil || err2 != nil {
		return 0
	}
	return int(end.Sub(start).Hours() / 24)
}

func validTxType(value string) bool {
	switch value {
	case "add", "subtract", "clear", "daily_wage":
		return true
	default:
		return false
	}
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func cleanAmount(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return math.Round(value*100) / 100
}

func idFromPath(w http.ResponseWriter, path, prefix string) (int64, bool) {
	raw := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if raw == "" || strings.Contains(raw, "/") {
		errorJSON(w, http.StatusNotFound, "资源不存在")
		return 0, false
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		errorJSON(w, http.StatusNotFound, "资源不存在")
		return 0, false
	}
	return id, true
}

func method(w http.ResponseWriter, r *http.Request, allowed string) bool {
	if r.Method != allowed {
		errorJSON(w, http.StatusMethodNotAllowed, "方法不允许")
		return false
	}
	return true
}

func readJSON(w http.ResponseWriter, r *http.Request, out any) bool {
	defer r.Body.Close()
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		errorJSON(w, http.StatusBadRequest, "请求格式错误")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func errorJSON(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
