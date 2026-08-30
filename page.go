package main

import (
	"embed"
	"net/http"
	"strconv"
	"strings"
)

//go:embed page.html app.js assets/logo.svg assets/pico.min.css assets/marked.min.js assets/purify.min.js
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

func vendor(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/vendor/")
	if name != "pico.min.css" && name != "marked.min.js" && name != "purify.min.js" {
		http.NotFound(w, r)
		return
	}
	data, err := pageFiles.ReadFile("assets/" + name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if name == "pico.min.css" {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	} else {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	_, _ = w.Write(data)
}
