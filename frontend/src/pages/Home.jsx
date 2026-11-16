import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { LEVEL, usePolling } from '../lib.js'
import Layout from '../components/Layout.jsx'
import LotMap from '../components/LotMap.jsx'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'open', label: '여유 있는 곳' },
  { key: 'shuttle', label: '셔틀 정류장' },
]

function clock(d) {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
}

function LotRow({ lot, selected, onSelect }) {
  const lv = LEVEL[lot.level] ?? LEVEL.UNKNOWN
  return (
    <li id={`lot-${lot.code}`} className={`lot-row ${lv.cls}${selected ? ' selected' : ''}`}>
      <button className="lot-row-main" onClick={() => onSelect(lot.code)}>
        <span className="lot-row-name">
          {lot.name.replace(/ ?임시주차장$/, '')}
          {lot.incentive && <em className="mark-benefit">혜택</em>}
        </span>
        <span className="lot-row-sub">
          {lot.shuttleStop ? `셔틀 ${lot.shuttleStop}` : lot.note ?? '축제장 인근'}
        </span>
      </button>
      <Link to={`/p/${lot.code}`} className="lot-row-num" aria-label={`${lot.name} 상세`}>
        {lot.remaining != null && lot.level !== 'CLOSED' && lot.level !== 'FULL' ? (
          <>
            <strong>{lot.remaining}</strong>
            <span className={`st ${lv.cls}`}>{lv.word}</span>
          </>
        ) : (
          <span className={`st big ${lv.cls}`}>{lot.level === 'UNKNOWN' ? '정보없음' : lv.word}</span>
        )}
      </Link>
    </li>
  )
}

export default function Home() {
  const { data: board, error } = usePolling(api.board, 10000)
  const lots = board?.lots
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')

  const select = useCallback((code) => {
    setSelected(code)
    document.getElementById(`lot-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const all = lots ?? []
  const shown = all.filter((l) => (filter === 'open' ? l.level === 'AVAILABLE' : filter === 'shuttle' ? !!l.shuttleStop : true))
  const count = (lv) => all.filter((l) => l.level === lv).length
  const benefitLots = all.filter((l) => l.incentive)

  return (
    <Layout>
      <div className="board-head">
        <h1>임시주차장 현황</h1>
        {board && <span className="stamp">{clock(board.now)} 기준</span>}
      </div>

      <dl className="tally">
        <div className="ok"><dt>여유</dt><dd>{count('AVAILABLE')}</dd></div>
        <div className="busy"><dt>혼잡</dt><dd>{count('BUSY')}</dd></div>
        <div className="full"><dt>만차</dt><dd>{count('FULL')}</dd></div>
        <div className="unknown"><dt>정보없음</dt><dd>{count('UNKNOWN')}</dd></div>
      </dl>

      {benefitLots.length > 0 && (
        <p className="notice">
          <b>먼 주차장 혜택</b>
          <span>
            {benefitLots.map((l) => l.name.replace(/ ?임시주차장$/, '')).join(' · ')}에 대고 셔틀을 타면 체험 이용권 (화천군 검토 중)
          </span>
        </p>
      )}

      <LotMap lots={shown} selected={selected} onSelect={select} height={300} />

      <div className="seg-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && !lots && <p className="alert">{error.message}</p>}
      {!lots && !error && <p className="muted">불러오는 중</p>}

      <div className="list-head">
        <span>주차장</span>
        <span>남은 자리</span>
      </div>
      <ul className="lot-rows">
        {shown.map((lot) => (
          <LotRow key={lot.code} lot={lot} selected={lot.code === selected} onSelect={select} />
        ))}
      </ul>
    </Layout>
  )
}
