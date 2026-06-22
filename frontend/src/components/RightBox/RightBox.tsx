import React, { useMemo, useState, useEffect } from 'react'
import styles from './RightBox.module.css'
import type { CelParameter } from '../Types/CelParameter'
import "@fontsource/pixelify-sans/700.css"; 

interface RightBoxProps {
  currentPart: string
  sliderValues: { yaw: number; pitch: number; roll: number }
  assetsList: CelParameter[]
  onUploadSubmit: (file: File) => void 
  imageVersion: number
  onDeleteSubmit: (partName: string) => void
}

// 🌟 レイヤーオブジェクトの型定義を追加
interface LayerItem {
  partName: string
  url: string
}

const createCoordinateKey = (yaw: number, pitch: number, roll: number) => {
  return [yaw, pitch, roll].map(value => value.toFixed(2)).join('_')
}

export function RightBox({
  currentPart,
  sliderValues,
  assetsList,
  onUploadSubmit,
  imageVersion,
  onDeleteSubmit
}: RightBoxProps) {
  console.log('RightBox render')
  const [isOpen, setIsOpen] = useState(false)
  
  // 🌟 変更点: URL文字列ではなく、パーツ名とURLをセットにしたオブジェクト配列のMapにする
  const assetMap = useMemo(() => {
    const map = new Map<string, LayerItem[]>()

    assetsList.forEach(asset => {
      const key = createCoordinateKey(asset.yaw, asset.pitch, asset.roll)
      const currentLayers = map.get(key) || []
      
      currentLayers.push({
        partName: asset.part_name,
        url: `/uploads/${asset.part_name}/${key}.png?t=${imageVersion}`
      })

      map.set(key, currentLayers)
    })

    return map
  }, [assetsList, imageVersion])

  const currentKey = createCoordinateKey(sliderValues.yaw, sliderValues.pitch, sliderValues.roll)

  


  
  // 今の座標にあるレイヤーの初期リストを取得
  const initialLayers = useMemo(() => assetMap.get(currentKey) || [], [assetMap, currentKey])

  // 🌟 追加機能: 順序入れ替えのためのローカルState
  const [orderedLayers, setOrderedLayers] = useState<LayerItem[]>([])

  // 座標やデータが変わったら、表示用の順序リストを同期・初期化
  useEffect(() => {
    setOrderedLayers(initialLayers)
  }, [initialLayers])

  // 🌟 追加機能: レイヤーの順序を上下に入れ替える関数
  const moveLayer = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= orderedLayers.length) return // 範囲外なら処理しない

    const updated = [...orderedLayers]
    // 要素の入れ替え
    const temp = updated[index]
    updated[index] = updated[nextIndex]
    updated[nextIndex] = temp
    
    setOrderedLayers(updated)
  }

  const expectedFileName = `${currentKey}.png`

  const handleUploadButtonClick = () => {
    console.log('アップロードボタンが押されました')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png'
    input.onchange = event => {
      const files = (event.target as HTMLInputElement).files
      if (!files || files.length === 0) return
      onUploadSubmit(files[0])
    }
    input.click()
  }

  console.log("ログ",{
    currentKey,
    assetsList,
    assetMap: [...assetMap.entries()],
    initialLayers,
    orderedLayers
  })




  return (
    <div className={styles.container}>
      <h3 className={styles.title}>選択画像プレビュー</h3>

      <div className={styles.PreviewTexts}>
        <div>
          現在の座標: <span className={styles.statusText}>{currentKey}</span>
        </div>
        <div>
          保存時のリネーム: <span className={styles.statusText}>{currentPart}/{expectedFileName}</span>
        </div>
      </div>

      {/* 🌟 変更点: orderedLayers（並び替え対応配列）を元に重ね合わせ描画 */}
      <div className={styles.dropZone}>
        {orderedLayers.length > 0 ? (
          <>
            {orderedLayers.map((layer, index) => (
              <img
                key={`${layer.partName}_${index}`}
                src={layer.url}
                alt={layer.partName}
                className={`${styles.previewImage} ${styles.layerImage}`}
                style={{ 
                  zIndex: orderedLayers.length - index, // 🌟 配列の後ろにあるパーツほど上に重なる
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%'
                }}
              />
            ))}
          </>
        ) : (
          <div className={styles.emptyImage}>
            <div style={{ fontSize: '32px' }}>?</div>
            <span style={{ fontSize: '12px' }}>you are missed</span>
          </div>
        )}
      </div>
        
      <div className={styles.buttonContainer}>
        <button onClick={handleUploadButtonClick} className={styles.uploadButton}>
          UPLOAD
        </button>

        {/* 🌟 変更点: レイヤー一覧 ＆ 順序変更 ＆ デリート機能 */}
        <div className={styles.layerTab} style={{ marginTop: '15px', border: '1px solid #333', borderRadius: '4px', padding: '10px', backgroundColor: '#1b1b22' }}>
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            style={{ width: '100%', padding: '8px', cursor: 'pointer', backgroundColor: '#2a2a35', color: '#fff', border: 'none', borderRadius: '4px' }}
          >
            {isOpen ? '🔽 LAYER LIST (閉じる)' : '▶️ LAYER LIST (開く)'}
          </button>
          
          <div
            style={{
              maxHeight: isOpen ? "300px" : "0px",
              overflowY: "auto",
              transition: "max-height 0.3s ease",
            }}
          >
            {orderedLayers.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: '10px 5px', margin: 0 }}>
                {orderedLayers.map((layer, index) => (
                  <li 
                    key={`${layer.partName}_${index}`} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '8px 0', 
                      borderBottom: '1px solid #2d2d38',
                      color: '#ddd'
                    }}
                  >
                    {/* パーツ名のきれいな表示（生データから直接） */}
                    <span style={{ fontSize: '13px' }}>
                      ⚙️ {layer.partName.toUpperCase()}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* 🔼 レイヤーを上（重なりの前面）へ移動 */}
                      <button
                        onClick={() => moveLayer(index, 'up')} // 配列の後ろに送る＝zIndexが上がる
                        disabled={index === 0}
                        style={{ padding: '2px 6px', cursor: 'pointer', backgroundColor: index === 0 ? '#333' : '#444', color: '#fff', border: 'none', borderRadius: '3px' }}
                      >
                        ▲
                      </button>
                      
                      {/* 🔽 レイヤーを下（重なりの背面）へ移動 */}
                      <button
                        onClick={() => moveLayer(index, 'down')} // 配列の前に送る＝zIndexが下がる
                        disabled={index === orderedLayers.length - 1}
                        style={{ padding: '2px 6px', cursor: 'pointer', backgroundColor: index === orderedLayers.length - 1 ? '#333' : '#444', color: '#fff', border: 'none', borderRadius: '3px' }}
                      >
                        ▼
                      </button>

                      {/* 🗑️ 個別デリートボタン */}
                      <button
                        onClick={() => onDeleteSubmit(layer.partName)}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#d9534f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginLeft: '10px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: '15px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                この座標に配置されているレイヤーはありません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}