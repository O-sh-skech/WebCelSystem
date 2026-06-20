import React from 'react'
import { SnapSlider } from './SnapSlider'

interface SpaceSlidersProps {
  currentPart: string
  values: { yaw: number; pitch: number; roll: number }
  onChange: (axis: 'yaw' | 'pitch' | 'roll', val: number) => void
}

export const SpaceSliders: React.FC<SpaceSlidersProps> = ({ currentPart, values, onChange }) => {
  const parts = ['body', 'eyes', 'mouth']
  
  // 現在選択されているパーツが、何番目のインデックスか（スライドアニメーションの計算用）
  const currentIndex = parts.indexOf(currentPart)

  return (
    <div style={{
      backgroundColor: '#2a2a35',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
      overflow: 'hidden', // 枠外に隠れた他パーツのスライダーを見えなくする
      position: 'relative',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      
      {/* スライド用のコンテナ（パーツ切り替えでX軸にシャーッと動く） */}
      <div style={{
        display: 'flex',
        width: `${parts.length * 100}%`,
        transform: `translateX(-${(currentIndex * 100) / parts.length}%)`,
        transition: 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)', // ★滑らかで素早い動き（イージング）
      }}>
        
        {/* 各パーツごとの3軸スライダー一式を横並びに配置 */}
        {parts.map((part) => (
          <div key={part} style={{ width: `${100 / parts.length}%`, paddingLeft: '30px', paddingRight: '30px',boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '16px' }}>
              🎯 {part} 空間パラメータ
            </h3>
            
            <SnapSlider label="Yaw (左右回転)" value={values.yaw} onChange={(val) => onChange('yaw', val)} />
            <SnapSlider label="Pitch (上下回転)" value={values.pitch} onChange={(val) => onChange('pitch', val)} />
            <SnapSlider label="Roll (首の傾き)" value={values.roll} onChange={(val) => onChange('roll', val)} />
          </div>
        ))}

      </div>
    </div>
  )
}