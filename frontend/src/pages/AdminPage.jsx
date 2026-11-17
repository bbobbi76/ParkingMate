import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { LEVEL, usePolling } from '../lib.js'
import AdminPlaces from './AdminPlaces.jsx'
import AdminLots from './AdminLots.jsx'
import LotMap from '../components/LotMap.jsx'

const KEY = 'pm.adminKey'
const STATUS = [
  ['AUTO', '자동'],
  ['AVAILABLE', '여유'],
  ['BUSY', '혼잡'],
  ['FULL', '만차'],
  ['CLOSED', '운영 안 함'],
]

function readKey() {
  // 개발 서버에서만: /admin?devlogin 으로 로컬 테스트 키 자동 입력 (화면 캡처용). 배포 빌드에는 포함되지 않음.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('devlogin')) return 'dev-admin'
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

function Login({ onLogin }) {
  const [k, setK] = useState('')
  const [err, setErr] = useState(null)
  const [checking, setChecking] = useState(true)
  // 서버가 키 없이 열려 있으면(ADMIN_OPEN) 바로 들어감
  useEffect(() => {
    api.admin
      .summary('open')
      .then(() => onLogin('open'))
      .catch(() => setChecking(false))
  }, [onLogin])
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.admin.summary(k)
      try {
        sessionStorage.setItem(KEY, k)
      } catch {
        /* 무시 */
      }
      onLogin(k)
    } catch (e2) {
      setErr(e2.message)
    }
  }
  if (checking) {
    return (
      <main className="page narrow">
        <p className="muted">확인 중</p>
      </main>
    )
  }
  return (
    <main className="page narrow">
      <h1>현장 관리</h1>
      <form onSubmit={submit} className="card">
        <label htmlFor="k">관리자 키</label>
        <input id="k" type="password" value={k} onChange={(e) => setK(e.target.value)} autoComplete="current-password" />
        {err && <p className="alert">{err}</p>}
        <button className="btn primary big">들어가기</button>
      </form>
    </main>
  )
}

function LotRow({ lot, adminKey, onChanged }) {
  const [cap, setCap] = useState(lot.operableCapacity ?? '')
  const [err, setErr] = useState(null)
  const lv = LEVEL[lot.level] ?? LEVEL.UNKNOWN

  const send = async (body) => {
    setErr(null)
    try {
      onChanged(await api.admin.updateLot(adminKey, lot.code, body))
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <article className="admin-lot" id={`admin-lot-${lot.code}`}>
      <div className="lot-head">
        <h3>
          {lot.name}
          {lot.sensorEnabled && (
            <span className={`tag ${lot.sensorOnline ? 'on' : 'off'}`}>{lot.sensorOnline ? '센서 신호 있음' : '센서 신호 없음'}</span>
          )}
        </h3>
        <span className={`badge ${lv.cls}`}>{lv.word}</span>
      </div>
      <p className="remain-line">
        {lot.remaining != null ? (
          <>
            남은 자리 <strong>{lot.remaining}</strong>
            <small> / {lot.operableCapacity ?? lot.capacity}면</small>
          </>
        ) : (
          <small>면수를 몰라 남은 자리는 계산하지 않아요 (주차장 위치·추가 탭에서 면수 입력)</small>
        )}
      </p>
      <div className="counter">
        <button className="btn" onClick={() => send({ delta: -10 })}>−10</button>
        <button className="btn" onClick={() => send({ delta: -1 })}>−1</button>
        <div className="count">
          <strong>{lot.currentCount}</strong>
          <small>대 들어옴</small>
        </div>
        <button className="btn" onClick={() => send({ delta: 1 })}>+1</button>
        <button className="btn" onClick={() => send({ delta: 10 })}>+10</button>
      </div>
      <div className="seg" role="group" aria-label="상태">
        {STATUS.map(([k, label]) => (
          <button key={k} className={lot.manualStatus === k ? 'on' : ''} onClick={() => send({ manualStatus: k })}>
            {label}
          </button>
        ))}
      </div>
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault()
          send(cap === '' ? { clearOperableCapacity: true } : { operableCapacity: Number(cap) })
        }}
      >
        <label>
          운영 가능 면수(눈 등)
          <input type="number" min="0" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} placeholder={lot.capacity ?? '-'} />
        </label>
        <button className="btn">적용</button>
      </form>
      {err && <p className="alert">{err}</p>}
    </article>
  )
}

