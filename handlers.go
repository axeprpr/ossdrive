package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

var directoryNamePattern = regexp.MustCompile(`^[\p{Han}A-Za-z0-9_-]{1,64}$`)

func (a *app) routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", index)
	mux.HandleFunc("/skills.md", skills)
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/api/list", a.list)
	mux.HandleFunc("/api/upload-url", a.uploadURL)
	mux.HandleFunc("/api/upload-complete", a.uploadComplete)
	mux.HandleFunc("/api/download-url", a.downloadURL)
	mux.HandleFunc("/api/download", a.download)
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
	pageNumber := queryInt(r, "page", 1, 1, 1_000_000)
	pageSize := queryInt(r, "page_size", 10, 10, 50)
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	sortKey := r.URL.Query().Get("sort")
	if sortKey != "size" && sortKey != "modified" {
		sortKey = "name"
	}
	direction := r.URL.Query().Get("direction")
	if direction != "desc" {
		direction = "asc"
	}
	snapshot, err := a.directory(current, r.URL.Query().Get("refresh") == "1")
	if err != nil {
		jsonOut(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	items, total := filterSortPage(snapshot.Items, query, sortKey, direction, pageNumber, pageSize)
	jsonOut(w, http.StatusOK, listResponse{Items: items, Total: total, Usage: snapshot.Usage, Page: pageNumber, PageSize: pageSize})
}

func queryInt(r *http.Request, name string, fallback, minimum, maximum int) int {
	value, err := strconv.Atoi(r.URL.Query().Get(name))
	if err != nil || value < minimum || value > maximum {
		return fallback
	}
	return value
}

func (a *app) directory(current string, refresh bool) (directorySnapshot, error) {
	if !refresh {
		a.cacheMu.RLock()
		cached, ok := a.cache[current]
		a.cacheMu.RUnlock()
		if ok && time.Now().Before(cached.ExpiresAt) {
			return cached, nil
		}
	}

	prefix := a.prefix
	if current != "" {
		if prefix != "" {
			prefix += "/"
		}
		prefix += current
	}
	if prefix != "" {
		prefix += "/"
	}

	marker := ""
	result := directorySnapshot{Items: []listItem{}}
	folders := make(map[string]bool)
	for {
		listing, err := a.bucket.ListObjects(oss.Prefix(prefix), oss.Marker(marker), oss.MaxKeys(1000))
		if err != nil {
			return directorySnapshot{}, err
		}
		for _, object := range listing.Objects {
			name := strings.TrimPrefix(a.relative(object.Key), current+"/")
			if name == ".ossdrive-folder" {
				continue
			}
			if strings.HasSuffix(name, "/.ossdrive-folder") {
				name = strings.TrimSuffix(name, "/.ossdrive-folder")
				if name != "" && !strings.Contains(name, "/") && !folders[name] {
					result.Items = append(result.Items, listItem{Name: name, Kind: "folder"})
					folders[name] = true
				}
				continue
			}
			if strings.HasSuffix(name, "/") {
				name = strings.TrimSuffix(name, "/")
				if name != "" && !strings.Contains(name, "/") && !folders[name] {
					result.Items = append(result.Items, listItem{Name: name, Kind: "folder"})
					folders[name] = true
				}
				continue
			}
			result.Usage += int64(object.Size)
			if strings.Contains(name, "/") {
				folder := strings.Split(name, "/")[0]
				if !folders[folder] {
					result.Items = append(result.Items, listItem{Name: folder, Kind: "folder"})
					folders[folder] = true
				}
				continue
			}
			result.Items = append(result.Items, listItem{Name: name, Kind: "file", Size: int64(object.Size), Modified: object.LastModified.Format(time.RFC3339)})
		}
		if !listing.IsTruncated {
			break
		}
		marker = listing.NextMarker
	}
	result.ExpiresAt = time.Now().Add(10 * time.Second)
	a.cacheMu.Lock()
	a.cache[current] = result
	a.cacheMu.Unlock()
	return result, nil
}

func filterSortPage(source []listItem, query, sortKey, direction string, pageNumber, pageSize int) ([]listItem, int) {
	query = strings.ToLower(query)
	items := make([]listItem, 0, len(source))
	for _, item := range source {
		if query == "" || strings.Contains(strings.ToLower(item.Name), query) {
			items = append(items, item)
		}
	}
	factor := 1
	if direction == "desc" {
		factor = -1
	}
	sort.SliceStable(items, func(left, right int) bool {
		a, b := items[left], items[right]
		if a.Kind != b.Kind {
			return a.Kind == "folder"
		}
		comparison := strings.Compare(a.Name, b.Name)
		switch sortKey {
		case "size":
			if a.Size < b.Size {
				comparison = -1
			} else if a.Size > b.Size {
				comparison = 1
			}
		case "modified":
			comparison = strings.Compare(a.Modified, b.Modified)
		}
		if comparison == 0 {
			comparison = strings.Compare(a.Name, b.Name)
		}
		return comparison*factor < 0
	})
	total := len(items)
	start := (pageNumber - 1) * pageSize
	if start >= total {
		return []listItem{}, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return items[start:end], total
}

func (a *app) invalidate(name string) {
	directory := path.Dir(strings.Trim(name, "/"))
	if directory == "." {
		directory = ""
	}
	a.cacheMu.Lock()
	delete(a.cache, directory)
	a.cacheMu.Unlock()
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
	if r.Method != http.MethodPost {
		jsonOut(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
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

func (a *app) uploadComplete(w http.ResponseWriter, r *http.Request) {
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
	if _, err := a.key(request.Name); err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "invalid name"})
		return
	}
	a.invalidate(request.Name)
	jsonOut(w, http.StatusOK, map[string]bool{"ok": true})
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

func (a *app) download(w http.ResponseWriter, r *http.Request) {
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
	http.Redirect(w, r, url, http.StatusFound)
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
	a.invalidate(request.Name)
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
	directoryName := path.Base(strings.TrimSuffix(request.Name, "/"))
	if !directoryNamePattern.MatchString(directoryName) {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "目录名只能包含中文、英文、数字、短横线和下划线，长度 1-64 个字符"})
		return
	}
	if err = a.bucket.PutObject(key+"/.ossdrive-folder", strings.NewReader("")); err != nil {
		log.Printf("mkdir %q: %v", key, err)
		jsonOut(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	a.invalidate(request.Name)
	jsonOut(w, http.StatusOK, map[string]bool{"ok": true})
}
