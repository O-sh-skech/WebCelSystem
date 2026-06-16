
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

-- 初期データの投入
INSERT INTO parts (name) VALUES ('body'), ('eyes'), ('mouth')
ON DUPLICATE KEY UPDATE name=name;