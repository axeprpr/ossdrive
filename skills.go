package main

import (
	_ "embed"
	"net/http"
	"strings"
)

//go:embed skills.md
var skillInstructions []byte

func skills(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/skills.md" {
		http.NotFound(w, r)
		return
	}
	protocol := "http"
	if r.TLS != nil {
		protocol = "https"
	} else if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
		protocol = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	baseURL := protocol + "://" + r.Host
	content := strings.ReplaceAll(string(skillInstructions), "{{BASE_URL}}", baseURL)
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write([]byte(content))
}
