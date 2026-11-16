import { Link } from 'react-router-dom'
import { LEVEL, kakaoDirections, walkMinutes } from '../lib.js'

const CATEGORY = {
  REMOTE: '셔틀로 이동',
  SHUTTLE: '셔틀 정류장 앞',
  NEAR: '축제장 가까움',
  ACCESSIBLE: '장애인 전용',
  CAMPING: '캠핑카·카라반 전용',
}

export function LevelBadge({ lot, big = false }) {
  const lv = LEVEL[lot.level] ?? LEVEL.UNKNOWN
  return <span className={`badge ${lv.cls}${big ? ' big' : ''}`}>{lv.word}</span>
}

export function Remaining({ lot }) {
  if (lot.level === 'CLOSED') return <p className="remain muted">지금은 운영하지 않아요</p>
  if (lot.remaining == null) return <p className="remain muted">남은 자리 정보 없음</p>
  return (
    <p className="remain">
      남은 자리 <strong>{lot.remaining.toLocaleString()}</strong>
      <small> / {(lot.operableCapacity ?? lot.capacity).toLocaleString()}대</small>
    </p>
  )
}

export default function LotCard({ lot, selected, onSelect }) {
  return (
    <article
      className={`lot-card${selected ? ' selected' : ''}`}
      onClick={() => onSelect?.(lot.code)}
    >
      <div className="lot-head">
        <h3>{lot.name}</h3>
        <LevelBadge lot={lot} />
      </div>
      <Remaining lot={lot} />
      <p className="meta">
        {CATEGORY[lot.category]}
        {lot.shuttleStop ? ` · 셔틀 「${lot.shuttleStop}」 정류장` : ` · 축제장까지 걸어서 약 ${walkMinutes(lot)}분`}
      </p>
      <div className="row">
        <a className="btn" href={kakaoDirections(lot)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          길찾기
        </a>
        <Link className="btn ghost" to={`/p/${lot.code}`} onClick={(e) => e.stopPropagation()}>
          자세히
        </Link>
      </div>
    </article>
  )
}
