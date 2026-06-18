import { useEffect, useState } from 'react'
import { SpaceSliders } from './SpaceSliders'

interface CelParameter {
  id: number
  yaw: number
  pitch: number
  roll: number
}

function App() {
  const [parameters, setParameters] = useState<CelParameter[]>([])
  
  // UIの状態管理
  const [currentPart, setCurrentPart] = useState<string>('body')
  const [sliderValues, setSliderValues] = useState({ yaw: 0, pitch: 0, roll: 0 })

  // 起動時にデータを取得
  useEffect(() => {
    fetch('/api/parameters')
      .then((res) => res.json())
      .then((data) => setParameters(data || []))
      .catch((err) => console.error(err))
  }, [])

  // スライダーの値が変更された時の処理
  const handleSliderChange = (axis: 'yaw' | 'pitch' | 'roll', val: number) => {
    setSliderValues((prev) => ({ ...prev, [axis]: val }))
  }

  // ★要件：3段階の進捗色（灰色→黄色→緑色）を計算するロジックのシミュレーション
  // 本来はパーツごとのアップロード状況をバックエンドから取得して計算しますが、
  // 今回は「現在のスライダーの座標」がすでに登録されているかで簡易判定します。
  const getProgressColor = () => {
    const isExist = parameters.some(
      (p) => p.yaw === sliderValues.yaw && p.pitch === sliderValues.pitch && p.roll === sliderValues.roll
    )
    if (!isExist) return '#555' // 灰色：未登録
    
    // デモ用ロジック（本当は全パーツ揃ったら緑、一部なら黄色）
    if (currentPart === 'body') return '#f1c40f' // 黄色：特定のpartだけ完了
    return '#2ecc71' // 緑色：すべてのpartが完了
  }

  return (
    <div style={{ padding: '40px 20px', fontFamily: 'sans-serif', backgroundColor: '#1e1e24', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        
        <header style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h1 style={{ color: '#4a90e2', margin: '0 0 5px 0' }}>🎬 AnimeCelSystem</h1>
          <p style={{ color: '#888', margin: 0 }}>クリエイター向け・空間オーサリングコンソール</p>
        </header>

        {/* 1. パーツ切り替えタブ */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {['body', 'eyes', 'mouth'].map((part) => (
            <button
              key={part}
              onClick={() => setCurrentPart(part)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentPart === part ? '#4a90e2' : '#2a2a35',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase'
              }}
            >
              {part}
            </button>
          ))}
        </div>

        {/* 2. 動的スライダースペース（パーツ選択で横に滑らかスライド） */}
        <SpaceSliders
          currentPart={currentPart}
          values={sliderValues}
          onChange={handleSliderChange}
        />

        {/* 3. ステータス可視化 ＆ プレビュー予定エリア */}
        <div style={{
          marginTop: '24px',
          backgroundColor: '#2a2a35',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#aaa' }}>📊 現在のセルの進捗ステータス</h4>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#15151c',
            padding: '10px 20px',
            borderRadius: '20px',
            fontSize: '14px'
          }}>
            {/* 動的に色が変わるインジケータ */}
            <span style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: getProgressColor(),
              boxShadow: `0 0 10px ${getProgressColor()}`,
              transition: 'all 0.3s'
            }} />
            <span>
              座標 (Y:{sliderValues.yaw}, P:{sliderValues.pitch}, R:{sliderValues.roll}) の状態
            </span>
          </div>

          {/* ここに将来、Canvas重ね合わせプレビューを実装します */}
          <div style={{
            marginTop: '20px',
            height: '150px',
            backgroundColor: '#15151c',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#444',
            border: '2px dashed #333'
          }}>
            🖼️ リアルタイム重ね合わせプレビュー (Canvas予定地)
          </div>
        </div>

      </div>
    </div>
  )
}

export default App