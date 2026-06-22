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
    const progressStatus = getProgressStatus()
    const sliderColor = progressStatus.color
    const partsMessage = progressStatus.text

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
        sliderColor={sliderColor}  // 🌟 spaceSliderに投げる進捗色
      />

      <div className={styles.bottomTab}>
        <button className={styles.saveButton}>
          SAVE as ZIP
        </button>
        <span className={styles.statusMessage}>
          {partsMessage}
        </span>
      </div>
    </div>
  )
}