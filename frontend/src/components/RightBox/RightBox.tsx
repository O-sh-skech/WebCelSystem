import React, { useMemo } from 'react'
import styles from './RightBox.module.css'
import type { CelParameter } from '../Types/CelParameter'

interface RightBoxProps {
  currentPart: string
  sliderValues: { yaw: number; pitch: number; roll: number }
  assetsList: CelParameter[]
  onFileSelect: (file: File) => void
  onUploadSubmit: (file: File) => void // 🌟 Fileを直接受け取るように変更
  selectedFile: File | null
}

const AXIS_VALUES = [-1, 0, 1]

const createCoordinateKey = (
  yaw: number,
  pitch: number,
  roll: number
) => {
  return [yaw, pitch, roll]
    .map(value => value.toFixed(2))
    .join('_')
}

export function RightBox({
  currentPart,
  sliderValues,
  assetsList,
  onFileSelect,
  onUploadSubmit,
}: RightBoxProps) {
  console.log('RightBox render')

  /**
   * assetsList
   *
   * [
   *   {
   *     yaw:0,
   *     pitch:0,
   *     roll:0,
   *     part_name:"body"
   *   }
   * ]
   *
   * ↓
   *
   * Map
   *
   * {
   *   "0.00_0.00_0.00":
   *      "/uploads/body/0.00_0.00_0.00.png"
   * }
   */
  const assetMap = useMemo(() => {
    const map = new Map<string, string[]>()

    assetsList.forEach(asset => {
      const key = createCoordinateKey(
        asset.yaw,
        asset.pitch,
        asset.roll
      )

      // すでにその座標の配列が存在すればそれを取得、無ければ空配列を作る
      const currentUrls = map.get(key) || []
      
      // 新しいパーツのURLを配列に追加
      currentUrls.push(`/uploads/${asset.part_name}/${key}.png?t=${Date.now()}`)

      map.set(key, currentUrls)
    })

    return map
  }, [assetsList])


  /**
   * 27個の座標スロットを生成
   */
  const coordinateSlots = useMemo(() => {
    const slots: {
      key: string
      yaw: number
      pitch: number
      roll: number
      imageUrls?: string[]
    }[] = []

    AXIS_VALUES.forEach(yaw => {
      AXIS_VALUES.forEach(pitch => {
        AXIS_VALUES.forEach(roll => {

          const key = createCoordinateKey(
            yaw,
            pitch,
            roll
          )

          slots.push({
            key,
            yaw,
            pitch,
            roll,
            imageUrls: assetMap.get(key) || []
          })
        })
      })
    })
    console.log(slots)

    return slots
  }, [assetMap])


  const currentKey = createCoordinateKey(
    sliderValues.yaw,
    sliderValues.pitch,
    sliderValues.roll
  )

  console.log('assetMap', [...assetMap.entries()])
  console.log('currentKey', currentKey)


  const expectedFileName = `${currentKey}.png`


  const handleUploadButtonClick = () => {
    console.log('アップロードボタンが押されました')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png'

    input.onchange = event => {
      const files = (event.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      // 親のStateにも一応セットしておく（プレビュー用など。無くても可）
      onFileSelect(files[0])

      onUploadSubmit(files[0])
    }

    input.click()
  }


  return (
    <div className={styles.container}>

      <h3 className={styles.title}>
        🖼️ 選択画像プレビュー
      </h3>

      <div className={styles.fileNamePreview}>
        保存時のリネーム予測:
        <span className={styles.fileName}>
          {currentPart}/{expectedFileName}
        </span>
      </div>

      <div className={styles.status}>
        現在の座標:
        <span className={styles.statusText}>
          {currentKey}
        </span>
      </div>
      
      <div
        className={styles.dropZone}
        style={{
          position: 'relative',
          overflow: 'hidden'
        }}
      >

        {coordinateSlots.map(slot => {

          // 現在スライダーが指している座標以外は非表示
          if (slot.key !== currentKey) {
            return null
          }


          // 🌟 画像が1枚以上登録されているなら、mapで全部重ねてレンダリング！
          if (slot.imageUrls.length > 0) {
            return (
              <React.Fragment key={slot.key}>
                {slot.imageUrls.map((url, index) => (
                  <img
                    key={`${slot.key}_${index}`}
                    src={url}
                    alt={slot.key}
                    className={styles.previewImage}
                    style={{
                      position: 'absolute', // 🌟 重ね合わせるために絶対配置にする
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: index // 後から読み込まれたパーツ（eyesなど）を上に重ねる
                    }}
                  />
                ))}
              </React.Fragment>
            )
          }


          return (
            <div
              key={slot.key}
              className={styles.emptyContainer}
              style={{
                textAlign: 'center',
                color: '#666'
              }}
            >
              <div style={{ fontSize: '32px' }}>
                🕳️
              </div>

              <span style={{ fontSize: '12px' }}>
                この座標は未登録です!
              </span>
            </div>
          )
        })}

      </div>


      <button
        onClick={handleUploadButtonClick}
        className={styles.uploadButton}
      >
        🚀 画像を選択してこの座標にアップロード確定
      </button>

    </div>
  )
}