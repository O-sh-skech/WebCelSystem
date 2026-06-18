import React from 'react'

interface SnapSliderProps {
  label: string
  value: number
  onChange: (val: number) => void
}

export const SnapSlider: React.FC<SnapSliderProps> = ({ label, value, onChange }) => {
  // スライダーの取り得る値（離散量）の定義
  const steps = [-1, 0, 1]

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', color: '#aaa', fontSize: '14px' }}>{label}</span>
        <span style={{ color: '#4a90e2', fontWeight: 'bold', fontFamily: 'monospace' }}>
          {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
        </span>
      </div>

      {/* スライダー本体と「○」を重ねるためのコンテナ */}
      <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'center' }}>
        
        {/* 1. 背景の線（—）とスナップ点（○）のレイヤー */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '4px',
          backgroundColor: '#444',
          borderRadius: '2px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none' // スライダーの邪魔をしないように
        }}>
          {steps.map((step) => {
            const isSelected = value === step
            return (
              <div
                key={step}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  // 現在選択されている値の「○」はアクティブカラー（青）にする
                  backgroundColor: isSelected ? '#4a90e2' : '#666',
                  border: isSelected ? '2px solid #fff' : '2px solid #2a2a35',
                  transform: 'translateX(0px)',
                  boxShadow: isSelected ? '0 0 8px #4a90e2' : 'none',
                  transition: 'all 0.1s ease'
                }}
              />
            )
          })}
        </div>

        {/* 2. 透明にしたネイティブスライダーを上に重ねる */}
        <input
          type="range"
          min="-1"
          max="1"
          step="1" // ★ここを1にすることで、-1, 0, 1 にしか止まらなくなる（スナップ操作の実現）
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
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

      {/* スライダー下のラベル */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
        <span>左 / 下 (-1)</span>
        <span>正面 (0)</span>
        <span>右 / 上 (1)</span>
      </div>

      {/* つまみ（Thumb）だけを綺麗に見せるためのグローバルCSSスタイル（簡易インライン適用） */}
      <style>{`
        .custom-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          cursor: pointer;
          border: 3px solid #4a90e2;
          transition: transform 0.1s;
        }
        .custom-range-slider::-webkit-slider-thumb:active {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  )
}