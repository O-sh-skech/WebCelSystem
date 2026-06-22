import React, { useMemo, useState } from 'react'
import styles from './RightBox.module.css'
import type { CelParameter } from '../Types/CelParameter'
import "@fontsource/pixelify-sans/700.css"; 

interface RightBoxProps {
  currentPart: string
  sliderValues: { yaw: number; pitch: number; roll: number }
  assetsList: CelParameter[]
  onUploadSubmit: (file: File) => void // 🌟 Fileを直接受け取るように変更
  imageVersion: number
}

const createCoordinateKey = (
  yaw: number,//スライドバーの情報を取得してるから動的に対応可能
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
  onUploadSubmit,
  imageVersion
}: RightBoxProps) {
  console.log('RightBox render')
  const assetMap = useMemo(() => {
    const map = new Map<string, string[]>()

    assetsList.forEach(asset => {
      console.log("assetの中身",asset)
      const key = createCoordinateKey(asset.yaw, asset.pitch, asset.roll )//partname以外のパーツについてkeyを作るように
      
      const currentUrls = map.get(key) || []
      
      currentUrls.push(`/uploads/${asset.part_name}/${key}.png?t=${imageVersion}`)//毎回読み込み直しタイミングを考える

      map.set(key, currentUrls)
    })

    return map
  }, [assetsList, imageVersion])

  console.log("assetList",assetsList)

  const currentKey = createCoordinateKey(
    sliderValues.yaw,
    sliderValues.pitch,
    sliderValues.roll
  )

  const currentImages =
    assetMap.get(currentKey) || []//undefineを返すから初期値は[].キーゲット

  console.log('assetMap', [...assetMap.entries()])
  console.log('currentKey', currentKey) //まだlog残す
  console.log('currentImage', currentImages)

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


  return (
    <div className={styles.container}>

      <h3 className={styles.title}>
        選択画像プレビュー
      </h3>

      <div className={styles.PreviewTexts}>
        <div>
          現在の座標:
          <span className={styles.statusText}>
            {currentKey}
          </span>
        </div>
        <div>
          保存時のリネーム:
          <span className={styles.statusText}>
            {currentPart}/{expectedFileName}
          </span>
        </div>
      </div>


      <div className={styles.dropZone}>
        {currentImages.length > 0 ? (
          <>
            {currentImages.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={url}
                className={`${styles.previewImage} ${styles.layerImage}`}
                style={{ zIndex: index }}
              />
            ))}
          </>
        ) : (
          <div className={styles.emptyImage}>
            <div style={{ fontSize: '32px' }}>
              ?
            </div>
            <span style={{ fontSize: '12px' }}>
              you are missed
            </span>
          </div>
        )}
      </div>
        
      <div className={styles.buttonContainer}>
        <button
          onClick={handleUploadButtonClick}
          className={styles.uploadButton}
        >
          UPLOAD
        </button>
        <button
          className={styles.deleteButton}
        >
          LAYER</button>
      </div>
    </div>
  )
}