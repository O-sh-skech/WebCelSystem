# Goのバージョンを最新の1.26にアップ
FROM golang:1.26-alpine

# コンテナ内の作業ディレクトリを設定
WORKDIR /app

# 開発に必要なツール（gitなど）をインストール
RUN apk update && apk add --no-cache git

# ホットリロード（コードを変更したら自動で再起動するツール）のインストール
RUN go install github.com/air-verse/air@latest

# 待ち受けポートを公開
EXPOSE 8080

# コンテナ起動時にホットリロードツール「Air」を実行
CMD ["air", "-c", ".air.toml"]