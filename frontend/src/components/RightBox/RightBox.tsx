import styles from './RightBox.module.css'

interface RightBoxProps {
  currentPart: string
  expectedFileName: string
  isDragging: boolean
  setIsDragging: (dragging: boolean) => void
  previewUrl: string | null
  onFileSelect: (file: File) => void
  onUploadSubmit: () => void
  selectedFile: File | null
  currentStatusText: string // 信号の色はスライダーに譲り、テキストだけ表示
}

export function RightBox({
  currentPart,
  expectedFileName,
  isDragging,
  setIsDragging,
  previewUrl,
  onFileSelect,
  onUploadSubmit,
  selectedFile,
  currentStatusText,
}: RightBoxProps) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>🖼️ 選択画像プレビュー</h3>

      <div className={styles.fileNamePreview}>
        保存時のリネーム予測:
        <span className={styles.fileName}>
          {currentPart}/{expectedFileName}
        </span>
      </div>

      <div className={styles.status}>
        現在の座標ステータス:
        <span className={styles.statusText}>
          {currentStatusText}
        </span>
      </div>

      <div
        className={`${styles.dropZone} ${isDragging ? styles.active : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)

          if (e.dataTransfer.files.length > 0) {
            onFileSelect(e.dataTransfer.files[0])
          }
        }}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/png'

          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files

            if (files && files.length > 0) {
              onFileSelect(files[0])
            }
          }

          input.click()
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className={styles.previewImage}
          />
        ) : (
          <>
            <div className={styles.uploadIcon}>📥</div>

            <span className={styles.dropTitle}>
              ここに「{currentPart}」のPNGをドロップ
            </span>

            <span className={styles.dropSubTitle}>
              またはクリックして選択
            </span>
          </>
        )}
      </div>

      <button
        onClick={onUploadSubmit}
        disabled={!selectedFile}
        className={`${styles.uploadButton} ${
          !selectedFile ? styles.disabled : ''
        }`}
      >
        🚀 この座標とパーツでアップロード確定
      </button>
    </div>
  )
}