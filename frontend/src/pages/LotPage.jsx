import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { hhmm, kakaoDirections, usePolling, walkMinutes, walkMinutesBetween } from '../lib.js'
import MapView, { esc } from '../components/MapView.jsx'
import { busSvg } from '../components/Bus.jsx'
import Layout from '../components/Layout.jsx'
import { LevelBadge, Remaining } from '../components/LotCard.jsx'

function NextShuttle({ stopName, lot }) {
  // 15초마다 다시 읽어 버스 위치·남은 시간이 움직이게
  const { data: routes } = usePolling(api.shuttle, 15000)
  const route = routes?.[0]
  if (!route || !stopName) return null
  const stop = route.stops.find((s) => s.name === stopName)
  if (!stop) return null
  const today = route.serviceToday
  return (
    <section className="card">
      <h2>셔틀 정류장: {stop.name}</h2>
      <p className="big-line">주차장에서 걸어서 약 {walkMinutesBetween(lot, stop)}분</p>
      <MapView
        height={220}
        label="주차장과 셔틀 정류장 위치"
        markers={[
          { id: 'lot', lat: lot.lat, lng: lot.lng, html: `<div class="pin"><b>P</b><span>${esc(lot.name.replace(/ ?임시주차장$/, ''))}</span></div>`, z: 3 },
          { id: 'stop', lat: stop.lat, lng: stop.lng, html: `<div class="pin bus"><b>셔틀</b><span>${esc(stop.name)}</span></div>`, z: 4 },
          // 이 정류장으로 오고 있는 버스
          ...route.buses
            .filter((b) => b.toStop === stop.name)
            .map((b) => ({ id: `b${b.busNo}`, lat: b.lat, lng: b.lng, html: `<div class="bus-marker">${busSvg(28)}<b>${b.busNo}호차</b></div>`, z: 6 })),
        ]}
        fitTo={[
          [lot.lat, lot.lng],
          [stop.lat, stop.lng],
        ]}
        line={[
          [lot.lat, lot.lng],
          [stop.lat, stop.lng],
        ]}
      />
      <a className="btn ghost" href={`https://map.kakao.com/link/to/${encodeURIComponent(stop.name + ' 셔틀 정류장')},${stop.lat},${stop.lng}`} target="_blank" rel="noreferrer">
        정류장까지 길찾기
      </a>
      {stop.rideToFestivalMinutes > 0 && (
        <p className="big-line">
          타면 축제장까지 약 {stop.rideToFestivalMinutes}분 <span className="muted">({stop.alightAt}에서 내리세요)</span>
        </p>
      )}
      {stop.next.length > 0 ? (
        <>
          <p className="muted">
            {today
              ? stop.minutesUntilNext != null && (
                  <span className="soon">
                    다음 셔틀 <b>{stop.minutesUntilNext === 0 ? '곧 도착' : `${stop.minutesUntilNext}분 후`}</b>
                  </span>
                )
              : `다음 운행은 ${route.serviceDate.slice(5).replace('-', '월 ')}일이에요`}
          </p>
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
        토·일 {hhmm(route.firstDeparture)}~{hhmm(route.lastDeparture)}, {route.intervalMinutes}분마다 다녀요. 길이 막히면 조금 늦을 수 있어요.
      </p>
      <Link className="btn ghost" to="/shuttle">셔틀 전체 보기</Link>
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
        <h1>{lot.name}</h1>
        <div className="status-line">
          <LevelBadge lot={lot} big />
          <Remaining lot={lot} />
        </div>
        {lot.sensorEnabled && lot.sensorOnline && <p className="fine">입구·출구 센서로 세고 있어요</p>}
        {lot.note && <p className="muted">{lot.note}</p>}
      </section>

      <section className="card">
        <h2>길찾기</h2>
        <a className="btn primary big" href={kakaoDirections(lot)} target="_blank" rel="noreferrer">
          카카오맵으로 길찾기
        </a>
        <p className="fine">지금 계신 곳에서 이 주차장까지 안내해요.{lot.coordSource?.includes('근사') && ' 지도 위치는 대략적인 위치예요.'}</p>
        {!lot.shuttleStop && <p>주차하고 축제장까지 걸어서 약 {walkMinutes(lot)}분</p>}
      </section>

      {lot.incentive && (
        <section className="card benefit">
          <h2>이용 혜택</h2>
          <p>이 주차장에 차를 대고 셔틀을 타시면 체험 프로그램 이용권을 드려요.</p>
          <p className="fine">받는 곳은 주차장 안내 직원에게 물어봐 주세요.</p>
        </section>
      )}

      <NextShuttle stopName={lot.shuttleStop} lot={lot} />
    </Layout>
  )
}
