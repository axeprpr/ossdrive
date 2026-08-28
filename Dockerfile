FROM golang:1.25-alpine AS build
WORKDIR /src
ENV GOPROXY=https://goproxy.cn,direct
ENV HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890
RUN apk add --no-cache git
COPY go.mod ./
COPY main.go ./
RUN go mod tidy
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /ossdrive .

FROM alpine:3.20
RUN adduser -D -H app
COPY --from=build /ossdrive /ossdrive
USER app
EXPOSE 3000
ENTRYPOINT ["/ossdrive"]
