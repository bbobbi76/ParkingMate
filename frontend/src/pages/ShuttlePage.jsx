import { useMemo, useState } from 'react'
import { api } from '../api.js'
import { hhmm, usePolling } from '../lib.js'
import Layout from '../components/Layout.jsx'
import MapView, { esc } from '../components/MapView.jsx'

const DAY = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' }

/** 정류장 i 를 떠나 다음 정류장으로 가는 중인 버스들 */
function busesAfter(r, stop) {
  return r.buses.filter((b) => b.fromStop === stop.name)
}

function RouteMap({ r }) {
  const markers = useMemo(
    () => [
      ...r.stops.map((s) => ({
        id: `s${s.seq}`,
        lat: s.lat,
        lng: s.lng,
        html: `<div class="pin stop${s.festival ? ' fest' : ''}"><span>${esc(s.name)}</span></div>`,
        z: 2,
      })),
      ...r.buses.map((b) => ({ id: `b${b.busNo}`, lat: b.lat, lng: b.lng, html: `<div class="pin bus"><b>${b.busNo}호차</b></div>`, z: 10 })),
    ],
    [r],
  )
  const line = useMemo(() => {
    const pts = r.stops.map((s) => [s.lat, s.lng])
    return pts.length ? [...pts, pts[0]] : pts
  }, [r])
  return <MapView markers={markers} line={line} height={300} label="셔틀 노선 지도" />
}

function RouteCard({ r }) {
  const [showMap, setShowMap] = useState(false)
  const days = r.days.split(',').map((d) => DAY[d]).join('·')
  const running = r.runningNow

  return (
    <section className="card">
      <div className="shuttle-head">
        <h2>{r.name}</h2>
        <span className={`badge ${running ? 'ok' : 'closed'}`}>{running ? '운행 중' : '운행 전'}</span>
      </div>
      <p className="shuttle-sum">
        <b>{r.intervalMinutes}분마다</b> · 무료 · {running ? `${hhmm(r.now)} 기준` : `다음 운행 ${r.serviceDate.slice(5).replace('-', '월 ')}일`}
      </p>

      <ol className="line-route" aria-label="정류장 순서와 버스 위치">
        {r.stops.map((s) => (
          <li key={s.seq} className={s.festival ? 'fest' : ''}>
            <div className="stop-row">
              <span className="node" aria-hidden />
              <div className="stop-name">
                <strong>{s.name}</strong>
                {s.festival ? (
                  <span className="fest-tag">축제장 앞</span>
                ) : (
                  s.rideToFestivalMinutes > 0 && <span className="ride">축제장까지 {s.rideToFestivalMinutes}분</span>
                )}
              </div>
              <div className="stop-time">
                {s.minutesUntilNext != null ? (
                  <>
                    <b>{s.minutesUntilNext === 0 ? '곧' : s.minutesUntilNext}</b>
                    {s.minutesUntilNext === 0 ? '도착' : '분 후'}
                  </>
                ) : (
                  <span className="muted">{s.next[0] ? hhmm(s.next[0]) : '운행 끝'}</span>
                )}
              </div>
            </div>
            {busesAfter(r, s).map((b) => (
              <div key={b.busNo} className="bus-row">
                <span className="bus-chip">{b.busNo}호차</span>
                <span>다음 정류장까지 {b.minutesToNextStop}분</span>
              </div>
            ))}
          </li>
        ))}
        <li className="loop-back">
          <span className="node" aria-hidden />
          <span className="muted">첫 정류장으로 돌아가요</span>
        </li>
      </ol>

      <button className="btn ghost big" onClick={() => setShowMap((v) => !v)}>
        {showMap ? '지도 닫기' : '지도로 보기'}
      </button>
      {showMap && <RouteMap r={r} />}

      <p className="fine">
        {days} {hhmm(r.firstDeparture)}~{hhmm(r.lastDeparture)}, 버스 {r.busCount}대가 돌아요.
        버스 위치와 도착 시간은 시간표로 계산한 거라 실제와 조금 다를 수 있어요.
        {r.always && ' (시연 중에는 매일 다니는 걸로 보여요)'}
      </p>
    </section>
  )
}

export default function ShuttlePage() {
  const { data: routes, error } = usePolling(api.shuttle, 15000)
  return (
    <Layout>
      <h1>셔틀버스</h1>
      {error && !routes && <p className="alert">{error.message}</p>}
      {!routes && !error && <p className="muted">불러오는 중…</p>}
      {routes?.map((r) => <RouteCard key={r.name} r={r} />)}
    </Layout>
  )
}
