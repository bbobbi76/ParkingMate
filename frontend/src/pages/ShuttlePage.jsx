import { useMemo } from 'react'
import { api } from '../api.js'
import { hhmm, usePolling } from '../lib.js'
import Layout from '../components/Layout.jsx'
import MapView, { esc } from '../components/MapView.jsx'

const DAY = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' }

function stopHtml(s, festival) {
  return `<div class="pin stop${festival ? ' fest' : ''}"><span>${esc(s.name)}${festival ? ' · 축제장' : ''}</span></div>`
}

function busHtml(b) {
  return `<div class="pin bus"><b>${b.busNo}호차</b><span>${esc(b.toStop)} ${b.minutesToNextStop}분</span></div>`
}

function RouteCard({ r }) {
  const days = r.days.split(',').map((d) => DAY[d]).join('·')
  const markers = useMemo(
    () => [
      ...r.stops.map((s) => ({ id: `s${s.seq}`, lat: s.lat, lng: s.lng, html: stopHtml(s, s.festival), z: 2 })),
      ...r.buses.map((b) => ({ id: `b${b.busNo}-${b.departedAt}`, lat: b.lat, lng: b.lng, html: busHtml(b), z: 10 })),
    ],
    [r],
  )
  const line = useMemo(() => {
    const pts = r.stops.map((s) => [s.lat, s.lng])
    return pts.length ? [...pts, pts[0]] : pts
  }, [r])

  return (
    <section className="card">
      <h2>{r.name}</h2>
      <p className="big-line">
        {days}요일 {hhmm(r.firstDeparture)}~{hhmm(r.lastDeparture)}
        <br />약 {r.intervalMinutes}분마다 · 버스 {r.busCount}대 순환 · 무료
      </p>

      {r.runningNow ? (
        <p className="live">
          지금 운행 중 · 노선 위 버스 <strong>{r.buses.length}대</strong>
          <span className="fine"> ({hhmm(r.now)} 기준)</span>
        </p>
      ) : (
        <p className="muted">운행 시간이 아니에요 · 다음 운행 {r.serviceDate.slice(5).replace('-', '월 ')}일</p>
      )}

      <MapView markers={markers} line={line} height={320} label="셔틀 노선과 버스 위치" />
      <p className="fine">
        버스 위치는 시간표로 계산한 <b>예상 위치</b>예요(실시간 GPS 아님). 축제장 바로 옆 정류장: {r.festivalStops.join(', ')}.
      </p>

      <ol className="route">
        {r.stops.map((s) => (
          <li key={s.seq}>
            <span className={`dot${s.festival ? ' fest' : ''}`} aria-hidden />
            <div className="route-body">
              <strong>
                {s.name}
                {s.festival && <span className="tag">축제장 앞</span>}
              </strong>
              {s.minutesUntilNext != null ? (
                <span className="soon">
                  다음 셔틀 <b>{s.minutesUntilNext === 0 ? '곧 도착' : `${s.minutesUntilNext}분 후`}</b> ({hhmm(s.next[0])})
                </span>
              ) : (
                <span className="next">{s.next.length ? s.next.map(hhmm).join('  ') : '오늘 운행 끝'}</span>
              )}
              {s.rideToFestivalMinutes > 0 && (
                <span className="ride">
                  타면 축제장({s.alightAt})까지 약 {s.rideToFestivalMinutes}분
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="fine">
        노선·운행 시간: {r.source}. 정류장별 시각과 걸리는 시간은 정류장 사이 약 10분으로 추정한 값이라 교통 상황에 따라 달라질 수 있어요.
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
