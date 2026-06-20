import React, { useState, useEffect } from 'react'
import './Slider.css'

interface SnapSliderProps {
  label: string
  value: number
  onChange: (val: number) => void
  sliderColor: string // 🌟 親から引き継いだ進捗色（グレー、黄、緑）
}

export const SnapSlider: React.FC<SnapSliderProps> = ({ label, value, onChange, sliderColor }) => {
  const steps = [-1, 0, 1]
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleRelease = () => {
    const closest = steps.reduce((prev, curr) => 
      Math.abs(curr - localValue) < Math.abs(prev - localValue) ? curr : prev
    )
    setLocalValue(closest)
    onChange(closest)
  }

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', color: '#aaa', fontSize: '14px' }}>{label}</span>
        {/* 🌟 テキストの色も、現在の進捗色に合わせて光るように連動 */}
        <span style={{ color: sliderColor, fontWeight: 'bold', fontFamily: 'monospace', transition: 'color 0.3s' }}>
          {localValue > 0 ? `+${localValue.toFixed(2)}` : localValue.toFixed(2)}
        </span>
      </div>

      <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'center' }}>
        
        {/* 背景の線と○のレイヤー */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '4px',
          backgroundColor: '#444',
          borderRadius: '2px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          {steps.map((step) => {
            const isClosest = Math.abs(step - localValue) < 0.5
            return (
              <div
                key={step}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  // 🌟 吸着したドットの輝きも、現在の進捗色に合わせる！
                  backgroundColor: isClosest ? '#4a90e2' : '#666',
                  border: isClosest ? '2px solid #fff' : '2px solid #2a2a35',
                  boxShadow: isClosest ? '0 0 8px #4a90e2' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />
            )
          })}
        </div>

        {/* ネイティブスライダー */}
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={localValue}
          onChange={(e) => setLocalValue(Number(e.target.value))}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          className="custom-range-slider"
          style={{
            // 🌟 ここが今回の魔法！ReactのStateの色を、CSSカスタムプロパティとしてinputに強引にドロップ！
            '--thumb-color': sliderColor
          } as React.CSSProperties}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
        <span>左 / 下 (-1)</span>
        <span>正面 (0)</span>
        <span>右 / 上 (1)</span>
      </div>
    </div>
  )
}