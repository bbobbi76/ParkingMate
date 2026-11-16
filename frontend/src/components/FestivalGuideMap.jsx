import { PLACE_CATEGORY } from '../lib.js'

/*
 * 축제장 안내도: 화천천 얼음 위 축제장을 세로 한 줄로 그린 그림 지도.
 * 공식 행사장 안내도처럼 강(얼음판)을 가운데, 서쪽 둑(접수처·구이터·얼곰이성)과 동쪽 둑(안내센터·방송국)을 양옆에 둔다.
 * 위치는 각 장소 좌표를 강 방향 축(루어낚시터 쪽 남 → 예약낚시터 쪽 북)에 투영해 자동으로 정한다.
 */
const AXIS_A = { lat: 38.103, lng: 127.711 } // 남쪽 끝(루어낚시터 근처)
const AXIS_B = { lat: 38.113, lng: 127.708 } // 북쪽 끝(예약낚시터 근처)
const COS = Math.cos((38.1 * Math.PI) / 180)

function project(p) {
  const bx = (AXIS_B.lng - AXIS_A.lng) * 111000 * COS
  const by = (AXIS_B.lat - AXIS_A.lat) * 111000
  const len = Math.hypot(bx, by)
  const x = (p.lng - AXIS_A.lng) * 111000 * COS
  const y = (p.lat - AXIS_A.lat) * 111000
  const t = (x * bx + y * by) / (len * len) // 0 남 ~ 1 북
  const side = (x * by - y * bx) / len // + 동쪽 둑, − 서쪽 둑 (m)
  return { t, side }
}

const W = 360
const TOP = 46
const H_BODY = 820
const COLS = {
  west: { x: 4, w: 112, label: '서쪽 둑' },
  ice: { x: 122, w: 116, label: '얼음 위' },
  east: { x: 244, w: 112, label: '동쪽 둑' },
}
const ROW = 40

function column(side) {
  if (side < -45) return 'west'
  if (side > 100) return 'east'
  return 'ice'
}

/** 같은 칸에서 겹치지 않게 위아래로 밀어 낸다. */
function layout(places) {
  const items = places.map((p) => {
    const { t, side } = project(p)
    const col = column(side)
    const y = TOP + (1 - Math.min(1.05, Math.max(-0.05, t))) * H_BODY
    return { p, col, y }
  })
  for (const col of Object.keys(COLS)) {
    const list = items.filter((i) => i.col === col).sort((a, b) => a.y - b.y)
    for (let i = 1; i < list.length; i++) {
      if (list[i].y - list[i - 1].y < ROW) list[i].y = list[i - 1].y + ROW
    }
  }
  return items
}

function short(name) {
  return name.replace(/\(.*\)/, '').replace('얼음낚시터', '낚시터').trim()
}

export default function FestivalGuideMap({ places, selected, onSelect }) {
  const items = layout(places)
  const height = Math.max(TOP + H_BODY + 60, ...items.map((i) => i.y + 50))
  const bridgeY = TOP + (1 - 0.755) * H_BODY

  return (
    <svg className="guide-map" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="축제장 안내도">
      {/* 둑과 얼음판 */}
      <rect x="0" y="0" width={W} height={height} fill="#f3f5f8" />
      <rect x={COLS.ice.x - 4} y="26" width={COLS.ice.w + 8} height={height - 40} rx="14" fill="#dceefa" stroke="#a9cfe8" />
      {Object.values(COLS).map((c) => (
        <text key={c.label} x={c.x + c.w / 2} y="18" textAnchor="middle" className="gm-col">
          {c.label}
        </text>
      ))}
      <text x={COLS.ice.x + COLS.ice.w / 2} y={TOP - 6} textAnchor="middle" className="gm-dir">
        ▲ 북쪽 · 화천대교 반대편
      </text>
      <text x={COLS.ice.x + COLS.ice.w / 2} y={height - 20} textAnchor="middle" className="gm-dir">
        ▼ 남쪽 · 화천대교 쪽
      </text>
      {/* 배머리교 */}
      <rect x="0" y={bridgeY - 7} width={W} height="14" fill="#c9ced6" />
      <text x={W - 6} y={bridgeY + 4} textAnchor="end" className="gm-bridge">
        배머리교
      </text>

      {items.map(({ p, col, y }) => {
        const c = COLS[col]
        const cat = PLACE_CATEGORY[p.category] ?? PLACE_CATEGORY.ETC
        const sel = p.id === selected
        return (
          <g
            key={p.id}
            className={`gm-item ${cat.cls}${sel ? ' sel' : ''}`}
            transform={`translate(${c.x}, ${y - 15})`}
            onClick={() => onSelect(p.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(p.id)}
            aria-label={p.name}
          >
            <rect width={c.w} height="32" rx="7" />
            <circle cx="12" cy="16" r="5" />
            <text x="22" y="21">
              {short(p.name).length > 8 ? `${short(p.name).slice(0, 8)}…` : short(p.name)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
