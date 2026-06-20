import { useEffect, useState } from 'react'
import { SpaceSliders } from './SpaceSliders'

interface CelProgress {
  part_name: string
  yaw: number
  pitch: number
  roll: number
}

function App() {
  const allParts = ['body', 'eyes', 'mouth']
  
  // UIの状態管理
  const [currentPart, setCurrentPart] = useState<string>('body')
  const [sliderValues, setSliderValues] = useState({ yaw: 0, pitch: 0, roll: 0 })
  
  // ★Goの新しいAPIから取得した「全進捗リスト」を保持するState
  const [progressList, setProgressList] = useState<CelProgress[]>([])
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('画像をドロップしてリネーム名を確認してください')
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // 🌟【新規】Goから最新の進捗状況をフェッチする関数
  const fetchProgress = () => {
    fetch('/api/progress')
      .then((res) => res.json())
      .then((data) => setProgressList(data || []))
      .catch((err) => console.error('進捗取得エラー:', err))
  }

  // アプリ起動時に一回だけ現在のDBの状態を取得しておく
  useEffect(() => {
    fetchProgress()
  }, [])

  const handleSliderChange = (axis: 'yaw' | 'pitch' | 'roll', val: number) => {
    setSliderValues((prev) => ({ ...prev, [axis]: val }))
  }

  const handleFileSelect = (file: File) => {
    if (!file || file.type !== 'image/png') {
      setStatusMessage('❌ PNG形式の画像のみ受け付けます')
      return
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setStatusMessage('📸 ローカルプレビューを表示中。確定ボタンで保存します。')
  }

  // 確定ボタンを押した時の送信処理
  const handleUploadSubmit = async () => {
    if (!selectedFile) return
    setStatusMessage('⏳ Goサーバーへ送信中...')

    const formData = new FormData()
    formData.append('part_name', currentPart)
    formData.append('yaw', sliderValues.yaw.toString())
    formData.append('pitch', sliderValues.pitch.toString())
    formData.append('roll', sliderValues.roll.toString())
    formData.append('image', selectedFile)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const text = await res.text()
        setStatusMessage(`✅ ${text}`)
        setSelectedFile(null)
        setPreviewUrl(null)
        
        // 🌟【考察通り！】アップロード成功直後に最新のDB状態を再フェッチして、画面の色を連動させる
        fetchProgress()
      } else {
        setStatusMessage('❌ サーバーエラーが発生しました')
      }
    } catch (error) {
      setStatusMessage('❌ 通信エラーが発生しました')
    }
  }

  // 🌟【心臓部】現在のスライダーの座標に、どのパーツが登録されているかをリアルタイム計算して3色の状態を返す
  const getProgressStatus = () => {
    // 現在のスライダー座標に完全に一致する登録済みデータを抽出
    const matchedAssets = progressList.filter(
      (p) => p.yaw === sliderValues.yaw && p.pitch === sliderValues.pitch && p.roll === sliderValues.roll
    )

    // 1. 何も登録されていない ➔ グレー
    if (matchedAssets.length === 0) {
      return { color: '#555', text: '未着手 (画像なし)' }
    }

    // 2. 登録されているパーツ名の配列を作る (例: ['body', 'eyes'])
    const uploadedPartNames = matchedAssets.map((p) => p.part_name)
    
    // すべてのパーツ（body, eyes, mouth）が含まれているかチェック
    const isAllComplete = allParts.every((part) => uploadedPartNames.includes(part))

    // 3. 全て揃っている ➔ 緑色、一部だけ ➔ 黄色
    if (isAllComplete) {
      return { color: '#2ecc71', text: '完全完了 (全パーツ配置済み)' }
    } else {
      return { color: '#f1c40f', text: `一部完了 (${uploadedPartNames.join(', ')} 配置済み)` }
    }
  }

  const currentStatus = getProgressStatus()
  const expectedFileName = `${sliderValues.yaw.toFixed(2)}_${sliderValues.pitch.toFixed(2)}_${sliderValues.roll.toFixed(2)}.png`

  return (
    <div style={{ padding: '30px 20px', fontFamily: 'sans-serif', backgroundColor: '#1e1e24', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <style>{`
        .workspace-container { max-width: 1100px; width: 100%; }
        .editor-layout { display: flex; flex-direction: column; gap: 24px; width: 100%; margin-top: 20px; }
        .drop-zone {
          width: 100%;
          aspect-ratio: 1 / 1;
          background-color: #15151c;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #666;
          border: 2px dashed #333;
          margin-bottom: 15px;
          transition: all 0.2s ease;
          cursor: pointer;
          padding: 10px;
          box-sizing: border-box;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .drop-zone.active { border-color: #4a90e2; background-color: rgba(74, 144, 226, 0.05); color: #4a90e2; }
        .preview-img { width: 100%; height: 100%; object-fit: contain; }
        @media (min-width: 850px) {
          .editor-layout { flex-direction: row; align-items: flex-start; }
          .panel-left { flex: 1.1; }
          .panel-right { flex: 0.9; position: sticky; top: 20px; }
        }
      `}</style>

      <div className="workspace-container">
        <header style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h1 style={{ color: '#4a90e2', margin: '0 0 5px 0', fontSize: '24px' }}>🎬 AnimeCelSystem</h1>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>クリエイター向け・空間オーサリングコンソール</p>
        </header>

        <div className="editor-layout">
          
          {/* 左側：操作パネル */}
          <div className="panel-left">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {allParts.map((part) => (
                <button
                  key={part}
                  onClick={() => {
                    setCurrentPart(part)
                    setSelectedFile(null)
                    setPreviewUrl(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: currentPart === part ? '#4a90e2' : '#2a2a35',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontSize: '13px'
                  }}
                >
                  {part}
                </button>
              ))}
            </div>

            <SpaceSliders currentPart={currentPart} values={sliderValues} onChange={handleSliderChange} />

            <div style={{ marginTop: '15px', padding: '12px', borderRadius: '6px', backgroundColor: '#15151c', fontSize: '12px', fontFamily: 'monospace', color: '#aaa', borderLeft: '4px solid #4a90e2' }}>
              ℹ️ {statusMessage}
            </div>
          </div>

          {/* 右側：プレビュー ＆ 進捗ステータスパネル */}
          <div className="panel-right" style={{ backgroundColor: '#2a2a35', borderRadius: '12px', padding: '24px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)', boxSizing: 'border-box', width: '100%' }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '15px' }}>🖼️ 選択画像プレビュー</h3>
            
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px', fontFamily: 'monospace' }}>
              保存時のリネーム予測: <span style={{ color: '#e67e22' }}>{currentPart}/{expectedFileName}</span>
            </div>
            
            <div 
              className={`drop-zone ${isDragging ? 'active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault(); setIsDragging(false);
                if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0])
              }}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/png'
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files
                  if (files && files.length > 0) handleFileSelect(files[0])
                }
                input.click()
              }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="preview-img" />
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📥</div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>ここに「{currentPart}」のPNGをドロップ</span>
                  <span style={{ fontSize: '11px', color: '#555', marginTop: '5px' }}>またはクリックして選択</span>
                </>
              )}
            </div>

            <button
              onClick={handleUploadSubmit}
              disabled={!selectedFile}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedFile ? '#2ecc71' : '#444',
                color: '#fff',
                fontWeight: 'bold',
                cursor: selectedFile ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
                fontSize: '14px',
                marginBottom: '20px'
              }}
            >
              🚀 この座標とパーツでアップロード確定
            </button>

            {/* 🌟【新規】3段階で美しく光る進捗ステータスインジケータ */}
            <h4 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '13px' }}>📊 現在の座標の収集ステータス</h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#15151c',
              padding: '14px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              border: `1px solid ${currentStatus.color}44`,
              transition: 'all 0.3s ease'
            }}>
              <span style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: currentStatus.color,
                boxShadow: `0 0 12px ${currentStatus.color}`,
                transition: 'all 0.3s ease',
                flexShrink: 0
              }} />
              <div>
                <div style={{ fontWeight: 'bold', color: '#fff', transition: 'color 0.3s' }}>{currentStatus.text}</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>
                  対象座標 (Y:{sliderValues.yaw.toFixed(1)}, P:{sliderValues.pitch.toFixed(1)}, R:{sliderValues.roll.toFixed(1)})
                </div>
              </div>
            </div>

          </div> {/* /panel-right */}
        </div> {/* /editor-layout */}
      </div>
    </div>
  )
}

export default App