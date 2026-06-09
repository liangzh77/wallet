package app

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Addr           string
	DBPath         string
	JWTSecret      string
	AdminUsernames map[string]bool
	AdminUsername  string
	AdminPassword  string
	BcryptCost     int
}

type fileConfig struct {
	Addr           string   `json:"addr"`
	DBPath         string   `json:"dbPath"`
	JWTSecret      string   `json:"jwtSecret"`
	AdminUsernames []string `json:"adminUsernames"`
	AdminUsername  string   `json:"adminUsername"`
	AdminPassword  string   `json:"adminPassword"`
	BcryptCost     int      `json:"bcryptCost"`
}

func ConfigFromEnv() Config {
	cfg := Config{
		Addr:           "127.0.0.1:8080",
		DBPath:         "wallet.db",
		JWTSecret:      "wallet-dev-secret-change-me",
		AdminUsernames: map[string]bool{},
		AdminUsername:  "admin",
		AdminPassword:  "admin123",
		BcryptCost:     10,
	}

	if loaded, ok := loadConfigFile(getenv("WALLET_CONFIG", "config.local.json")); ok {
		applyFileConfig(&cfg, loaded)
	}

	if value := os.Getenv("WALLET_ADDR"); value != "" {
		cfg.Addr = value
	}
	if value := os.Getenv("WALLET_DB_PATH"); value != "" {
		cfg.DBPath = value
	}
	if value := os.Getenv("JWT_SECRET"); value != "" {
		cfg.JWTSecret = value
	}
	if value := os.Getenv("ADMIN_USERNAME"); value != "" {
		cfg.AdminUsername = value
	}
	if value := os.Getenv("ADMIN_PASSWORD"); value != "" {
		cfg.AdminPassword = value
	}
	if raw := os.Getenv("BCRYPT_COST"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 4 && parsed <= 14 {
			cfg.BcryptCost = parsed
		}
	}

	for _, name := range strings.Split(os.Getenv("ADMIN_USERNAMES"), ",") {
		addAdminUsername(cfg.AdminUsernames, name)
	}

	return cfg
}

func loadConfigFile(path string) (fileConfig, bool) {
	var cfg fileConfig
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, false
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, false
	}
	return cfg, true
}

func applyFileConfig(cfg *Config, loaded fileConfig) {
	if loaded.Addr != "" {
		cfg.Addr = loaded.Addr
	}
	if loaded.DBPath != "" {
		cfg.DBPath = loaded.DBPath
	}
	if loaded.JWTSecret != "" {
		cfg.JWTSecret = loaded.JWTSecret
	}
	if loaded.AdminUsername != "" {
		cfg.AdminUsername = loaded.AdminUsername
	}
	if loaded.AdminPassword != "" {
		cfg.AdminPassword = loaded.AdminPassword
	}
	if loaded.BcryptCost >= 4 && loaded.BcryptCost <= 14 {
		cfg.BcryptCost = loaded.BcryptCost
	}
	for _, name := range loaded.AdminUsernames {
		addAdminUsername(cfg.AdminUsernames, name)
	}
}

func addAdminUsername(admins map[string]bool, name string) {
	name = strings.TrimSpace(name)
	if name != "" {
		admins[name] = true
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
