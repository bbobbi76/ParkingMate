import { useMemo, useState } from 'react'
import { api } from '../api.js'
import { PLACE_CATEGORY, kakaoDirections, usePolling } from '../lib.js'
import Layout from '../components/Layout.jsx'
import MapView, { esc } from '../components/MapView.jsx'
import ZONES from '../data/festivalZones.json'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'FISHING', label: '낚시' },
  { key: 'SNOW', label: '체험' },
  { key: 'FOOD', label: '먹거리' },
  { key: 'INFO', label: '안내' },
]

/** 지도 구역 색: 분류 색과 같게 (style.css 의 .c-fish 등) */
const ZONE_COLOR = { FISHING: '#0b5fa5', SNOW: '#5b4bb7', CULTURE: '#8a4b00', FOOD: '#b0302a', INFO: '#157f3b', ETC: '#4a5565' }
const ICE = '#cfe6f6'
const ICE_EDGE = '#7fb7dd'
/** 배머리교(OSM 다리 위치): 맨손잡기장·예약낚시터가 다리 북쪽 */
const BRIDGE = { lat: 38.11120, lng: 127.71010 }
/** 처음 보이는 범위: 얼음판 전체 */
const FIT = [...ZONES.ice, ...ZONES.iceNorth, ...ZONES.zones.find((z) => z.name === '루어낚시터').polygon]
const OFFICIAL_MAP = 'https://www.narafestival.com/01_icenara/?wr_id=6'

const zoneByName = Object.fromEntries(ZONES.zones.map((z) => [z.name, z]))

function matches(filter, p) {
  if (filter === 'all') return true
  if (filter === 'SNOW') return p.category === 'SNOW' || p.category === 'CULTURE'
  return p.category === filter
}

// 얼음 위 구역은 이름표를, 둑 위 시설은 분류 색 점을. 고른 곳은 남색 이름표.
function labelHtml(p, selected, onIce, showLabel) {
  const c = PLACE_CATEGORY[p.category] ?? PLACE_CATEGORY.ETC
  if (selected) return `<div class="pin place sel"><span>${esc(p.name)}</span></div>`
  if (onIce && !showLabel) return `<div class="zone-dot" title="${esc(p.name)}"></div>`
  if (onIce) return `<div class="zone-text ${c.cls}">${esc(p.name.replace(' 체험존', '').replace('·파크골프', ''))}</div>`
  return `<div class="dot-pin ${c.cls}" title="${esc(p.name)}"></div>`
}

function Legend() {
  return (
    <p className="legend">
      {Object.entries(PLACE_CATEGORY)
        .filter(([k]) => k !== 'ETC')
        .map(([k, v]) => (
          <span key={k}>
            <i className={`dot-pin static ${v.cls}`} aria-hidden />
            {v.word}
          </span>
        ))}
    </p>
  )
}

export default function FestivalPage() {
  const { data: places, error } = usePolling(api.places, 60000)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  // 같은 곳을 다시 누르면 선택 해제. 화면은 움직이지 않고 지도 바로 아래에 정보가 뜬다
  const pick = (id) => setSelected((cur) => (cur === id ? null : id))

  const shown = useMemo(() => (places ?? []).filter((p) => matches(filter, p)), [places, filter])

  // 얼음판(화천천) 바탕 + 구역 다각형
  const polygons = useMemo(() => {
    const base = [
      { id: 'ice', path: ZONES.ice, fill: ICE, stroke: ICE_EDGE, opacity: 0.85, weight: 2 },
      { id: 'ice-n', path: ZONES.iceNorth, fill: ICE, stroke: ICE_EDGE, opacity: 0.85, weight: 2 },
    ]
    const zones = (places ?? [])
      .filter((p) => zoneByName[p.name])
      .map((p) => {
        const z = zoneByName[p.name]
        const on = matches(filter, p)
        const sel = p.id === selected
        return {
          id: `z${p.id}`,
          path: z.polygon,
          fill: sel ? '#14365c' : ZONE_COLOR[p.category] ?? ZONE_COLOR.ETC,
          stroke: '#ffffff',
          opacity: sel ? 0.75 : on ? 0.5 : 0.1,
          weight: 2,
          onClick: () => pick(p.id),
        }
      })
    return [...base, ...zones]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, filter, selected])

  const markers = useMemo(
    () =>
      shown.map((p) => {
        const onIce = !!zoneByName[p.name]
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          // 좁은 가운데 체험 구역은 '전체'에서 이름이 겹쳐서, 낚시터만 이름표. 체험 탭에서는 다 보임
          html: labelHtml(p, p.id === selected, onIce, p.category === 'FISHING' || filter !== 'all'),
          z: p.id === selected ? 10 : onIce ? 3 : 2,
          onClick: () => pick(p.id),
        }
      }).concat([{ id: 'bridge', lat: BRIDGE.lat, lng: BRIDGE.lng, html: '<div class="bridge-text">배머리교</div>', z: 1 }]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, selected, filter],
  )
  const sel = places?.find((p) => p.id === selected)
  const selCat = sel ? PLACE_CATEGORY[sel.category] ?? PLACE_CATEGORY.ETC : null

  return (
    <Layout>
      <h1>축제장 안내</h1>
      <p className="muted">화천천 얼음 위 낚시터·체험장과 둑의 접수처·먹거리예요. 눌러 보세요.</p>

      <div className="seg-tabs five" role="tablist" aria-label="종류">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="fest-map">
        <MapView markers={markers} polygons={polygons} focus={sel} height={520} label="축제장 안내 지도" fitKey="festival" fitTo={FIT} />
      </div>
      <Legend />

      {sel && (
        <section className="card place-pick">
          <span className={`cat ${selCat.cls}`}>{selCat.word}</span>
          <h2>{sel.name}</h2>
          {sel.description && <p>{sel.description}</p>}
          {sel.fee && <p className="fee-line">이용료 {sel.fee}</p>}
          <div className="row">
            <a className="btn primary" href={kakaoDirections(sel)} target="_blank" rel="noreferrer">
              카카오맵 길찾기
            </a>
            <button className="btn ghost" onClick={() => setSelected(null)}>
              닫기
            </button>
          </div>
        </section>
      )}

      <a className="btn ghost big" href={OFFICIAL_MAP} target="_blank" rel="noreferrer">
        공식 행사장 안내도 보기 (재단법인 나라)
      </a>

      {error && !places && <p className="alert">{error.message}</p>}
      {!places && !error && <p className="muted">불러오는 중…</p>}

      <ul className="place-list">
        {shown.map((p) => {
          const c = PLACE_CATEGORY[p.category] ?? PLACE_CATEGORY.ETC
          return (
            <li key={p.id} id={`place-${p.id}`} className={p.id === selected ? 'selected' : ''}>
              <button className="place-main" onClick={() => pick(p.id)}>
                <span className={`cat ${c.cls}`}>{c.word}</span>
                <strong>{p.name}</strong>
                {p.description && <span className="desc">{p.description}</span>}
                {p.fee && <span className="fee">이용료 {p.fee}</span>}
              </button>
              <a className="btn ghost small" href={kakaoDirections(p)} target="_blank" rel="noreferrer">
                길찾기
              </a>
            </li>
          )
        })}
      </ul>

      <p className="fine">
        2026년 축제 안내도와 요금 기준이라 올해는 조금 달라질 수 있어요. 얼음 위 구역은 실제 화천천 모양에 안내도 순서대로 나눈
        대략적인 범위예요. 지도 © OpenStreetMap
      </p>
    </Layout>
  )
}
