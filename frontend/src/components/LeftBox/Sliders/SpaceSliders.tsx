import React from 'react'
import { SnapSlider } from './SnapSlider'
import type { CelParameter } from '../../Types/CelParameter'

interface SpaceSlidersProps {
  currentPart: string
  values: { yaw: number; pitch: number; roll: number }
  onChange: (axis: 'yaw' | 'pitch' | 'roll', val: number) => void
  sliderColor: string // 🌟 LeftBox から降りてくる進捗色
  children?: React.ReactNode 
  // 🌟 追加
  isSplitMode: boolean
  progressList: CelParameter[]
}

export const SpaceSliders: React.FC<SpaceSlidersProps> = ({ currentPart, values, onChange, sliderColor, children , isSplitMode, progressList}) => {
  const parts = ['body', 'eyes', 'mouth']
  const currentIndex = parts.indexOf(currentPart)

  return (
    <div style={{
      backgroundColor: '#2a2a35',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      boxSizing: 'border-box'
      }}>
      
      <div style={{
        display: 'flex',
        width: `${parts.length * 100}%`,
        transform: `translateX(-${(currentIndex * 100) / parts.length}%)`,
        transition: 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
        }}>
        
        {parts.map((part) => (
          <div key={part} style={{ width: `${100 / parts.length}%`, paddingLeft: '30px', paddingRight: '30px', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '16px' }}>
              {part} 空間パラメータ
            </h3>
            
            {/* 🌟 3つの子スライダーにすべて color を引き渡す */}
            <SnapSlider axis="yaw" label="Yaw (左右回転)" value={values.yaw} onChange={(val) => onChange('yaw', val)} sliderColor={sliderColor} isSplitMode={isSplitMode} progressList={progressList} currentValues={values} />
            <SnapSlider axis="pitch" label="Pitch (上下回転)" value={values.pitch} onChange={(val) => onChange('pitch', val)} sliderColor={sliderColor} isSplitMode={isSplitMode} progressList={progressList} currentValues={values} />
            <SnapSlider axis="roll" label="Roll (首の傾き)" value={values.roll} onChange={(val) => onChange('roll', val)} sliderColor={sliderColor} isSplitMode={isSplitMode} progressList={progressList} currentValues={values} /> </div>
        ))}

      </div>
      {children}
    </div>
  )
}