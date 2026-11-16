import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { LEVEL, kakaoDirections, usePolling, walkMinutes } from '../lib.js'
import Layout from '../components/Layout.jsx'
import LotMap from '../components/LotMap.jsx'

const FILTERS = [
  { key: 'all', label: '전체' },
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

function Recommend({ lot }) {
  return (
    <section className="recommend">
      <div className="rec-main">
        <Link to={`/p/${lot.code}`} className="rec-name">
          {lot.name.replace(/ ?임시주차장$/, '')}
        </Link>
        {lot.remaining != null && (
          <span className="rec-num">
            <b>{lot.remaining}</b>자리 남음
          </span>
        )}
      </div>
      <p className="rec-sub">{lot.shuttleStop ? `셔틀 정류장: ${lot.shuttleStop}` : `축제장까지 걸어서 약 ${walkMinutes(lot)}분`}</p>
      <a className="btn primary big rec-btn" href={kakaoDirections(lot)} target="_blank" rel="noreferrer">
        카카오맵 길찾기
      </a>
    </section>
  )
}

export default function Home() {
  const { data: board, error } = usePolling(api.board, 10000)
  const lots = board?.lots
  // ?lot=wirari 로 들어오면 그 주차장을 고른 상태로 시작 (링크 공유·시연용)
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('lot'))
  const [filter, setFilter] = useState('all')

  // 같은 주차장을 다시 누르면 선택 해제. 화면은 움직이지 않음(고른 주차장은 아래 띠에 나옴)
  const select = useCallback((code) => {
    setSelected((cur) => (cur === code ? null : code))
  }, [])

  const all = lots ?? []
  // 상태 칸(여유·혼잡·만차·정보없음)을 누르면 그 상태만, 셔틀 정류장 탭은 셔틀 있는 곳만
  const [level, setLevel] = useState(null)
  const shown = all.filter((l) => (filter === 'shuttle' ? !!l.shuttleStop : true) && (level ? l.level === level : true))
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

      <div className="tally" role="group" aria-label="상태별로 보기">
        {[
          ['AVAILABLE', '여유', 'ok'],
          ['BUSY', '혼잡', 'busy'],
          ['FULL', '만차', 'full'],
          ['UNKNOWN', '정보없음', 'unknown'],
        ].map(([lv, word, cls]) => (
          <button
            key={lv}
            className={`${cls}${level === lv ? ' on' : ''}`}
            aria-pressed={level === lv}
            onClick={() => setLevel((cur) => (cur === lv ? null : lv))}
          >
            <span className="t-word">{word}</span>
            <span className="t-num">{count(lv)}</span>
          </button>
        ))}
      </div>
      {level && (
        <p className="filter-note">
          {{ AVAILABLE: '여유', BUSY: '혼잡', FULL: '만차', UNKNOWN: '정보없음' }[level]} 주차장만 보고 있어요
          <button className="link-btn" onClick={() => setLevel(null)}>
            전체 보기
          </button>
        </p>
      )}

      {best && <Recommend lot={best} />}

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
