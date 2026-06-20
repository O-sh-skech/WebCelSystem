import { SpaceSliders } from './Sliders/SpaceSliders'
import styles from './LeftBox.module.css'

interface LeftBoxProps {
  allParts: string[]
  currentPart: string
  setCurrentPart: (part: string) => void
  sliderValues: { yaw: number; pitch: number; roll: number }
  onSliderChange: (axis: 'yaw' | 'pitch' | 'roll', val: number) => void
  statusMessage: string
  sliderColor: string // 🌟Appから受け取った「つまみの色」
}

export function LeftBox({
  allParts,
  currentPart,
  setCurrentPart,
  sliderValues,
  onSliderChange,
  statusMessage,
  sliderColor,
}: LeftBoxProps) {
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

      <div
        className={styles.status}
      >
        {statusMessage}
      </div>
    </div>
  )
}