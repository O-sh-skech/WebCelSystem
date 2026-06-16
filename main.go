package main

import (
	"archive/zip"
	"database/sql"
	"encoding/binary"
	"fmt"
	"image"
	"image/draw"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite" // ★純Go製のSQLiteドライバ（CGO不要）
)

type Part struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type CelParameter struct {
	ID    int     `json:"id"`
	Yaw   float64 `json:"yaw"`
	Pitch float64 `json:"pitch"`
	Roll  float64 `json:"roll"`
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
	log.Println("✅ MySQLとの疎通確認に成功しました！!")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "AnimeCelSystem - クリエイターアプリAPI（完成版）")
	})

	http.HandleFunc("/api/upload", handleUpload) //POSTで。アクセスの際に情報を渡す
	
	// ★【新規追加】演者データビルド ＆ パッキングAPI こっちはGETでアクセスするだけでいい。
	http.HandleFunc("/api/build", handleBuild)

	log.Println("Server running on http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}

// --- [既存ロジック] アップロード ＆ .rgbaコンバート (Step4のまま変更なし) ---
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

	targetDir := filepath.Join("./uploads", partName)
	os.MkdirAll(targetDir, os.ModePerm)

	baseFileName := fmt.Sprintf("%.2f_%.2f_%.2f", yaw, pitch, roll)
	pngSavePath := filepath.Join(targetDir, baseFileName+".png")
	rgbaSavePath := filepath.Join(targetDir, baseFileName+".rgba")

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

	err = convertPNGToRGBA(pngSavePath, rgbaSavePath)
	if err != nil {
		log.Printf("❌ RGBAコンバート失敗: %v", err)
		http.Error(w, "独自バイナリへのコンバートに失敗しました", http.StatusInternalServerError)
		return
	}
	log.Printf("💾 PNG/⚡RGBA 保存完了: %s\n", baseFileName)

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Successfully uploaded, renamed, and compiled to %s.rgba", baseFileName)
}

func convertPNGToRGBA(pngPath, rgbaPath string) error {
	f, err := os.Open(pngPath)
	if err != nil {
		return err
	}
	defer f.Close()

	srcImg, _, err := image.Decode(f)
	if err != nil {
		return err
	}

	bounds := srcImg.Bounds()
	width := uint16(bounds.Dx())
	height := uint16(bounds.Dy())

	nrgbaImg := image.NewNRGBA(bounds)
	draw.Draw(nrgbaImg, bounds, srcImg, bounds.Min, draw.Src)

	rgbaFile, err := os.Create(rgbaPath)
	if err != nil {
		return err
	}
	defer rgbaFile.Close()

	if err := binary.Write(rgbaFile, binary.LittleEndian, width); err != nil {
		return err
	}
	if err := binary.Write(rgbaFile, binary.LittleEndian, height); err != nil {
		return err
	}

	_, err = rgbaFile.Write(nrgbaImg.Pix)
	return err
}

// --- ★[新規追加] Step 5: 演者データビルドコアロジック ---
func handleBuild(w http.ResponseWriter, r *http.Request) {
	log.Println("🎬 演者データビルド処理を開始します...") 

	sqlitePath := "./avatar.db"
	// 過去のビルド成果物があれば一度クリーンアップ
	os.Remove(sqlitePath)

	// 1. 動的SQLiteファイルの作成と接続（ドライバ名に "sqlite" を指定）
	sqldb, err := sql.Open("sqlite", sqlitePath)
	if err != nil {
		log.Printf("SQLite作成失敗: %v", err)
		http.Error(w, "演者用DBの作成に失敗しました", http.StatusInternalServerError)
		return
	}
	defer sqldb.Close()

	// 2. あなたが設計した通りの「2つの独立したテーブル」をSQLite内に作成
	_, err = sqldb.Exec(`CREATE TABLE parts (id INTEGER PRIMARY KEY, name TEXT UNIQUE);`)
	if err != nil {
		log.Printf("SQLite partsテーブル作成失敗: %v", err)
		http.Error(w, "DBスキーマの作成に失敗しました", http.StatusInternalServerError)
		return
	}
	_, err = sqldb.Exec(`CREATE TABLE cel_parameters (id INTEGER PRIMARY KEY, yaw REAL, pitch REAL, roll REAL);`)
	if err != nil {
		log.Printf("SQLite cel_parametersテーブル作成失敗: %v", err)
		http.Error(w, "DBスキーマの作成に失敗しました", http.StatusInternalServerError)
		return
	}

	// 3. MySQLから「parts」データを全件抽出してSQLiteへ高速レプリケーション（移行）
	pRows, err := db.Query("SELECT id, name FROM parts")
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var p Part
			if err := pRows.Scan(&p.ID, &p.Name); err == nil {
				_, _ = sqldb.Exec("INSERT INTO parts (id, name) VALUES (?, ?)", p.ID, p.Name)
			}
		}
	}

	// 4. MySQLから「cel_parameters」データを全件抽出してSQLiteへレプリケーション
	cRows, err := db.Query("SELECT id, yaw, pitch, roll FROM cel_parameters")
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var c CelParameter
			if err := cRows.Scan(&c.ID, &c.Yaw, &c.Pitch, &c.Roll); err == nil {
				_, _ = sqldb.Exec("INSERT INTO cel_parameters (id, yaw, pitch, roll) VALUES (?, ?, ?, ?)", c.ID, c.Yaw, c.Pitch, c.Roll)
			}
		}
	}
	// コピー保証のため明示的にクローズ
	sqldb.Close()
	log.Println("📦 SQLite(avatar.db)へのデータ同期が完了しました")

	// 5. Zipパッキング処理の開始（レスポンスに直接書き込むストリーミング形式）
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=avatar_package.zip")

	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	// 5-A. 生成したばかりの avatar.db をZipに含める
	err = addFileToZip(zipWriter, sqlitePath, "avatar.db")
	if err != nil {
		log.Printf("Zipへのavatar.db追加失敗: %v", err)
		return
	}

	// 5-B. uploads/ フォルダ内をスキャンし、あなたの規約通り「.rgba」ファイルだけをZipへパッキング
	// (元のPNG画像はクリエイターの作業用なので、演者用Zipには含めないスマート設計！)
	err = filepath.Walk("./uploads", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// ディレクトリではなく、拡張子が .rgba のファイルのみを対象にする
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".rgba") {
			// Zip内での配置パスを決定（例: uploads/body/0.00_0.00_0.00.rgba -> body/0.00_0.00_0.00.rgba）
			relPath, err := filepath.Rel("./uploads", path)
			if err != nil {
				return err
			}
			return addFileToZip(zipWriter, path, relPath)
		}
		return nil
	})

	if err != nil {
		log.Printf("アセットのZipパッキング中にエラー: %v", err)
		return
	}

	// 一時的なSQLiteファイルをローカルから削除（クリーンアップ）
	os.Remove(sqlitePath)
	log.Println("✨ 演者用Zipパッケージのビルド ＆ 出荷が正常に完了しました！")
}

// ファイルをZip構造体に書き込むヘルパー関数
func addFileToZip(zw *zip.Writer, srcPath, destPath string) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	writer, err := zw.Create(destPath)
	if err != nil {
		return err
	}

	_, err = io.Copy(writer, srcFile)
	return err
}