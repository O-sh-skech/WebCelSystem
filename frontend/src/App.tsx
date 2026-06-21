import { useEffect, useState } from 'react'
import { LeftBox } from './components/LeftBox/LeftBox' 
import { RightBox } from './components/RightBox/RightBox' 
import "@fontsource/pixelify-sans/700.css"; 
import styles from './App.module.css'
import type { CelParameter } from './components/Types/CelParameter'; 


function App() {
  const allParts = ['body', 'eyes', 'mouth']
  
  // 状態管理（State）
  const [currentPart, setCurrentPart] = useState<string>('body')
  const [sliderValues, setSliderValues] = useState({ yaw: 0, pitch: 0, roll: 0 })
  const [progressList, setProgressList] = useState<CelParameter[]>([])
  const [assetsList, setAssetsList] = useState<CelParameter[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('画像をドロップしてリネーム名を確認してください')
  

  const fetchProgress = () => {
    fetch('/api/progress')
      .then((res) => res.json())
      .then((data) => setProgressList(data || []))
      .catch((err) => console.error('進捗取得エラー:', err))
  }
  const fetchAssets = () => {
    fetch('/api/assets')
      .then((res) => res.json())
      .then((data) => setAssetsList(data || []))
      .catch((err) => console.error('資産取得エラー:', err))
  }


  useEffect(() => {
    fetchProgress()
    fetchAssets()
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
    // setPreviewUrl(URL.createObjectURL(file))
    setStatusMessage('📸 ローカルプレビューを表示中。確定ボタンで保存します。')
  }

  // 🌟 引数で file を直接受け取れるように拡張（RightBoxからの即時送信に対応）
  const handleUploadSubmit = async (file?: File) => {
    // 引数に file があればそれを使用し、無ければStateの selectedFile を使用する
    const fileToUpload = file || selectedFile;

    if (!fileToUpload) {
      setStatusMessage('❌ ファイルが選択されていません')
      return
    }
    
    setStatusMessage('⏳ Goサーバーへ送信中...')

    const formData = new FormData()
    formData.append('part_name', currentPart)
    formData.append('yaw', sliderValues.yaw.toString())
    formData.append('pitch', sliderValues.pitch.toString())
    formData.append('roll', sliderValues.roll.toString())
    formData.append('image', fileToUpload) 

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const text = await res.text()
        setStatusMessage(`✅ ${text}`)
        setSelectedFile(null)
        fetchProgress() // スライダーの進捗をリロード
        fetchAssets()  
      } else {
        setStatusMessage('❌ サーバーエラーが発生しました')
      }
    } catch (error) {
      setStatusMessage('❌ 通信エラーが発生しました')
    }
  }

  // 🌟【心臓部：超スリム版】IDを見てメッセージを出し分けるだけ！
  const getProgressStatus = () => {
    const currentData = progressList.find(
      (p) => p.yaw === sliderValues.yaw && p.pitch === sliderValues.pitch && p.roll === sliderValues.roll
    )

    // 1. データがない ➔ グレー
    if (!currentData) {
      return { color: '#555', text: '未着手 (画像なし)' }
    }

    // 2. IDだけで無駄なくスピード判定！
    if (currentData.id === 1) {
      return { color: '#2ecc71', text: '完全完了 (全パーツ配置済み)' } // 緑
    } else {
      return { color: '#f1c40f', text: '一部完了 (未配置のパーツあり)' } // 黄（テキストが常にスッキリ！）
    }
    }
    const currentStatus = getProgressStatus()

    


  return (
    <div className={styles.app}>
      
      
      <div className={styles.workspaceContainer}>
        <header className={styles.appHeader}>
          <h1 className={styles.appTitle}>AnimeCelSystem</h1>
          <p className={styles.appSubtitle}>クリエイター向け・空間オーサリングコンソール</p>
        </header>

        <div className={styles.editorLayout}>
          {/* 左コンポーネント：進捗色(currentStatus.color)を注入 */}
          <LeftBox
            allParts={allParts}
            currentPart={currentPart}
            setCurrentPart={(part) => {
              setCurrentPart(part)
            }}
            sliderValues={sliderValues}
            onSliderChange={handleSliderChange}
            statusMessage={statusMessage}
            sliderColor={currentStatus.color} // 後にtxtもここに移動。
          />

          {/* 右コンポーネント：プレビューと送信処理 */}
          <RightBox
            currentPart={currentPart}
            sliderValues={sliderValues}
            assetsList = {assetsList}
            onFileSelect={handleFileSelect}
            onUploadSubmit={handleUploadSubmit}
            selectedFile={selectedFile}
            
          />
        </div>
      </div>
    </div>
  )
}

export default App