import { useMemo, useState } from 'react'
import { api } from '../api.js'
import { PLACE_CATEGORY, kakaoDirections, usePolling } from '../lib.js'
import Layout from '../components/Layout.jsx'
import MapView, { esc } from '../components/MapView.jsx'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'FISHING', label: '낚시' },
  { key: 'SNOW', label: '체험' },
  { key: 'FOOD', label: '먹거리' },
  { key: 'INFO', label: '안내' },
]

// 장소가 좁은 곳에 몰려 있어 이름표는 낚시터와 선택한 곳만. 나머지는 분류 색 점.
function pinHtml(p, selected) {
  const c = PLACE_CATEGORY[p.category] ?? PLACE_CATEGORY.ETC
  if (selected || p.category === 'FISHING') {
    return `<div class="pin place ${c.cls}${selected ? ' sel' : ''}" title="${esc(p.name)}"><span>${esc(p.name)}</span></div>`
  }
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

  const shown = useMemo(
    () =>
      (places ?? []).filter((p) =>
        filter === 'all' ? true : filter === 'SNOW' ? p.category === 'SNOW' || p.category === 'CULTURE' : p.category === filter,
      ),
    [places, filter],
  )
  const markers = useMemo(
    () =>
      shown.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        html: pinHtml(p, p.id === selected),
        z: p.id === selected ? 10 : 2,
        onClick: () => {
          setSelected(p.id)
          document.getElementById(`place-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        },
      })),
    [shown, selected],
  )
  const focus = places?.find((p) => p.id === selected)

  return (
    <Layout>
      <h1>축제장 안내</h1>
      <p className="muted">낚시터, 체험장, 먹거리, 접수처를 지도에서 찾아보세요.</p>

      <MapView markers={markers} focus={focus} height={340} label="축제장 장소 지도" fitKey={filter} />
      <Legend />

      <div className="seg-tabs five" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && !places && <p className="alert">{error.message}</p>}
      {!places && !error && <p className="muted">불러오는 중…</p>}

      <ul className="place-list">
        {shown.map((p) => {
          const c = PLACE_CATEGORY[p.category] ?? PLACE_CATEGORY.ETC
          return (
            <li key={p.id} id={`place-${p.id}`} className={p.id === selected ? 'selected' : ''}>
              <button className="place-main" onClick={() => setSelected(p.id)}>
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
        2026년 축제 안내도와 요금 기준이라 올해는 조금 달라질 수 있어요. 지도 위치는 대략적인 위치예요.
      </p>
    </Layout>
  )
}
