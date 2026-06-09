package app

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

func TestWalletFlow(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	token := register(t, server, "wallet-user", "secret123")

	person := requestJSON[personDTO](t, server, http.MethodPost, "/api/persons", token, map[string]any{
		"name":      "小明",
		"dailyWage": 100,
	})
	if person.ID == 0 || person.Balance != 0 {
		t.Fatalf("成员创建结果异常: %+v", person)
	}

	updated := requestJSON[personDTO](t, server, http.MethodPut, "/api/persons/"+itoa(person.ID), token, map[string]any{
		"balance": 50,
	})
	if updated.Balance != 50 {
		t.Fatalf("余额更新失败: %+v", updated)
	}

	tx := requestJSON[transactionDTO](t, server, http.MethodPost, "/api/transactions", token, map[string]any{
		"personId":    person.ID,
		"type":        "add",
		"amount":      50,
		"description": "测试存入",
	})
	if tx.ID == 0 || tx.PersonID != person.ID {
		t.Fatalf("交易创建结果异常: %+v", tx)
	}

	requestJSON[map[string]any](t, server, http.MethodPost, "/api/undo-redo", token, map[string]any{
		"action":   "undo",
		"personId": person.ID,
	})
	afterUndo := requestJSON[personDTO](t, server, http.MethodPut, "/api/persons/"+itoa(person.ID), token, map[string]any{
		"name": "小明",
	})
	if afterUndo.Balance != 0 {
		t.Fatalf("撤销后余额应为 0，实际 %.2f", afterUndo.Balance)
	}

	requestJSON[map[string]any](t, server, http.MethodPost, "/api/undo-redo", token, map[string]any{
		"action":   "redo",
		"personId": person.ID,
	})
	people := requestJSON[[]personDTO](t, server, http.MethodGet, "/api/persons", token, nil)
	if len(people) != 1 || people[0].Balance != 50 {
		t.Fatalf("重做后余额应恢复为 50，实际 %+v", people)
	}
}

func TestHealthz(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	result := requestJSON[map[string]bool](t, server, http.MethodGet, "/healthz", "", nil)
	if !result["ok"] {
		t.Fatalf("healthz 应返回 ok=true: %+v", result)
	}
}

func TestUsersOnlySeeTheirOwnMembers(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	firstToken := register(t, server, "first", "secret123")
	secondToken := register(t, server, "second", "secret123")
	firstPerson := requestJSON[personDTO](t, server, http.MethodPost, "/api/persons", firstToken, map[string]any{
		"name":      "只属于 first",
		"dailyWage": 88,
	})
	_ = requestJSON[personDTO](t, server, http.MethodPost, "/api/persons", secondToken, map[string]any{
		"name":      "只属于 second",
		"dailyWage": 66,
	})

	firstPeople := requestJSON[[]personDTO](t, server, http.MethodGet, "/api/persons", firstToken, nil)
	secondPeople := requestJSON[[]personDTO](t, server, http.MethodGet, "/api/persons", secondToken, nil)

	if len(firstPeople) != 1 || firstPeople[0].ID != firstPerson.ID {
		t.Fatalf("first 应该只看到自己的成员: %+v", firstPeople)
	}
	if len(secondPeople) != 1 || secondPeople[0].ID == firstPerson.ID {
		t.Fatalf("second 不应看到 first 的成员: %+v", secondPeople)
	}
}

func TestUserCanChangeOwnPassword(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	token := register(t, server, "password-user", "oldpass123")
	requestJSON[map[string]bool](t, server, http.MethodPost, "/api/auth/password", token, map[string]any{
		"oldPassword": "oldpass123",
		"newPassword": "newpass456",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(mustJSON(t, map[string]any{
		"username": "password-user",
		"password": "oldpass123",
	})))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("旧密码应登录失败，实际 %d %s", rec.Code, rec.Body.String())
	}

	_ = login(t, server, "password-user", "newpass456")
}

