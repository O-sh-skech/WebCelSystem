
-- 1. パーツ一覧（ディレクトリ名になるもの）
CREATE TABLE IF NOT EXISTS parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'body', 'eyes', 'mouth' など
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. パラメータ一覧（ファイル名、およびユークリッド距離計算の対象）
CREATE TABLE IF NOT EXISTS cel_parameters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    yaw DECIMAL(4,2) NOT NULL,   -- -1.00 〜 1.00
    pitch DECIMAL(4,2) NOT NULL,
    roll DECIMAL(4,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 同じ座標が二重登録されるのを防ぐ
    UNIQUE KEY unique_coordinates (yaw, pitch, roll)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. パーツと座標の関係を管理する中間テーブル
CREATE TABLE IF NOT EXISTS cel_assets (
    part_id INT NOT NULL,
    parameter_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (part_id, parameter_id), -- 重複登録を完全に防ぐ複合主キー
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_id) REFERENCES cel_parameters(id) ON DELETE CASCADE -- ユーザid管理も見据えている
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初期データの投入
INSERT INTO parts (name) VALUES ('body'), ('eyes'), ('mouth')
ON DUPLICATE KEY UPDATE name=name;