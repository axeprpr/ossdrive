package main

import (
	"sync"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

type app struct {
	bucket  *oss.Bucket
	prefix  string
	mu      sync.Mutex
	uploads map[string][]time.Time
	cacheMu sync.RWMutex
	cache   map[string]directorySnapshot
}

type listItem struct {
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
}

type listResponse struct {
	Items    []listItem `json:"items"`
	Total    int        `json:"total"`
	Usage    int64      `json:"usage"`
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
}

type directorySnapshot struct {
	Items     []listItem
	Usage     int64
	ExpiresAt time.Time
}

func newApp(bucket *oss.Bucket, prefix string) *app {
	return &app{
		bucket:  bucket,
		prefix:  prefix,
		uploads: make(map[string][]time.Time),
		cache:   make(map[string]directorySnapshot),
	}
}