func TestDefaultAdminLogin(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	token := login(t, server, "admin", "admin123")
	users := requestJSON[[]userDTO](t, server, http.MethodGet, "/api/admin/users", token, nil)
	if len(users) != 1 || users[0].Username != "admin" || !users[0].IsAdmin {
		t.Fatalf("默认 admin 应该是管理员: %+v", users)
	}
}

func TestDefaultAdminCanManageUsers(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	adminToken := login(t, server, "admin", "admin123")
	userToken := register(t, server, "normal", "secret123")
	me := requestJSON[userDTO](t, server, http.MethodGet, "/api/auth/me", userToken, nil)

	users := requestJSON[[]userDTO](t, server, http.MethodGet, "/api/admin/users", adminToken, nil)
	if len(users) != 2 {
		t.Fatalf("管理员应该能看到 2 个用户，实际: %+v", users)
	}

	reset := requestJSON[map[string]string](t, server, http.MethodPost, "/api/admin/reset-password", adminToken, map[string]any{
		"userId": me.ID,
	})
	if len(reset["newPassword"]) != 8 {
		t.Fatalf("重置密码应该返回 8 位新密码，实际: %+v", reset)
	}

	requestJSON[struct{}](t, server, http.MethodDelete, "/api/admin/users/"+itoa(me.ID), adminToken, nil)
	users = requestJSON[[]userDTO](t, server, http.MethodGet, "/api/admin/users", adminToken, nil)
	if len(users) != 1 || users[0].Username != "admin" {
		t.Fatalf("删除普通用户后应只剩 admin，实际: %+v", users)
	}
}

func TestAdminCannotUseWalletAPIs(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	adminToken := login(t, server, "admin", "admin123")
	req := httptest.NewRequest(http.MethodGet, "/api/persons", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	rec := httptest.NewRecorder()

	server.Routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("admin 访问钱包接口应返回 403，实际 %d %s", rec.Code, rec.Body.String())
	}
}

func TestStoredAdminFlagDoesNotGrantAdminAccess(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	token := register(t, server, "legacy", "secret123")
	me := requestJSON[userDTO](t, server, http.MethodGet, "/api/auth/me", token, nil)
	if _, err := server.db.Exec(`UPDATE users SET is_admin = 1 WHERE id = ?`, me.ID); err != nil {
		t.Fatal(err)
	}

	token = login(t, server, "legacy", "secret123")
	me = requestJSON[userDTO](t, server, http.MethodGet, "/api/auth/me", token, nil)
	if me.IsAdmin {
		t.Fatalf("普通用户不应因为数据库残留 is_admin=1 获得管理员权限: %+v", me)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("普通用户访问管理接口应返回 403，实际 %d %s", rec.Code, rec.Body.String())
	}
}

func TestTokenAdminClaimDoesNotGrantAdminAccess(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	_ = register(t, server, "tokenuser", "secret123")
	token, err := server.signToken(userClaims{UserID: 99, Username: "tokenuser", IsAdmin: true})
	if err != nil {
		t.Fatal(err)
	}

	me := requestJSON[userDTO](t, server, http.MethodGet, "/api/auth/me", token, nil)
	if me.IsAdmin {
		t.Fatalf("旧 token 里的 isAdmin=true 不应授予管理员权限: %+v", me)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("旧管理员 token 访问管理接口应返回 403，实际 %d %s", rec.Code, rec.Body.String())
	}
}

func TestExistingAdminPasswordIsRestored(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	first, err := NewServer(Config{
		DBPath:         dbPath,
		JWTSecret:      "test-secret",
		AdminUsernames: map[string]bool{},
		AdminUsername:  "admin",
		AdminPassword:  "wrong-pass",
		BcryptCost:     4,
	}, http.FS(fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte("ok")}}))
	if err != nil {
		t.Fatal(err)
	}
	first.Close()

	second, err := NewServer(Config{
		DBPath:         dbPath,
		JWTSecret:      "test-secret",
		AdminUsernames: map[string]bool{},
		AdminUsername:  "admin",
		AdminPassword:  "admin123",
		BcryptCost:     4,
	}, http.FS(fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte("ok")}}))
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()

	_ = login(t, second, "admin", "admin123")
}

