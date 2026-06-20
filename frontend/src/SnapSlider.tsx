import React, { useState, useEffect } from 'react'

interface SnapSliderProps {
  label: string
  value: number
  onChange: (val: number) => void
}

export const SnapSlider: React.FC<SnapSliderProps> = ({ label, value, onChange }) => {
  const steps = [-1, 0, 1]
  
  // ドラッグ中の一時的な連続量を管理するローカル状態
  const [localValue, setLocalValue] = useState(value)

  // 親のデータ（パーツ切り替えなど）が変わったら、ローカル状態も同期する
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // マウスや指を離したときに、最も近いステップに吸着（ワープ）させる関数
  const handleRelease = () => {
    // -1, 0, 1 の中から、現在のlocalValueに最も近い値を計算
    const closest = steps.reduce((prev, curr) => 
      Math.abs(curr - localValue) < Math.abs(prev - localValue) ? curr : prev
    )
    setLocalValue(closest)
    onChange(closest) // 親に確定値を報告
  }

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', color: '#aaa', fontSize: '14px' }}>{label}</span>
        <span style={{ color: '#4a90e2', fontWeight: 'bold', fontFamily: 'monospace' }}>
          {/* ドラッグ中はリアルタイムな数値を、離したら確定数値を表示 */}
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
            // 吸着予測位置（最も近い点）を光らせる
            const isClosest = Math.abs(step - localValue) < 0.5
            return (
              <div
                key={step}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isClosest ? '#4a90e2' : '#666',
                  border: isClosest ? '2px solid #fff' : '2px solid #2a2a35',
                  boxShadow: isClosest ? '0 0 8px #4a90e2' : 'none',
                  transition: 'all 0.1s ease'
                }}
              />
            )
          })}
        </div>

        {/* ネイティブスライダー（stepを細かくして滑らかに） */}
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01" // ★滑らかに動かすために細かく設定
          value={localValue}
          onChange={(e) => setLocalValue(Number(e.target.value))}
          onMouseUp={handleRelease}  // ★PC用：マウスを離した時
          onTouchEnd={handleRelease} // ★スマホ・タブレット用：指を離した時
          style={{
            position: 'absolute',
            width: '100%',
            margin: 0,
            cursor: 'pointer',
            WebkitAppearance: 'none',
            background: 'transparent',
            zIndex: 2
          }}
          className="custom-range-slider"
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