function LotsTab({ adminKey }) {
  const { data: lots, setData } = usePolling(api.lots, 5000)
  const onChanged = useCallback((v) => setData((ls) => ls.map((l) => (l.code === v.code ? v : l))), [setData])
  const [picked, setPicked] = useState(null)
  const sensorLot = lots?.find((l) => l.sensorEnabled)
  // 대수 변화와 관계없이 5초마다 다시 읽는다(입차·출차가 같은 간격에 들어와 대수가 그대로여도 기록이 보이게).
  const sensorCode = sensorLot?.code
  const { data: eventData } = usePolling(
    () => (sensorCode ? api.admin.events(adminKey, sensorCode) : Promise.resolve([])),
    5000,
    [adminKey, sensorCode],
  )
  const events = eventData ?? []
  const { data: sensorData } = usePolling(
    () => (sensorCode ? api.admin.sensors(adminKey, sensorCode) : Promise.resolve([])),
    5000,
    [adminKey, sensorCode],
  )
  const { data: summary } = usePolling(() => api.admin.summary(adminKey), 5000, [adminKey])
  const [msg, setMsg] = useState(null)

  return (
    <>
      <section className="card">
        <h2>주차장 지도</h2>
        <p className="muted">첫 화면과 같은 남은 자리예요. 5초마다 바뀌고, 핀을 누르면 그 주차장 조정 칸으로 가요.</p>
        <LotMap
          lots={lots}
          selected={picked}
          height={320}
          onSelect={(code) => {
            setPicked(code)
            document.getElementById(`admin-lot-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </section>
      {sensorLot && (
        <section className="card">
          <h2>센서 기록 · {sensorLot.name}</h2>
          {summary && (
            <div className="stats two">
              <div><b>{summary.entriesToday}</b>오늘 입차</div>
              <div><b>{summary.exitsToday}</b>오늘 출차</div>
            </div>
          )}
          <p>
            {(sensorData ?? []).map((d) => (
              <span key={d.deviceId} className={`tag ${d.online ? 'on' : 'off'}`}>
                {d.gate === 'ENTRY' ? '입구' : '출구'} {d.online ? '연결' : '끊김'}
              </span>
            ))}
          </p>
          <p className="muted">15분 안에 신호가 들어온 장치는 '연결'로 보여요.</p>
          <ul className="events">
            {events.slice(0, 8).map((e) => (
              <li key={`${e.deviceId}-${e.seq}`}>
                <b className={e.direction === 'IN' ? 'in' : 'out'}>{e.direction === 'IN' ? '입차' : '출차'}</b>
                {new Date(e.occurredAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })}
                <span className="muted"> {e.deviceId}</span>
              </li>
            ))}
            {events.length === 0 && <li className="muted">아직 기록이 없어요.</li>}
          </ul>
        </section>
      )}
      {lots?.map((l) => <LotRow key={l.code} lot={l} adminKey={adminKey} onChanged={onChanged} />)}

      <section className="card">
        <h2>시연 초기화</h2>
        <p className="muted">리허설 때 쌓인 센서 기록을 지우고, 평생학습관은 남은 자리 50, 위라리 둔치는 처음 값으로 돌려요.</p>
        {msg && <p className="alert info">{msg}</p>}
        <button
          className="btn big"
          onClick={async () => {
            if (!window.confirm('센서 기록을 모두 지울까요?')) return
            try {
              const r = await api.admin.demoReset(adminKey)
              setMsg(`초기화했어요. 센서 기록 ${r.deletedEvents}건 삭제`)
            } catch (err) {
              setMsg(err.message)
            }
          }}
        >
          시연 초기화
        </button>
      </section>
    </>
  )
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(readKey)
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab')
    return t === 'places' || t === 'edit' ? t : 'lots'
  })
  if (!adminKey) return <Login onLogin={setAdminKey} />
  return (
    <>
      <header className="top admin no-print">
        <div className="top-inner">
          <span className="brand">현장 관리</span>
          {adminKey !== 'open' && <button
            className="link"
            onClick={() => {
              try {
                sessionStorage.removeItem(KEY)
              } catch {
                /* 무시 */
              }
              setAdminKey('')
            }}
          >
            나가기
          </button>}
        </div>
        <nav className="tabs">
          {[
            ['lots', '주차장'],
            ['edit', '주차장 위치·추가'],
            ['places', '축제장 장소'],
          ].map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="page">
        {tab === 'lots' && <LotsTab adminKey={adminKey} />}
        {tab === 'edit' && <AdminLots adminKey={adminKey} />}
        {tab === 'places' && <AdminPlaces adminKey={adminKey} />}
      </main>
    </>
  )
}
