import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrImage({ text, size = 220, label }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then(setSrc)
      .catch(() => setSrc(null))
  }, [text, size])
  if (!src) return null
  return <img src={src} width={size} height={size} alt={label ?? 'QR 코드'} className="qr" />
}
