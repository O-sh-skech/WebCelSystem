import React, { useState, useEffect } from 'react'
import './Slider.css'
import type { CelParameter } from '../../Types/CelParameter'

interface SnapSliderProps {
  axis: 'yaw' | 'pitch' | 'roll'
  label: string
  value: number
  onChange: (val: number) => void
  sliderColor: string // 🌟 親から引き継いだ進捗色（グレー、黄、緑）
  isSplitMode: boolean          // 🌟 分割モードフラグ
  progressList: CelParameter[]  // 🌟 進捗リスト
  currentValues: { yaw: number; pitch: number; roll: number } // 🌟 現在の全座標
}

export const SnapSlider: React.FC<SnapSliderProps> = ({ axis, label, value, onChange, sliderColor, isSplitMode, progressList, currentValues}) => {
  // 🌟 変更: steps を動的に増やすためローカルStateにする
  const [steps, setSteps] = useState<number[]>([-1, 0, 1])
  const [localValue, setLocalValue] = useState(value)

  // 🌟 ホバーしている位置の分割ステータスを管理するState
  const [hoverStatus, setHoverStatus] = useState<{ canSplit: boolean; message: string; targetValue: number }>({
    canSplit: false,
    message: '',
    targetValue: 0
  })

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const getClosestStep = (currentVal: number): number => {
    if (steps.length === 0) return 0
    return steps.reduce((prev, curr) => 
      Math.abs(curr - currentVal) < Math.abs(prev - currentVal) ? curr : prev
    )
  }

  // 離したときの吸着処理
  const handleRelease = () => {
    const closest = getClosestStep(localValue) 
    setLocalValue(closest)
    onChange(closest)
  }

  // 🌟【超重要】マウスがスライダー上を動いたときに「分割可能か」をリアルタイム計算する関数
  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSplitMode) return

    // マウスのX座標から -1.00 〜 1.00 の数値を逆算する
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, offsetX / rect.width))
    const hoverVal = -1 + percentage * 2 // -1 から 1 の実数

    // 1. 今ホバーしている位置の「両隣の既存ステップ」を見つける
    const leftStep = [...steps].reverse().find(s => s <= hoverVal) ?? -1
    const rightStep = steps.find(s => s >= hoverVal) ?? 1

    // すでにステップが存在するドットの真上なら分割の必要なし
    if (Math.abs(hoverVal - leftStep) < 0.05 || Math.abs(hoverVal - rightStep) < 0.05) {
      setHoverStatus({ canSplit: false, message: 'ここには既にポイントがあります', targetValue: 0 })
      return
    }

    // 2. 「隣り合うパラメータのIDがどちらも1か」をチェックするための、両隣の完全な座標オブジェクトを組み立てる
    const leftCoords = { ...currentValues, [axis]: leftStep }
    const rightCoords = { ...currentValues, [axis]: rightStep }

    // 3. progressList からそれぞれのデータを検索
    const leftData = progressList.find(p => p.yaw === leftCoords.yaw && p.pitch === leftCoords.pitch && p.roll === leftCoords.roll)
    const rightData = progressList.find(p => p.yaw === rightCoords.yaw && p.pitch === rightCoords.pitch && p.roll === rightCoords.roll)

    // 4. 分割可能条件：どちらもデータが存在し、かつ双方が id === 1 であること
    const canSplit = leftData?.id === 1 && rightData?.id === 1
    const midpoint = (leftStep + rightStep) / 2 // 分割した際に新しく生まれる中間値

    setHoverStatus({
      canSplit,
      message: canSplit ? `👉 クリックで ${midpoint.toFixed(2)} を新設！` : '🚫 両隣のパーツが未完了のため分割できません',
      targetValue: midpoint
    })
  }

    // 🌟【新規】クリックしたときに実際にステップ（丸）を増やす関数
  const handleOverlayClick = () => {
    if (!isSplitMode || !hoverStatus.canSplit) return

    // 新しい中間値を既存のステップ配列にねじ込んでソートする
    const newSteps = [...steps, hoverStatus.targetValue].sort((a, b) => a - b)
    setSteps(newSteps)
    
    // ツマミを今作った新しい中間点に強制吸着させる
    setLocalValue(hoverStatus.targetValue)
    onChange(hoverStatus.targetValue)
    
    alert(`🎉 ステップに ${hoverStatus.targetValue.toFixed(2)} を追加しました！`)
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
        {/* 背景の線と○のレイヤー（丸の数は steps.map で動的に増減！） */}
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
            
            const isClosest = step === getClosestStep(localValue)
            const leftPercent = ((step - (-1)) / 2) * 96.5
            //console.log("ステップ",step,isClosest)

            return (
              <div
                key={step}
                style={{
                  position: 'absolute',
                  left: `calc(${leftPercent}% - 1px)`, // 中央寄せ微調整
                  width: '12px', height: '12px', borderRadius: '50%',
                  backgroundColor: isClosest ? (isSplitMode ? '#ff7774' : '#4a90e2') : '#666',
                  border: isClosest ? '2px solid #fff' : '2px solid #2a2a35',
                  boxShadow: isClosest ? `0 0 8px ${isSplitMode ? '#ff7774' : '#4a90e2'}` : 'none',
                  transition: 'all 0.15s ease'
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
          style={{ '--thumb-color': isSplitMode ? '#ff7774' : sliderColor } as React.CSSProperties}
        />
        {/* 🌟🌟 魔法の盾：分割モード中だけ出現し、スライダーの操作をジャミングする透明カバー 🌟🌟 */}
        {isSplitMode && (
          <div
            onMouseMove={handleOverlayMouseMove}
            onClick={handleOverlayClick}
            onMouseLeave={() => setHoverStatus({ canSplit: false, message: '', targetValue: 0 })}
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(255,255,255,0.01)', // 完全に透明だとイベントが抜けるので極薄の白
              zIndex: 10,
              // 🌟 条件によってハサミ（cell/copy）か、禁止マーク（not-allowed）に切り替え！
              cursor: hoverStatus.message === '' ? 'pointer' : (hoverStatus.canSplit ? 'cell' : 'not-allowed'),
            }}
          />
        )}
      </div>

      {/* 🌟 分割モード専用のリアルタイムメッセージ案内板 */}
      {isSplitMode && hoverStatus.message && (
        <div style={{
          fontSize: '11px', 
          color: hoverStatus.canSplit ? '#2ecca4' : '#ff7774', 
          marginTop: '6px',
          textAlign: 'center',
          fontWeight: 'bold',
          backgroundColor: '#1b1b22',
          padding: '4px',
          borderRadius: '4px'
        }}>
          {hoverStatus.message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
        <span>左 / 下 (-1)</span>
        <span>正面 (0)</span>
        <span>右 / 上 (1)</span>
      </div>
    </div>
  )
}