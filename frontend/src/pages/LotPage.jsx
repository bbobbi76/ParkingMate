import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { hhmm, kakaoDirections, usePolling, walkMinutes } from '../lib.js'
import Layout from '../components/Layout.jsx'
import { LevelBadge, Remaining } from '../components/LotCard.jsx'

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
        <p className="eyebrow">주차장 정보</p>
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
