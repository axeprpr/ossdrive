package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

func main() {
	endpoint := getenv("OSS_ENDPOINT", "https://oss-cn-hangzhou.aliyuncs.com")
	client, err := oss.New(endpoint, os.Getenv("OSS_ACCESS_KEY_ID"), os.Getenv("OSS_ACCESS_KEY_SECRET"))
	if err != nil {
		log.Fatal(err)
	}

	bucket, err := client.Bucket(os.Getenv("OSS_BUCKET"))
	if err != nil {
		log.Fatal(err)
	}

	server := newApp(bucket, strings.Trim(os.Getenv("OSS_PREFIX"), "/"))
	log.Fatal(http.ListenAndServe(":"+getenv("PORT", "3000"), server.routes()))
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
