package main

import (
	"database/sql"
	"encoding/binary"
	"fmt"
	"image"
	"image/draw"
	_ "image/png" // PNGのデコード機能を有効にするためのアンダーバーインポート
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
		dsn = "WebCelSystem:pass@tcp(localhost:3306)/creater_anime_cel_db?parseTime=true"
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
	log.Println("✅ MySQLとの疎通確認に成功しました！")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "AnimeCelSystem - クリエイターアプリAPI（Step4）")
	})

	http.HandleFunc("/api/upload", handleUpload)

	log.Println("Server running on http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, "フォームデータの解析に失敗しました", http.StatusBadRequest)
		return
	}

	partName := r.FormValue("part_name")
	yawStr := r.FormValue("yaw")
	pitchStr := r.FormValue("pitch")
	rollStr := r.FormValue("roll")

	yaw, err1 := strconv.ParseFloat(yawStr, 64)
	pitch, err2 := strconv.ParseFloat(pitchStr, 64)
	roll, err3 := strconv.ParseFloat(rollStr, 64)

	if partName == "" || err1 != nil || err2 != nil || err3 != nil {
		http.Error(w, "不正なパラメータです", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "画像の取得に失敗しました", http.StatusBadRequest)
		return
	}
	defer file.Close()

	var paramID int
	err = db.QueryRow("SELECT id FROM cel_parameters WHERE yaw = ? AND pitch = ? AND roll = ?", yaw, pitch, roll).Scan(&paramID)
	if err == sql.ErrNoRows {
		res, err := db.Exec("INSERT INTO cel_parameters (yaw, pitch, roll) VALUES (?, ?, ?)", yaw, pitch, roll)
		if err != nil {
			log.Printf("DBインサートエラー: %v", err)
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

	// フォルダ作成
	targetDir := filepath.Join("./uploads", partName)
	os.MkdirAll(targetDir, os.ModePerm)

	// ファイル名の決定（拡張子以外は同じ）
	baseFileName := fmt.Sprintf("%.2f_%.2f_%.2f", yaw, pitch, roll)
	pngSavePath := filepath.Join(targetDir, baseFileName+".png")
	rgbaSavePath := filepath.Join(targetDir, baseFileName+".rgba")

	// 1. まずはPNGを物理保存
	dst, err := os.Create(pngSavePath)
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
	log.Printf("💾 PNG保存完了: %s\n", pngSavePath)

	// ★【新規追加】2. 保存したPNGを読み込んで独自バイナリ(.rgba)に高速コンバート
	err = convertPNGToRGBA(pngSavePath, rgbaSavePath)
	if err != nil {
		log.Printf("❌ RGBAコンバート失敗: %v", err)
		http.Error(w, "独自バイナリへのコンバートに失敗しました", http.StatusInternalServerError)
		return
	}
	log.Printf("⚡ RGBAコンパイル完了: %s\n", rgbaSavePath)

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Successfully uploaded, renamed, and compiled to %s.rgba", baseFileName)
}

// 【コアアルゴリズム】PNGからカスタムバイナリ(.rgba)を作成する関数
func convertPNGToRGBA(pngPath, rgbaPath string) error {
	// 1. PNGファイルを開く
	f, err := os.Open(pngPath)
	if err != nil {
		return err
	}
	defer f.Close()

	// 2. 画像としてデコード
	srcImg, _, err := image.Decode(f)
	if err != nil {
		return err
	}

	bounds := srcImg.Bounds()
	width := uint16(bounds.Dx())
	height := uint16(bounds.Dy())

	// 3. メモリ上に「アルファ非乗算(NRGBA)のきれいなキャンバス」を1枚用意する
	// Unity側でテクスチャとしてそのまま綺麗に扱うための、Straight Alpha（ストレートアルファ）を保証するため
	nrgbaImg := image.NewNRGBA(bounds)

	// 4. 元の画像を、そのキャンバスに超高速で転写する（Goの内部最適化が走ります）
	draw.Draw(nrgbaImg, bounds, srcImg, bounds.Min, draw.Src)

	// 5. 書き出し用のバイナリファイルを作成
	rgbaFile, err := os.Create(rgbaPath)
	if err != nil {
		return err
	}
	defer rgbaFile.Close()

	// 6. ヘッダ情報（横幅・縦幅）をそれぞれ2バイト（リトルエンディアン）で書き込む
	if err := binary.Write(rgbaFile, binary.LittleEndian, width); err != nil {
		return err
	}
	if err := binary.Write(rgbaFile, binary.LittleEndian, height); err != nil {
		return err
	}

	// 7. メモリ上のピクセル生データ配列（Pixスライス）を、一撃でファイルに書き出す
	_, err = rgbaFile.Write(nrgbaImg.Pix)
	if err != nil {
		return err
	}

	return nil
}