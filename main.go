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
	ID       int     `json:"id,omitempty"`        // omitemptyを付けると、0（未設定）の時にJSONから自動で消えて綺麗になります
	PartName string  `json:"part_name,omitempty"` // 🌟ここに追加！
	Yaw      float64 `json:"yaw"`
	Pitch    float64 `json:"pitch"`
	Roll     float64 `json:"roll"`
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
	http.HandleFunc("/api/progress", handleGetProgress)

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

// DBから現在の中間テーブルの関係性をすべて取得してフロントに返すAPI
// DBから現在の中間テーブルの関係性を集計してフロントに返すAPI
func handleGetProgress(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// 1. 🌟 まず現在の「登録されているパーツの総数」を動的に取得する（拡張性対策）
	var totalPartsCount int
	err := db.QueryRow("SELECT COUNT(*) FROM parts").Scan(&totalPartsCount)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. 🌟 座標ごとに「登録されているパーツの数」を集計して取得する
	rows, err := db.Query(`
		SELECT cp.yaw, cp.pitch, cp.roll, COUNT(ca.part_id) as asset_count
		FROM cel_parameters cp
		JOIN cel_assets ca ON cp.id = ca.parameter_id
		GROUP BY cp.id, cp.yaw, cp.pitch, cp.roll
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var progressList []CelParameter = []CelParameter{}
	for rows.Next() {
		var p CelParameter
		var assetCount int

		if err := rows.Scan(&p.Yaw, &p.Pitch, &p.Roll, &assetCount); err == nil {
			// 3. 🌟 動的に取得したパーツ総数と一致するかでステータスIDを決定！
			if assetCount == totalPartsCount {
				p.ID = 1 // 完全完了（すべてのパーツが揃っている）
			} else {
				p.ID = 0 // 未完了 / 一部完了
			}
			progressList = append(progressList, p)
		}
	}

	json.NewEncoder(w).Encode(progressList)
}
// --- handleUpload の書き換え ---
func handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, "フォームデータの解析に失敗しました。", http.StatusBadRequest)
		return
	}

	partName := r.FormValue("part_name")
	yaw, err1 := strconv.ParseFloat(r.FormValue("yaw"), 64)
	pitch, err2 := strconv.ParseFloat(r.FormValue("pitch"), 64)
	roll, err3 := strconv.ParseFloat(r.FormValue("roll"), 64)
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

	// 🌟【Step 0, 1, 3】新設したDBヘルパー関数を呼び出す（今回は "INSERT" アクションを指定）
	err = syncCelMetadata(partName, yaw, pitch, roll, "INSERT")
	if err != nil {
		log.Printf("❌ DB同期エラー: %v", err)
		http.Error(w, "データベースの更新に失敗しました", http.StatusInternalServerError)
		return
	}

	// ディレクトリの作成とPNGファイルの保存
	targetDir := filepath.Join("./uploads", partName)
	os.MkdirAll(targetDir, os.ModePerm)
	baseFileName := fmt.Sprintf("%.2f_%.2f_%.2f", yaw, pitch, roll)
	pngSavePath := filepath.Join(targetDir, baseFileName+".png")

	dst, err := os.Create(pngSavePath)
	if err != nil {
		http.Error(w, "ファイルの作成に失敗しました", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err = io.Copy(dst, file); err != nil {
		http.Error(w, "ファイルの保存に失敗しました", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "「%s」として中間テーブルへの登録に成功し、%s に保存しました", partName, baseFileName+".png")
}

// 🌟【新規実装】DBへの検索・インサート・将来の拡張を担うコアヘルパー関数
func syncCelMetadata(partName string, yaw, pitch, roll float64, action string) error {
	// 初期値は 0（＝まだDBに見つかっていない状態）
	partID := 0
	paramID := 0

	// ==========================================
	// フェーズ 1: 純粋な検索（IDの特定のみを行う）
	// ==========================================

	// 1. parts テーブルの検索
	err := db.QueryRow("SELECT id FROM parts WHERE name = ?", partName).Scan(&partID)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("parts検索失敗: %w", err)
	}

	// 2. cel_parameters テーブルの検索
	err = db.QueryRow("SELECT id FROM cel_parameters WHERE yaw = ? AND pitch = ? AND roll = ?", yaw, pitch, roll).Scan(&paramID)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("parameters検索失敗: %w", err)
	}

	// ==========================================
	// フェーズ 2: アクションに応じた処理の分岐
	// ==========================================
	switch action {
	case "INSERT":
		// 【パーツのインサート】
		// 検索フェーズで ID が 0 のまま（見つからなかった）なら、ここで初めてインサートする
		if partID == 0 {
			res, err := db.Exec("INSERT INTO parts (name) VALUES (?)", partName)
			if err != nil {
				return fmt.Errorf("parts登録失敗: %w", err)
			}
			id, _ := res.LastInsertId()
			partID = int(id)
			log.Printf("🆕 parts に新しいパーツを登録しました: ID=%d (%s)", partID, partName)
		}

		// 【座標パラメータのインサート】
		// 検索フェーズで ID が 0 のままなら、ここで初めてインサートする
		if paramID == 0 {
			res, err := db.Exec("INSERT INTO cel_parameters (yaw, pitch, roll) VALUES (?, ?, ?)", yaw, pitch, roll)
			if err != nil {
				return fmt.Errorf("parameters登録失敗: %w", err)
			}
			id, _ := res.LastInsertId()
			paramID = int(id)
			log.Printf("🆕 cel_parameters に新しい座標を登録しました: ID=%d (Y:%.2f, P:%.2f, R:%.2f)", paramID, yaw, pitch, roll)
		}

		// 【中間テーブル (cel_assets) への登録】
		var dummy int
		err = db.QueryRow("SELECT part_id FROM cel_assets WHERE part_id = ? AND parameter_id = ?", partID, paramID).Scan(&dummy)
		if err == sql.ErrNoRows {
			_, err = db.Exec("INSERT INTO cel_assets (part_id, parameter_id) VALUES (?, ?)", partID, paramID)
			if err != nil {
				return fmt.Errorf("中間テーブルへの登録失敗: %w", err)
			}
			log.Printf("🔗 中間テーブルにリレーションを記録しました: PartID=%d <-> ParamID=%d", partID, paramID)
		}

	case "UPDATE":
		// 将来、名前変更などのUPDATE要求が来た時：
		// もし partID == 0 なら「そもそも変更対象がないよ」と安全に弾くことができる！
		if partID == 0 {
			return fmt.Errorf("変更対象のパーツが見つかりません: %s", partName)
		}
		// ここに安全なUPDATE処理を書く

	case "DELETE":
		// 将来、削除要求が来た時：
		// もし最初からデータがなければ、何もせず安全に終了できる
		if partID == 0 || paramID == 0 {
			log.Println("⚠️ 削除対象のデータが既に存在しません。処理をスキップします。")
			return nil
		}
		// ここに安全なDELETE処理を書く
	}

	// ==========================================
	// デバッグ用の中身全出力（変更なし）
	// ==========================================
	debugRows, dErr := db.Query(`
		SELECT p.name, cp.yaw, cp.pitch, cp.roll 
		FROM cel_assets ca
		JOIN parts p ON ca.part_id = p.id
		JOIN cel_parameters cp ON ca.parameter_id = cp.id
	`)
	if dErr == nil {
		log.Println("📊 [DB DEBUG] 現在の中間テーブル (cel_assets) の中身:")
		for debugRows.Next() {
			var pname string
			var y, p, r float64
			if err := debugRows.Scan(&pname, &y, &p, &r); err == nil {
				log.Printf("  🔹 [関係成立] Part: %s | 座標: (Y:%.2f, P:%.2f, R:%.2f)", pname, y, p, r)
			}
		}
		log.Println("==================================================")
		debugRows.Close()
	}

	return nil
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