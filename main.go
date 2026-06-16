package main

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type Part struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type CelParameter struct {
	ID        int       `json:"id"`
	Yaw       float64   `json:"yaw"`
	Pitch     float64   `json:"pitch"`
	Roll      float64   `json:"roll"`
	CreatedAt time.Time `json:"created_at"`
}

var db *sql.DB

func main() {
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "${DB_USER}:${DB_PASSWORD}@tcp(db:3306)/${DB_NAME}?parseTime=true"
	}

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("DB接続失敗: %v", err)
	}
	defer db.Close()

	for i := 0; i < 5; i++ {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Println("DB接続待ち...")
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("DB接続不可: %v", err)
	}
	log.Println("✅ MySQL疎通成功!!")

	// ルートURL：簡易的な確認画面
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "AnimeCelSystem - APIサーバー起動中")
	})

	// 【新規追加】アップロードを受け付けるAPIエンドポイント
	http.HandleFunc("/api/upload", handleUpload)

	log.Println("Server running on http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}

// 【コアロジック】アップロードと自動リネームを行う関数
func handleUpload(w http.ResponseWriter, r *http.Request) {
	// POSTメソッド以外は弾く
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// 1. フォームデータの解析（文字データとファイルを受け取る）
	// 引数はメモリに載せる最大サイズ（約32MB）
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, "フォームデータの解析に失敗しました", http.StatusBadRequest)
		return
	}

	// 2. パラメータの取得と数値（float64）への変換
	partName := r.FormValue("part_name") // "body", "eyes" など
	yawStr := r.FormValue("yaw")
	pitchStr := r.FormValue("pitch")
	rollStr := r.FormValue("roll")

	yaw, err1 := strconv.ParseFloat(yawStr, 64)
	pitch, err2 := strconv.ParseFloat(pitchStr, 64)
	roll, err3 := strconv.ParseFloat(rollStr, 64)

	if partName == "" || err1 != nil || err2 != nil || err3 != nil {
		http.Error(w, "不正なパラメータです。part_name, yaw, pitch, rollを正しく入力してください", http.StatusBadRequest)
		return
	}

	// 3. ファイル（PNG）の取得
	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "画像の取得に失敗しました", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 4. DB処理：指定された座標がすでに存在するかチェック、なければ登録
	var paramID int
	// UNIQUE制約を利用して、すでにあればそのIDを取り、なければインサートする
	err = db.QueryRow("SELECT id FROM cel_parameters WHERE yaw = ? AND pitch = ? AND roll = ?", yaw, pitch, roll).Scan(&paramID)
	if err == sql.ErrNoRows {
		// 存在しないので新しく登録
		res, err := db.Exec("INSERT INTO cel_parameters (yaw, pitch, roll) VALUES (?, ?, ?)", yaw, pitch, roll)
		if err != nil {
			http.Error(w, "データベースへの座標登録に失敗しました", http.StatusInternalServerError)
			return
		}
		id, _ := res.LastInsertId()
		paramID = int(id)
		log.Printf("📌 新しい座標を登録しました: ID=%d (Y:%.2f, P:%.2f, R:%.2f)\n", paramID, yaw, pitch, roll)
	} else if err != nil {
		http.Error(w, "データベースエラーが発生しました", http.StatusInternalServerError)
		return
	}

	// 5. 【自動リネームとフォルダ自動生成のロジック】
	// 保存先フォルダの作成（例: ./uploads/body/）
	targetDir := filepath.Join("./uploads", partName)
	os.MkdirAll(targetDir, os.ModePerm)

	// 【ここがポイント！】元の名前を無視して、「Yaw_Pitch_Roll.png」という名前に強制リネーム
	// 例: 0.00_0.00_0.00.png / -1.00_0.50_-1.00.png
	newFileName := fmt.Sprintf("%.2f_%.2f_%.2f.png", yaw, pitch, roll)
	savePath := filepath.Join(targetDir, newFileName)

	// 6. サーバーのディスクにファイルを物理保存
	dst, err := os.Create(savePath)
	if err != nil {
		http.Error(w, "ファイルの作成に失敗しました", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "ファイルの保存に失敗しました", http.StatusInternalServerError)
		return
	}

	log.Printf("💾 画像を自動リネームして保存しました: %s\n", savePath)

	// クライアントへの成功レスポンス
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Successfully uploaded and renamed to %s", newFileName)
}