import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { LEVEL, usePolling } from '../lib.js'
import QrImage from '../components/QrImage.jsx'

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
    <article className="admin-lot">
      <div className="lot-head">
        <h3>
          {lot.name}
          {lot.incentive && <span className="tag">이용권</span>}
          {lot.sensorEnabled && (
            <span className={`tag ${lot.sensorOnline ? 'on' : 'off'}`}>{lot.sensorOnline ? '센서 연결' : '센서 끊김'}</span>
          )}
        </h3>
        <span className={`badge ${lv.cls}`}>{lv.word}</span>
      </div>
      <div className="counter">
        <button className="btn" onClick={() => send({ delta: -10 })}>−10</button>
        <button className="btn" onClick={() => send({ delta: -1 })}>−1</button>
        <div className="count">
          <strong>{lot.currentCount}</strong>
          <small>{lot.capacity != null ? ` / ${lot.operableCapacity ?? lot.capacity}대` : '대 (면수 미확인)'}</small>
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
  const sensorLot = lots?.find((l) => l.sensorEnabled)
  const [events, setEvents] = useState([])
  useEffect(() => {
    if (!sensorLot) return
    api.admin.events(adminKey, sensorLot.code).then(setEvents).catch(() => {})
  }, [adminKey, sensorLot?.currentCount, sensorLot?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {sensorLot && (
        <section className="card">
          <h2>센서 기록 · {sensorLot.name}</h2>
          <ul className="events">
            {events.slice(0, 8).map((e) => (
              <li key={`${e.deviceId}-${e.seq}`}>
                <b className={e.direction === 'IN' ? 'in' : 'out'}>{e.direction === 'IN' ? '입차' : '출차'}</b>
                {new Date(e.occurredAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })}
                <span className="muted"> {e.deviceId}</span>
                {e.voucherLinked && <span className="tag">이용권 발급</span>}
              </li>
            ))}
            {events.length === 0 && <li className="muted">아직 기록이 없어요.</li>}
          </ul>
        </section>
      )}
      {lots?.map((l) => <LotRow key={l.code} lot={l} adminKey={adminKey} onChanged={onChanged} />)}
    </>
  )
}

