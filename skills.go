package main

import (
	_ "embed"
	"net/http"
)

//go:embed skills.md
var skillInstructions []byte

func skills(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/skills.md" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(skillInstructions)
}
