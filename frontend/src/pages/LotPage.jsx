import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { hhmm, kakaoDirections, usePolling, walkMinutes } from '../lib.js'
import Layout from '../components/Layout.jsx'
import { LevelBadge, Remaining } from '../components/LotCard.jsx'

const SAVED = 'pm.voucher'

function savedVoucher() {
  try {
    return localStorage.getItem(SAVED)
  } catch {
    return null
  }
}

function NextShuttle({ stopName }) {
  const [route, setRoute] = useState(null)
  useEffect(() => {
    api.shuttle().then((r) => setRoute(r[0])).catch(() => {})
  }, [])
  if (!route || !stopName) return null
  const stop = route.stops.find((s) => s.name === stopName)
  if (!stop) return null
  const today = route.serviceToday
  return (
    <section className="card">
      <h2>셔틀버스 · {stop.name} 정류장</h2>
      {stop.next.length > 0 ? (
        <>
          <p className="muted">{today ? '이 정류장 다음 출발' : `다음 운행: ${route.serviceDate.slice(5).replace('-', '월 ')}일`}</p>
          <ul className="times">
            {stop.next.map((t) => (
              <li key={t}>{hhmm(t)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>오늘 운행이 끝났어요.</p>
      )}
      <p className="fine">
        토·일 {hhmm(route.firstDeparture)}~{hhmm(route.lastDeparture)}, 약 {route.intervalMinutes}분 간격.
        정류장별 시각은 추정값이라 교통 상황에 따라 달라질 수 있어요.
      </p>
      <Link className="btn ghost" to="/shuttle">전체 시간표</Link>
    </section>
  )
}

function VoucherForm({ lot }) {
  const nav = useNavigate()
  const [plate, setPlate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [benefit, setBenefit] = useState(null)
  const existing = savedVoucher()

  useEffect(() => {
    api.benefits().then((b) => setBenefit(b[0])).catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const v = await api.issueVoucher(lot.code, plate)
      try {
        localStorage.setItem(SAVED, v.code)
      } catch {
        /* 저장 안 되면 화면 주소로 대신 */
      }
      nav(`/v/${v.code}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card gift-card">
      <h2>무료이용권 받기</h2>
      {benefit && (
        <p>
          <strong>{benefit.name}</strong>
          {benefit.example && <span className="tag">검토 중</span>}
          <br />
          <span className="muted">{benefit.description}</span>
        </p>
      )}
      {existing && (
        <p>
          <Link to={`/v/${existing}`}>이미 받은 이용권 보기 ›</Link>
        </p>
      )}
      <form onSubmit={submit}>
        <label htmlFor="plate">차량번호</label>
        <input
          id="plate"
          className="plate-input"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="예) 12가 3456"
          autoComplete="off"
          required
        />
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="btn primary big" disabled={busy || plate.trim().length < 7}>
          {busy ? '확인 중…' : '이용권 받기'}
        </button>
      </form>
      <p className="fine">
        차량 1대당 하루 1장. 휴대폰 사용이 어려우시면 주차장 직원에게 차량번호를 말씀해 주세요.
      </p>
    </section>
  )
}

export default function LotPage() {
  const { code } = useParams()
  const { data: lot, error } = usePolling(() => api.lot(code), 10000, [code])

  if (error && !lot) {
    return (
      <Layout back="/">
        <p className="alert">{error.message}</p>
      </Layout>
    )
  }
  if (!lot) {
    return (
      <Layout back="/">
        <p className="muted">불러오는 중…</p>
      </Layout>
    )
  }

  return (
    <Layout back="/">
      <section className="lot-hero">
        <p className="eyebrow">지금 계신 주차장</p>
        <h1>{lot.name}</h1>
        <div className="status-line">
          <LevelBadge lot={lot} big />
          <Remaining lot={lot} />
        </div>
        {lot.sensorEnabled && (
          <p className="fine">
            {lot.sensorOnline ? '센서로 실시간 집계 중' : '센서 신호가 잠시 끊겼어요. 직원 확인값을 보여 드려요.'}
          </p>
        )}
        {lot.note && <p className="muted">{lot.note}</p>}
      </section>

      {lot.incentive ? (
        <VoucherForm lot={lot} />
      ) : (
        <section className="card">
          <p>이 주차장은 무료이용권 대상이 아니에요.</p>
          <Link className="btn ghost" to="/">무료이용권 주차장 보기</Link>
        </section>
      )}

      <NextShuttle stopName={lot.shuttleStop} />

      <section className="card">
        <h2>찾아오는 길</h2>
        {!lot.shuttleStop && <p>축제장까지 걸어서 약 {walkMinutes(lot)}분 (추정)</p>}
        <a className="btn" href={kakaoDirections(lot)} target="_blank" rel="noreferrer">
          카카오맵 길찾기
        </a>
        <p className="fine">위치 기준: {lot.coordSource}</p>
      </section>
    </Layout>
  )
}
