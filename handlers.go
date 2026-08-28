package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

func (a *app) routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", index)
	mux.HandleFunc("/skills.md", skills)
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/api/list", a.list)
	mux.HandleFunc("/api/upload-url", a.uploadURL)
	mux.HandleFunc("/api/download-url", a.downloadURL)
	mux.HandleFunc("/api/delete", a.delete)
	mux.HandleFunc("/api/mkdir", a.mkdir)
	return mux
}

func (a *app) key(name string) (string, error) {
	name = strings.TrimLeft(strings.ReplaceAll(name, "\\", "/"), "/")
	clean := path.Clean(name)
	if name == "" || clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || strings.Contains(name, "\x00") {
		return "", fmt.Errorf("invalid name")
	}
	if a.prefix != "" {
		return a.prefix + "/" + clean, nil
	}
	return clean, nil
}

func (a *app) relative(key string) string {
	return strings.TrimPrefix(strings.TrimPrefix(key, a.prefix), "/")
}

func jsonOut(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func health(w http.ResponseWriter, r *http.Request) {
	jsonOut(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *app) list(w http.ResponseWriter, r *http.Request) {
	current := strings.Trim(r.URL.Query().Get("prefix"), "/")
	prefix := a.prefix
	if current != "" {
		prefix += "/" + current
	}
	if prefix != "" {
		prefix += "/"
	}

	marker := ""
	result := listResponse{Files: []fileItem{}, Folders: []string{}}
	folders := make(map[string]bool)
	for {
		listing, err := a.bucket.ListObjects(oss.Prefix(prefix), oss.Marker(marker), oss.MaxKeys(1000))
		if err != nil {
			jsonOut(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		for _, object := range listing.Objects {
			name := strings.TrimPrefix(a.relative(object.Key), current+"/")
			if name == ".ossdrive-folder" {
				continue
			}
			if strings.HasSuffix(name, "/") {
				name = strings.TrimSuffix(name, "/")
				if name != "" && !strings.Contains(name, "/") && !folders[name] {
					result.Folders = append(result.Folders, name)
					folders[name] = true
				}
				continue
			}
			result.Usage += int64(object.Size)
			if strings.Contains(name, "/") {
				folder := strings.Split(name, "/")[0]
				if !folders[folder] {
					result.Folders = append(result.Folders, folder)
					folders[folder] = true
				}
				continue
			}
			result.Files = append(result.Files, fileItem{Name: name, Size: int64(object.Size), Modified: object.LastModified.Format(time.RFC3339)})
		}
		if !listing.IsTruncated {
			break
		}
		marker = listing.NextMarker
	}
	jsonOut(w, http.StatusOK, result)
}

func (a *app) allow(remote string) bool {
	ip := remote
	if host, _, err := net.SplitHostPort(remote); err == nil {
		ip = host
	}
	now := time.Now()
	a.mu.Lock()
	defer a.mu.Unlock()

	fresh := make([]time.Time, 0, len(a.uploads[ip]))
	for _, timestamp := range a.uploads[ip] {
		if now.Sub(timestamp) < time.Minute {
			fresh = append(fresh, timestamp)
		}
	}
	if len(fresh) >= 10 {
		a.uploads[ip] = fresh
		return false
	}
	a.uploads[ip] = append(fresh, now)
	return true
}

func (a *app) uploadURL(w http.ResponseWriter, r *http.Request) {
	if !a.allow(r.RemoteAddr) {
		jsonOut(w, http.StatusTooManyRequests, map[string]string{"error": "upload rate limit exceeded"})
		return
	}
	var request struct {
		Name string `json:"name"`
	}
	if json.NewDecoder(r.Body).Decode(&request) != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	key, err := a.key(request.Name)
	if err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	url, err := a.bucket.SignURL(key, oss.HTTPPut, 900)
	if err != nil {
		jsonOut(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	jsonOut(w, http.StatusOK, map[string]string{"url": url})
}

func (a *app) downloadURL(w http.ResponseWriter, r *http.Request) {
	key, err := a.key(r.URL.Query().Get("name"))
	if err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "invalid name"})
		return
	}
	url, err := a.bucket.SignURL(key, oss.HTTPGet, 900)
	if err != nil {
		jsonOut(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	jsonOut(w, http.StatusOK, map[string]string{"url": url})
}

func (a *app) delete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonOut(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var request struct {
		Name string `json:"name"`
	}
	if json.NewDecoder(r.Body).Decode(&request) != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	key, err := a.key(request.Name)
	if err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "invalid name"})
		return
	}
	if err = a.bucket.DeleteObject(key); err != nil {
		log.Printf("delete %q: %v", key, err)
		jsonOut(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	jsonOut(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) mkdir(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonOut(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var request struct {
		Name string `json:"name"`
	}
	if json.NewDecoder(r.Body).Decode(&request) != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	key, err := a.key(request.Name)
	if err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "invalid name"})
		return
	}
	if err = a.bucket.PutObject(key+"/.ossdrive-folder", strings.NewReader("")); err != nil {
		log.Printf("mkdir %q: %v", key, err)
		jsonOut(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	jsonOut(w, http.StatusOK, map[string]bool{"ok": true})
}