function VoucherTab({ adminKey }) {
  const [q, setQ] = useState('')
  const [v, setV] = useState(null)
  const [msg, setMsg] = useState(null)
  const [lots, setLots] = useState([])
  const [issueLot, setIssueLot] = useState('')
  const [plate, setPlate] = useState('')
  const { data: summary } = usePolling(() => api.admin.summary(adminKey), 5000, [adminKey])

  useEffect(() => {
    api.lots().then((ls) => {
      const g = ls.filter((l) => l.incentive)
      setLots(g)
      setIssueLot(g[0]?.code ?? '')
    })
  }, [])

  const find = async (e) => {
    e.preventDefault()
    setMsg(null)
    setV(null)
    const s = q.trim()
    try {
      setV(/^[A-Za-z0-9]{6}$/.test(s) ? await api.voucher(s) : await api.admin.findByPlate(adminKey, s))
    } catch (err) {
      setMsg(err.message)
    }
  }
  const redeem = async () => {
    try {
      setV(await api.admin.redeem(adminKey, v.code))
      setMsg('사용 처리했어요.')
    } catch (err) {
      setMsg(err.message)
    }
  }
  const issue = async (e) => {
    e.preventDefault()
    setMsg(null)
    try {
      const nv = await api.admin.issue(adminKey, issueLot, plate)
      setV(nv)
      setPlate('')
      setMsg(`발급했어요. 번호 ${nv.code}를 적어 드리세요.`)
    } catch (err) {
      setMsg(err.message)
    }
  }

  return (
    <>
      {summary && (
        <section className="stats">
          <div><b>{summary.issued}</b>오늘 발급</div>
          <div><b>{summary.redeemed}</b>사용</div>
          <div><b>{summary.entriesToday}</b>센서 입차</div>
          <div><b>{summary.exitsToday}</b>센서 출차</div>
        </section>
      )}

      <form className="card" onSubmit={find}>
        <h2>이용권 확인 (안내소)</h2>
        <label htmlFor="q">이용권 번호 6자리 또는 차량번호</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="예) K7M2QX 또는 12가3456" />
        <button className="btn primary big">찾기</button>
      </form>

      {msg && <p className="alert info">{msg}</p>}

      {v && (
        <section className={`card voucher-mini${v.status === 'REDEEMED' ? ' used' : ''}`}>
          <p className="voucher-code small">{v.code}</p>
          <p>
            {v.plateNumber} · {v.lotName} · {v.channel === 'STAFF' ? '직원 발급' : '본인 발급'}
            {v.sensorVerified && ' · 센서 입차 확인'}
          </p>
          <p>
            상태: <strong>{v.status === 'REDEEMED' ? '사용 완료' : v.status === 'ISSUED' ? '사용 가능' : '취소'}</strong>
          </p>
          {v.status === 'ISSUED' && (
            <button className="btn primary big" onClick={redeem}>사용 처리</button>
          )}
        </section>
      )}

      <section className="card">
        <h2>시연 초기화</h2>
        <p className="muted">리허설에서 발급한 이용권과 센서 기록을 지웁니다. 같은 차량번호로 다시 시연할 수 있어요.</p>
        <button
          className="btn big"
          onClick={async () => {
            if (!window.confirm('이용권과 센서 기록을 모두 지울까요?')) return
            try {
              const r = await api.admin.demoReset(adminKey)
              setV(null)
              setMsg(`초기화했어요. 이용권 ${r.deletedVouchers}장, 센서 기록 ${r.deletedEvents}건 삭제`)
            } catch (err) {
              setMsg(err.message)
            }
          }}
        >
          시연 초기화
        </button>
      </section>

      <form className="card" onSubmit={issue}>
        <h2>직원 대리 발급</h2>
        <p className="muted">휴대폰 사용이 어려운 분께 차량번호로 발급해 드려요.</p>
        <label htmlFor="il">주차장</label>
        <select id="il" value={issueLot} onChange={(e) => setIssueLot(e.target.value)}>
          {lots.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
        <label htmlFor="ip">차량번호</label>
        <input id="ip" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="예) 12가 3456" />
        <button className="btn primary big">발급</button>
      </form>
    </>
  )
}

function PostersTab() {
  const [lots, setLots] = useState([])
  useEffect(() => {
    api.lots().then((ls) => setLots(ls.filter((l) => l.incentive)))
  }, [])
  const origin = window.location.origin
  return (
    <>
      <p className="muted no-print">
        주차장 입구에 붙일 안내판입니다. 인쇄 버튼을 누르면 A4 한 장에 한 곳씩 나옵니다.
      </p>
      <button className="btn primary no-print" onClick={() => window.print()}>인쇄</button>
      {lots.map((l) => (
        <section className="poster" key={l.code}>
          <p className="poster-top">이 주차장에 대신 분께</p>
          <h1>무료이용권을 드립니다</h1>
          <QrImage text={`${origin}/p/${l.code}`} size={300} label={`${l.name} QR`} />
          <ol>
            <li>휴대폰 카메라로 QR을 찍으세요</li>
            <li>차량번호를 넣으세요</li>
            <li>축제장 안내소에서 화면을 보여 주세요</li>
          </ol>
          <p className="poster-lot">{l.name}</p>
          <p className="poster-help">휴대폰이 어려우시면 주차 안내 직원에게 말씀해 주세요.</p>
        </section>
      ))}
    </>
  )
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(readKey)
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab')
    return ['lots', 'vouchers', 'posters'].includes(t) ? t : 'lots'
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
            ['vouchers', '이용권'],
            ['posters', 'QR 안내판'],
          ].map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="page">
        {tab === 'lots' && <LotsTab adminKey={adminKey} />}
        {tab === 'vouchers' && <VoucherTab adminKey={adminKey} />}
        {tab === 'posters' && <PostersTab />}
      </main>
    </>
  )
}
