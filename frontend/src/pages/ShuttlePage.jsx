import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { hhmm } from '../lib.js'
import Layout from '../components/Layout.jsx'

const DAY = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' }

export default function ShuttlePage() {
  const [routes, setRoutes] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    api.shuttle().then(setRoutes).catch(setError)
  }, [])

  return (
    <Layout>
      <h1>셔틀버스</h1>
      {error && <p className="alert">{error.message}</p>}
      {!routes && !error && <p className="muted">불러오는 중…</p>}
      {routes?.map((r) => {
        const days = r.days.split(',').map((d) => DAY[d]).join('·')
        return (
          <section className="card" key={r.name}>
            <h2>{r.name}</h2>
            <p className="big-line">
              {days}요일 {hhmm(r.firstDeparture)}~{hhmm(r.lastDeparture)}
              <br />약 {r.intervalMinutes}분마다 · 버스 {r.busCount}대 순환 · 무료
            </p>
            <p className="muted">
              {r.runningNow ? '지금 운행 중이에요.' : `다음 운행일: ${r.serviceDate}`}
            </p>
            <ol className="route">
              {r.stops.map((s) => (
                <li key={s.seq}>
                  <span className="dot" aria-hidden />
                  <div>
                    <strong>{s.name}</strong>
                    <span className="next">
                      {s.next.length ? s.next.map(hhmm).join('  ') : '오늘 운행 끝'}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="fine">
              노선·운행 시간: {r.source}. 정류장별 시각은 정류장 사이 약 10분으로 추정한 값입니다.
            </p>
          </section>
        )
      })}
    </Layout>
  )
}
