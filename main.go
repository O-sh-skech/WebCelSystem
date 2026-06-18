package main

import (
	"archive/zip"
	"database/sql"
	"encoding/binary"
	"encoding/json" // 追加：JSON変換用
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
	_ "modernc.org/sqlite"
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
	log.Println("✅ MySQLとの疎通確認に成功しました！")

	// --- API エンドポイントの設定 ---
	http.HandleFunc("/api/upload", handleUpload)
	http.HandleFunc("/api/build", handleBuild)
	
	// ★【新規追加】現在登録されているパラメータ一覧をJSONで返すAPI
	http.HandleFunc("/api/parameters", handleGetParameters)

	// ★【新規追加】frontend フォルダ内のHTML/CSS/JSをルートURLで配信する設定
	// これにより http://localhost:8080/ でUI画面が開くようになります
	fs := http.FileServer(http.Dir("./frontend"))
	http.Handle("/", fs)

	log.Println("Server running on http://localhost:8080")
	log.Println("Browser running on http://localhost:5173")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}

func handleGetParameters(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")

    rows, err := db.Query("SELECT id, yaw, pitch, roll FROM cel_parameters")
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    var list []CelParameter

    for rows.Next() {
        var c CelParameter
        if err := rows.Scan(&c.ID, &c.Yaw, &c.Pitch, &c.Roll); err == nil {
            list = append(list, c)
        }
    }

    json.NewEncoder(w).Encode(list)
}

// --- 以下、既存の handleUpload, convertPNGToRGBA, handleBuild, addFileToZip はそのまま維持 ---
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
func handleBuild(w http.ResponseWriter, r *http.Request) {
	sqlitePath := "./avatar.db"
	os.Remove(sqlitePath)
	sqldb, err := sql.Open("sqlite", sqlitePath)
	if err != nil {
		http.Error(w, "演者用DBの作成に失敗しました", http.StatusInternalServerError)
		return
	}
	defer sqldb.Close()
	_, _ = sqldb.Exec(`CREATE TABLE parts (id INTEGER PRIMARY KEY, name TEXT UNIQUE);`)
	_, _ = sqldb.Exec(`CREATE TABLE cel_parameters (id INTEGER PRIMARY KEY, yaw REAL, pitch REAL, roll REAL);`)
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
	sqldb.Close()
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=avatar_package.zip")
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()
	_ = addFileToZip(zipWriter, sqlitePath, "avatar.db")
	_ = filepath.Walk("./uploads", func(path string, info os.FileInfo, err error) error {
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".rgba") {
			relPath, _ := filepath.Rel("./uploads", path)
			return addFileToZip(zipWriter, path, relPath)
		}
		return nil
	})
	os.Remove(sqlitePath)
}
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