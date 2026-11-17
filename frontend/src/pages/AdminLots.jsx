import { useMemo, useState } from 'react'
import { api } from '../api.js'
import { LEVEL, usePolling } from '../lib.js'
import MapView, { esc } from '../components/MapView.jsx'
import { shortName } from '../components/LotMap.jsx'

export const LOT_CATEGORY = {
  NEAR: '축제장 가까운 곳',
  SHUTTLE: '셔틀 타는 곳',
  REMOTE: '먼 주차장(이용권 안내)',
  ACCESSIBLE: '장애인·교통약자',
  CAMPING: '캠핑카·카라반',
}

const EMPTY = { name: '', category: 'NEAR', capacity: '', shuttleStop: '', lat: null, lng: null }

/** 현장 관리: 주차장 추가, 이름·면수·위치 고치기. 지도를 눌러 P 위치를 정한다. */
export default function AdminLots({ adminKey }) {
  const { data: lots, setData } = usePolling(api.lots, 30000)
  const [form, setForm] = useState(EMPTY)
  const [editCode, setEditCode] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const markers = useMemo(() => {
    const list = (lots ?? []).map((l) => {
      const sel = l.code === editCode
      const lv = LEVEL[l.level] ?? LEVEL.UNKNOWN
      return {
        id: l.code,
        lat: sel && form.lat != null ? form.lat : l.lat,
        lng: sel && form.lng != null ? form.lng : l.lng,
        html: `<div class="pin ${lv.cls}${sel ? ' sel' : ' slim'}"><span>${esc(shortName(l.name))}</span></div>`,
        z: sel ? 10 : 2,
        onClick: () => startEdit(l),
      }
    })
    if (editCode == null && form.lat != null) {
      list.push({ id: 'new', lat: form.lat, lng: form.lng, html: `<div class="pin ok sel"><span>${esc(form.name || '새 주차장')}</span></div>`, z: 11 })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, editCode, form.lat, form.lng, form.name])

  function startEdit(l) {
    setEditCode(l.code)
    setForm({ name: l.name, category: l.category, capacity: l.capacity ?? '', shuttleStop: l.shuttleStop ?? '', lat: null, lng: null })
    setMsg(null)
  }
  function reset() {
    setEditCode(null)
    setForm(EMPTY)
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const body = { name: form.name, category: form.category, shuttleStop: form.shuttleStop }
      if (form.capacity !== '') body.capacity = Number(form.capacity)
      if (form.lat != null) Object.assign(body, { lat: form.lat, lng: form.lng })
      if (editCode == null) {
        if (form.lat == null) throw new Error('지도를 눌러 주차장 위치를 먼저 정해 주세요.')
        const l = await api.admin.addLot(adminKey, body)
        setData((ls) => [...(ls ?? []), l])
        setMsg(`「${l.name}」를 추가했어요. 첫 화면 목록과 지도에 바로 나와요.`)
      } else {
        if (form.capacity === '') body.clearCapacity = true
        const l = await api.admin.updateLot(adminKey, editCode, body)
        setData((ls) => ls.map((x) => (x.code === l.code ? l : x)))
        setMsg(`「${l.name}」를 고쳤어요.`)
      }
      reset()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="card">
        <h2>{editCode == null ? '새 주차장 추가' : '주차장 고치기'}</h2>
        <p className="muted">
          {editCode == null
            ? '지도에서 주차장(P) 자리를 누르고 이름과 면수를 적어 주세요. 이미 있는 주차장을 누르면 고칠 수 있어요.'
            : '위치를 옮기려면 지도에서 주차장 자리를 눌러 주세요.'}
        </p>
        <MapView
          markers={markers}
          onMapClick={(lat, lng) => setForm((f) => ({ ...f, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }))}
          height={360}
          label="주차장 위치 고르기"
        />
        <form onSubmit={save}>
          <p className="fine">
            {form.lat != null ? `선택한 위치: ${form.lat}, ${form.lng}` : editCode == null ? '아직 위치를 고르지 않았어요.' : '위치는 그대로 둬요.'}
          </p>
          <label htmlFor="ln">이름</label>
          <input id="ln" value={form.name} onChange={set('name')} maxLength={60} required placeholder="예) 화천평생학습관 주차장" />
          <label htmlFor="lc">종류</label>
          <select id="lc" value={form.category} onChange={set('category')}>
            {Object.entries(LOT_CATEGORY).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label htmlFor="lcap">전체 면수 (모르면 비움)</label>
          <input id="lcap" type="number" min="0" max="5000" inputMode="numeric" value={form.capacity} onChange={set('capacity')} placeholder="예) 50" />
          <label htmlFor="ls">가까운 셔틀 정류장 (없으면 비움)</label>
          <input id="ls" value={form.shuttleStop} onChange={set('shuttleStop')} maxLength={60} placeholder="예) 화천체육관" />
          {msg && <p className="alert info">{msg}</p>}
          <button className="btn primary big" disabled={busy}>{editCode == null ? '추가' : '저장'}</button>
          {editCode != null && (
            <div className="row">
              <button type="button" className="btn ghost" onClick={reset}>취소</button>
            </div>
          )}
        </form>
      </section>

      <section className="card">
        <h2>등록된 주차장 {lots ? `${lots.length}곳` : ''}</h2>
        <ul className="place-list">
          {(lots ?? []).map((l) => (
            <li key={l.code} className={l.code === editCode ? 'selected' : ''}>
              <button className="place-main" onClick={() => startEdit(l)}>
                <span className="cat c-info">{l.capacity != null ? `${l.capacity}면` : '면수 미확인'}</span>
                <strong>{l.name}</strong>
                <span className="fee">{l.coordSource}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
