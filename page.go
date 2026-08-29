package main

import (
	"embed"
	"net/http"
)

//go:embed page.html assets/logo.svg
var pageFiles embed.FS

func index(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	data, err := pageFiles.ReadFile("page.html")
	if err != nil {
		http.Error(w, "page unavailable", http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(data)
}

func logo(w http.ResponseWriter, r *http.Request) {
	data, err := pageFiles.ReadFile("assets/logo.png")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(data)
}
