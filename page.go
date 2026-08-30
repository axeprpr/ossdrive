package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed frontend/dist
var pageFiles embed.FS

var frontendDist, _ = fs.Sub(pageFiles, "frontend/dist")

func index(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.FileServer(http.FS(frontendDist)).ServeHTTP(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	data, err := fs.ReadFile(frontendDist, "index.html")
	if err != nil {
		http.Error(w, "page unavailable", http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(data)
}
