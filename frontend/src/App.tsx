import { useEffect, useState } from 'react'
import { LeftBox } from './components/LeftBox/LeftBox' 
import { RightBox } from './components/RightBox/RightBox'  
import styles from './App.module.css'

interface CelParameter {
  part_name: string
  yaw: number
  pitch: number
  roll: number
}

function App() {
  const allParts = ['body', 'eyes', 'mouth']
  
  // 状態管理（State）
  const [currentPart, setCurrentPart] = useState<string>('body')
  const [sliderValues, setSliderValues] = useState({ yaw: 0, pitch: 0, roll: 0 })
  const [progressList, setProgressList] = useState<CelParameter[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('画像をドロップしてリネーム名を確認してください')
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const fetchProgress = () => {
    fetch('/api/progress')
      .then((res) => res.json())
      .then((data) => setProgressList(data || []))
      .catch((err) => console.error('進捗取得エラー:', err))
  }

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
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const text = await res.text()
        setStatusMessage(`✅ ${text}`)
        setSelectedFile(null)
        setPreviewUrl(null)
        fetchProgress() // 最新状態をリロード
      } else {
        setStatusMessage('❌ サーバーエラーが発生しました')
      }
    } catch (error) {
      setStatusMessage('❌ 通信エラーが発生しました')
    }
  }

  // 🌟【心臓部】現在の座標の進捗ステータスを割り出す
  const getProgressStatus = () => {
    const matchedAssets = progressList.filter(
      (p) => p.yaw === sliderValues.yaw && p.pitch === sliderValues.pitch && p.roll === sliderValues.roll
    )

    if (matchedAssets.length === 0) {
      return { color: '#555', text: '未着手 (画像なし)' } // グレー
    }

    const uploadedPartNames = matchedAssets.map((p) => p.part_name)
    const isAllComplete = allParts.every((part) => uploadedPartNames.includes(part))

    if (isAllComplete) {
      return { color: '#2ecc71', text: '完全完了 (全パーツ配置済み)' } // 緑
    } else {
      return { color: '#f1c40f', text: `一部完了 (${uploadedPartNames.join(', ')} 配置済み)` } // 黄
    }
  }

  const currentStatus = getProgressStatus()
  const expectedFileName = `${sliderValues.yaw.toFixed(2)}_${sliderValues.pitch.toFixed(2)}_${sliderValues.roll.toFixed(2)}.png`

  return (
    <div className={styles.app}>
      
      

      <div className={styles.workspaceContainer}>
        <header className={styles.appHeader}>
          <h1 className={styles.appTitle}>🎬 AnimeCelSystem</h1>
          <p className={styles.appSubtitle}>クリエイター向け・空間オーサリングコンソール</p>
        </header>

        <div className={styles.editorLayout}>
          {/* 左コンポーネント：進捗色(currentStatus.color)を注入 */}
          <LeftBox
            allParts={allParts}
            currentPart={currentPart}
            setCurrentPart={(part) => {
              setCurrentPart(part)
              setSelectedFile(null)
              setPreviewUrl(null)
            }}
            sliderValues={sliderValues}
            onSliderChange={handleSliderChange}
            statusMessage={statusMessage}
            sliderColor={currentStatus.color}
          />

          {/* 右コンポーネント：プレビューと送信処理 */}
          <RightBox
            currentPart={currentPart}
            expectedFileName={expectedFileName}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            previewUrl={previewUrl}
            onFileSelect={handleFileSelect}
            onUploadSubmit={handleUploadSubmit}
            selectedFile={selectedFile}
            currentStatusText={currentStatus.text}
          />
        </div>
      </div>
    </div>
  )
}

export default App