func TestEmptyPersonListReturnsArray(t *testing.T) {
	server := newTestServer(t)
	defer server.Close()

	token := register(t, server, "empty", "secret123")
	req := httptest.NewRequest(http.MethodGet, "/api/persons", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	server.Routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/persons => %d %s", rec.Code, rec.Body.String())
	}
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Fatalf("空成员列表应该返回 []，实际: %s", rec.Body.String())
	}
}

func TestSQLiteFileURI(t *testing.T) {
	if got := sqliteFileURI("wallet data.db"); got != "file:wallet%20data.db" {
		t.Fatalf("相对路径 URI 异常: %s", got)
	}
	absolute := filepath.Join(t.TempDir(), "wallet data.db")
	got := sqliteFileURI(absolute)
	if !strings.HasPrefix(got, "file:") || !strings.Contains(got, "wallet%20data.db") {
		t.Fatalf("绝对路径 URI 异常: %s", got)
	}
}

func TestConfigFromFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	err := os.WriteFile(path, []byte(`{
		"addr":"127.0.0.1:19090",
		"dbPath":"configured.db",
		"jwtSecret":"configured-secret",
		"adminUsername":"root",
		"adminPassword":"configured-pass",
		"adminUsernames":["ops"],
		"bcryptCost":8
	}`), 0600)
	if err != nil {
		t.Fatal(err)
	}

	t.Setenv("WALLET_CONFIG", path)
	cfg := ConfigFromEnv()
	if cfg.Addr != "127.0.0.1:19090" ||
		cfg.DBPath != "configured.db" ||
		cfg.JWTSecret != "configured-secret" ||
		cfg.AdminUsername != "root" ||
		cfg.AdminPassword != "configured-pass" ||
		cfg.BcryptCost != 8 ||
		!cfg.AdminUsernames["ops"] {
		t.Fatalf("配置文件未正确生效: %+v", cfg)
	}
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	server, err := NewServer(Config{
		DBPath:         filepath.Join(t.TempDir(), "test.db"),
		JWTSecret:      "test-secret",
		AdminUsernames: map[string]bool{},
		AdminUsername:  "admin",
		AdminPassword:  "admin123",
		BcryptCost:     4,
	}, http.FS(fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("ok")},
	}))
	if err != nil {
		t.Fatal(err)
	}
	return server
}

func login(t *testing.T, server *Server, username, password string) string {
	t.Helper()
	data := requestJSON[map[string]any](t, server, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": password,
	})
	token, ok := data["token"].(string)
	if !ok || token == "" {
		t.Fatalf("登录未返回 token: %+v", data)
	}
	return token
}

func register(t *testing.T, server *Server, username, password string) string {
	t.Helper()
	data := requestJSON[map[string]any](t, server, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"password": password,
	})
	token, ok := data["token"].(string)
	if !ok || token == "" {
		t.Fatalf("注册未返回 token: %+v", data)
	}
	return token
}

func requestJSON[T any](t *testing.T, server *Server, method, path, token string, body any) T {
	t.Helper()
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	server.Routes().ServeHTTP(rec, req)
	if rec.Code < 200 || rec.Code >= 300 {
		t.Fatalf("%s %s => %d %s", method, path, rec.Code, rec.Body.String())
	}
	var out T
	if rec.Code == http.StatusNoContent {
		return out
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("解析响应失败: %v; body=%s", err, rec.Body.String())
	}
	return out
}

func mustJSON(t *testing.T, body any) []byte {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	return payload
}

func itoa(value int64) string {
	return strconvFormat(value)
}

func strconvFormat(value int64) string {
	if value == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	n := value
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
