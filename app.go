package main

import (
	"strings"
	"sync"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

type app struct {
	bucket  *oss.Bucket
	publicBase string
	prefix  string
	mu      sync.Mutex
	uploads map[string][]time.Time
}

type fileItem struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
}

type listResponse struct {
	Files   []fileItem `json:"files"`
	Folders []string   `json:"folders"`
	Usage   int64      `json:"usage"`
}

func newApp(bucket *oss.Bucket, prefix, publicBase string) *app {
	return &app{bucket: bucket, publicBase: strings.TrimRight(publicBase, "/"), prefix: prefix, uploads: make(map[string][]time.Time)}
}
