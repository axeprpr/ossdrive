package main

import (
	"embed"
	"net/http"
	"strconv"
)

//go:embed page.html app.js assets/logo.svg
var pageFiles embed.FS

func index(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	data, err := pageFiles.ReadFile("page.html")
	if err != nil {
		http.Error(w, "page unavailable", http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(data)
}

func logo(w http.ResponseWriter, r *http.Request) {
	data, err := pageFiles.ReadFile("assets/logo.svg")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write(data)
}

func script(w http.ResponseWriter, r *http.Request) {
	data, err := pageFiles.ReadFile("app.js")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	_, _ = w.Write(data)
}
