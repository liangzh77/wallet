package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"time"

	"wallet/internal/app"
)

//go:embed web/*
var webFiles embed.FS

func main() {
	staticFiles, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatal(err)
	}

	cfg := app.ConfigFromEnv()
	server, err := app.NewServer(cfg, http.FS(staticFiles))
	if err != nil {
		log.Fatal(err)
	}
	defer server.Close()

	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("钱包服务已启动: http://%s", cfg.Addr)
	log.Printf("SQLite 数据库: %s", cfg.DBPath)
	if cfg.JWTSecret == "wallet-dev-secret-change-me" {
		log.Println("提醒: 生产环境请设置 JWT_SECRET")
	}
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
