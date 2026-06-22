import { useState, useEffect } from 'react'
import { SpaceSliders } from './Sliders/SpaceSliders'
import styles from './LeftBox.module.css'
import type { CelParameter } from '../Types/CelParameter'

interface LeftBoxProps {
  allParts: string[]
  currentPart: string
  setCurrentPart: (part: string) => void
  sliderValues: { yaw: number; pitch: number; roll: number }
  onSliderChange: (axis: 'yaw' | 'pitch' | 'roll', val: number) => void
  statusMessage: string
  progressList: CelParameter[]
}

export function LeftBox({
  allParts,
  currentPart,
  setCurrentPart,
  sliderValues,
  onSliderChange,
  statusMessage,
  progressList,
}: LeftBoxProps) {

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
      return { color: '#2ecca4', text: '完全完了 (全パーツ配置済み)' } // 緑
    } else {
      return { color: '#cdd84a', text: '一部完了 (未配置のパーツあり)' } // 黄（テキストが常にスッキリ！）
    }
    }
    const [isSplitMode, setIsSplitMode] = useState(false)
    const progressStatus = getProgressStatus()
    const sliderColor = progressStatus.color
    const partsMessage = progressStatus.text

      //【新規実装】/api/build を叩いてZIPファイルをダウンロードする関数
    const handleBuildZip = async () => {
      // ユーザーに一言伝えて安心させる
      const confirmBuild = window.confirm('現在のデータから演者用アバターパッケージ（ZIP）を出力しますか？')
      if (!confirmBuild) return

      console.log('📦 ビルド＆ZIP生成リクエストを送信します...')

      try {
        // 1. 引数なしでシンプルにエンドポイントを叩く
        const res = await fetch('/api/build', {
          method: 'POST', // Go側が受け取れるメソッド（GETでもPOSTでもルーターに合わせてOKです）
        })

        if (!res.ok) {
          alert('❌ サーバー側でビルド処理に失敗しました')
          return
        }

        // 2. 🌟重要: テキストではなく「Blob（バイナリの塊）」としてZIPデータを受け取る
        const blob = await res.blob()

        // 3. ブラウザ上に仮想のダウンロードリンクを作って、自動でクリックさせる技法
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'avatar_package.zip' // ダウンロードされるファイル名
        document.body.appendChild(a)
        a.click()                         // 擬似クリックで即時ダウンロード開始！
        
        // 後片付け
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        console.log('🎉 ZIPパッケージのダウンロードが完了しました！')

      } catch (error) {
        console.error('ビルド通信エラー:', error)
        alert('❌ 通信エラーが発生しました')
      }
    }


  return (
    <div className={styles.container}>
      <div className={styles.partTabs}>
        {allParts.map((part) => (
          <button
            key={part}
            onClick={() => setCurrentPart(part)}
            className={`${styles.partButton} ${
              currentPart === part ? styles.active : ''
            }`}
          >
            {part}
          </button>
        ))}
      </div>

      <SpaceSliders
        currentPart={currentPart}
        values={sliderValues}
        onChange={onSliderChange}
        sliderColor={sliderColor}
        // 🌟 追加のPropsを流し込む
        isSplitMode={isSplitMode}
        progressList={progressList}
      >
        {/* ✂️ SPILIT MODE ボタンをトグル（ON/OFF）仕様にアップデート */}
        <button 
          onClick={() => setIsSplitMode(!isSplitMode)}
          style={{
            marginTop: '15px',
            width: '100%',
            padding: '10px',
            backgroundColor: isSplitMode ? '#d9534f' : '#3a3a4a', // ONの時は赤っぽく
            color: '#fff',
            border: isSplitMode ? '1px solid #ff7774' : '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: isSplitMode ? '0 0 10px rgba(217, 83, 79, 0.5)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          {isSplitMode ? '✂️ EXIT SPLIT MODE (解除)' : '✂️ SPLIT MODE (分割)'}
        </button>
      </SpaceSliders>
      

      <div className={styles.bottomTab}>
        <button 
          className={styles.saveButton}
          onClick={handleBuildZip}
          >
          SAVE as ZIP
        </button>
        <span className={styles.statusMessage}>
          {partsMessage}
        </span>
      </div>
    </div>
  )
}