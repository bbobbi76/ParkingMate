import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { LEVEL, kakaoDirections, usePolling } from '../lib.js'
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

/** 고른 주차장: 화면 아래에 붙는 띠. 길찾기·자세히 버튼을 크게. */
function SelectedBar({ lot, onClose }) {
  const lv = LEVEL[lot.level] ?? LEVEL.UNKNOWN
  const showNum = lot.remaining != null && lot.level !== 'CLOSED' && lot.level !== 'FULL'
  return (
    <section className="pick-bar" aria-label={`${lot.name} 선택됨`}>
      <div className="pick-head">
        <strong>{lot.name.replace(/ ?임시주차장$/, '')}</strong>
        <span className={`st ${lv.cls}`}>{showNum ? `남은 자리 ${lot.remaining} · ${lv.word}` : lv.word === '확인 중' ? '정보없음' : lv.word}</span>
        <button className="pick-close" onClick={onClose} aria-label="닫기">닫기</button>
      </div>
      <div className="pick-actions">
        <a className="btn primary" href={kakaoDirections(lot)} target="_blank" rel="noreferrer">
          카카오맵 길찾기
        </a>
        <Link className="btn ghost" to={`/p/${lot.code}`}>
          자세히
        </Link>
      </div>
    </section>
  )
}

/** 지금 대기 좋은 곳 하나: 여유 + 일반 차량용, 이용권 주는 곳·남은 자리 많은 곳 먼저. */
function pickBest(lots) {
  const ok = lots.filter((l) => l.level === 'AVAILABLE' && l.category !== 'ACCESSIBLE' && l.category !== 'CAMPING')
  return ok.sort(
    (a, b) =>
      (b.incentive ? 1 : 0) - (a.incentive ? 1 : 0) ||
      (b.remaining ?? -1) - (a.remaining ?? -1) ||
      (b.shuttleStop ? 1 : 0) - (a.shuttleStop ? 1 : 0),
  )[0]
}

function Recommend({ lot, onPick }) {
  return (
    <button className="recommend" onClick={() => onPick(lot.code)}>
      <span className="rec-label">여기에 대세요</span>
      <span className="rec-main">
        <strong>{lot.name.replace(/ ?임시주차장$/, '')}</strong>
        {lot.remaining != null && (
          <span className="rec-num">
            <b>{lot.remaining}</b>자리 남음
          </span>
        )}
      </span>
      <span className="rec-sub">
        {lot.shuttleStop ? `${lot.shuttleStop}에서 셔틀 타요` : '축제장까지 걸어갈 수 있어요'}
        {lot.incentive && ' · 체험 이용권 드려요'}
      </span>
      <span className="rec-go">길찾기 ›</span>
    </button>
  )
}

export default function Home() {
  const { data: board, error } = usePolling(api.board, 10000)
  const lots = board?.lots
  // ?lot=wirari 로 들어오면 그 주차장을 고른 상태로 시작 (링크 공유·시연용)
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('lot'))
  const [filter, setFilter] = useState('all')

  const select = useCallback((code) => {
    setSelected(code)
    document.getElementById(`lot-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const all = lots ?? []
  const shown = all.filter((l) => (filter === 'open' ? l.level === 'AVAILABLE' : filter === 'shuttle' ? !!l.shuttleStop : true))
  const count = (lv) => all.filter((l) => l.level === lv).length
  const selectedLot = all.find((l) => l.code === selected)
  const benefitLots = all.filter((l) => l.incentive)
  const best = pickBest(all)

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

      {best && <Recommend lot={best} onPick={select} />}

      {benefitLots.length > 0 && !best?.incentive && (
        <p className="notice">
          <b>이용권 드려요</b>
          <span>
            {benefitLots.map((l) => l.name.replace(/ ?임시주차장$/, '')).join(' · ')}에 주차하고 셔틀을 타시면 체험 이용권을 드려요
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
      {!lots && !error && <p className="muted">불러오는 중…</p>}

      <div className="list-head">
        <span>주차장</span>
        <span>남은 자리</span>
      </div>
      <ul className="lot-rows">
        {shown.map((lot) => (
          <LotRow key={lot.code} lot={lot} selected={lot.code === selected} onSelect={select} />
        ))}
      </ul>
      {!selectedLot && lots && <p className="fine">주차장 이름을 누르면 길찾기 버튼이 나와요.</p>}
      {selectedLot && <div className="pick-space" aria-hidden />}
      {selectedLot && <SelectedBar lot={selectedLot} onClose={() => setSelected(null)} />}
    </Layout>
  )
}
