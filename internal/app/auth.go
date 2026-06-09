package app

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type userClaims struct {
	UserID   int64  `json:"userId"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"isAdmin"`
	Exp      int64  `json:"exp"`
}

func hashPassword(password string, cost int) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	return string(hash), err
}

func checkPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (s *Server) signToken(claims userClaims) (string, error) {
	claims.Exp = time.Now().Add(7 * 24 * time.Hour).Unix()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	bodyBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(bodyBytes)
	unsigned := header + "." + body
	signature := sign(unsigned, s.cfg.JWTSecret)
	return unsigned + "." + signature, nil
}

func (s *Server) verifyToken(token string) (userClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return userClaims{}, errors.New("token 格式错误")
	}
	unsigned := parts[0] + "." + parts[1]
	if !hmac.Equal([]byte(parts[2]), []byte(sign(unsigned, s.cfg.JWTSecret))) {
		return userClaims{}, errors.New("token 签名错误")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return userClaims{}, err
	}
	var claims userClaims
	if err := json.Unmarshal(raw, &claims); err != nil {
		return userClaims{}, err
	}
	if claims.Exp < time.Now().Unix() {
		return userClaims{}, errors.New("token 已过期")
	}
	return claims, nil
}

func sign(value, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(value))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *Server) authenticate(r *http.Request) (userClaims, bool) {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return userClaims{}, false
	}
	claims, err := s.verifyToken(strings.TrimPrefix(auth, "Bearer "))
	if err != nil {
		return userClaims{}, false
	}
	claims.IsAdmin = s.isAdminUsername(claims.Username)
	return claims, true
}

func (s *Server) isAdminUsername(username string) bool {
	return username == s.cfg.AdminUsername || s.cfg.AdminUsernames[username]
}

func randomPassword() string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	out := make([]byte, 8)
	if _, err := rand.Read(out); err != nil {
		now := time.Now().UnixNano()
		for i := range out {
			out[i] = byte(now >> (i * 7))
		}
	}
	for i, b := range out {
		out[i] = chars[int(b)%len(chars)]
	}
	return string(out)
}
