import { useParams } from 'react-router-dom'
import { api } from '../api.js'
import { usePolling } from '../lib.js'
import Layout from '../components/Layout.jsx'
import QrImage from '../components/QrImage.jsx'

function time(iso) {
  return iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }) : ''
}

export default function VoucherPage() {
  const { code } = useParams()
  const { data: v, error } = usePolling(() => api.voucher(code), 5000, [code])

  if (error && !v) {
    return (
      <Layout back="/">
        <p className="alert">{error.message}</p>
      </Layout>
    )
  }
  if (!v) {
    return (
      <Layout back="/">
        <p className="muted">불러오는 중…</p>
      </Layout>
    )
  }

  const used = v.status === 'REDEEMED'
  return (
    <Layout back={`/p/${v.lotCode}`}>
      <section className={`voucher${used ? ' used' : ''}`}>
        <p className="eyebrow">{used ? '사용 완료' : '발급 당일 사용'}</p>
        <h1>{v.benefitName}</h1>
        {v.benefitIsExample && <p className="tag">혜택 내용 검토 중</p>}
        <div className="voucher-code" aria-label={`이용권 번호 ${v.code.split('').join(' ')}`}>
          {v.code}
        </div>
        {!used && <QrImage text={v.code} label="이용권 QR" />}
        <dl className="kv">
          <dt>차량번호</dt>
          <dd>{v.plateNumber}</dd>
          <dt>주차장</dt>
          <dd>{v.lotName}</dd>
          <dt>받은 시각</dt>
          <dd>{time(v.issuedAt)}</dd>
          {used && (
            <>
              <dt>사용 시각</dt>
              <dd>{time(v.redeemedAt)}</dd>
            </>
          )}
        </dl>
        {!used && (
          <p className="howto">
            축제장 <strong>안내소</strong>에 이 화면 제시
            <br />
            (캡처 화면도 사용 가능)
          </p>
        )}
      </section>
    </Layout>
  )
}
