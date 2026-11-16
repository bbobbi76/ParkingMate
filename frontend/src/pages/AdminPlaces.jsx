import { useMemo, useState } from 'react'
import { api } from '../api.js'
import { PLACE_CATEGORY, usePolling } from '../lib.js'
import MapView, { esc } from '../components/MapView.jsx'

const EMPTY = { name: '', category: 'ETC', description: '', fee: '', lat: null, lng: null }

/** 현장 관리: 축제장 장소(지도 핀) 추가·수정·삭제. 지도를 눌러 위치를 정한다. */
export default function AdminPlaces({ adminKey }) {
  const { data: places, setData } = usePolling(api.places, 30000)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const markers = useMemo(() => {
    const list = (places ?? []).map((p) => {
      const c = PLACE_CATEGORY[p.category] ?? PLACE_CATEGORY.ETC
      const sel = p.id === editId
      return {
        id: p.id,
        lat: sel && form.lat != null ? form.lat : p.lat,
        lng: sel && form.lng != null ? form.lng : p.lng,
        html: sel
          ? `<div class="pin place sel"><span>${esc(p.name)}</span></div>`
          : `<div class="dot-pin ${c.cls}" title="${esc(p.name)}"></div>`,
        z: sel ? 10 : 2,
        onClick: () => startEdit(p),
      }
    })
    if (editId == null && form.lat != null) {
      list.push({ id: 'new', lat: form.lat, lng: form.lng, html: `<div class="pin place sel"><span>${esc(form.name || '새 장소')}</span></div>`, z: 11 })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, editId, form.lat, form.lng, form.name])

  function startEdit(p) {
    setEditId(p.id)
    setForm({ name: p.name, category: p.category, description: p.description ?? '', fee: p.fee ?? '', lat: null, lng: null })
    setMsg(null)
  }
  function reset() {
    setEditId(null)
    setForm(EMPTY)
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const body = { name: form.name, category: form.category, description: form.description, fee: form.fee }
      if (form.lat != null) Object.assign(body, { lat: form.lat, lng: form.lng })
      if (editId == null) {
        if (form.lat == null) throw new Error('지도를 눌러 위치를 먼저 정해 주세요.')
        const p = await api.admin.addPlace(adminKey, body)
        setData((ls) => [...(ls ?? []), p])
        setMsg(`「${p.name}」를 추가했어요.`)
      } else {
        const p = await api.admin.updatePlace(adminKey, editId, body)
        setData((ls) => ls.map((x) => (x.id === p.id ? p : x)))
        setMsg(`「${p.name}」를 고쳤어요.`)
      }
      reset()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const p = places.find((x) => x.id === editId)
    if (!p || !window.confirm(`「${p.name}」를 지도에서 지울까요?`)) return
    try {
      await api.admin.deletePlace(adminKey, editId)
      setData((ls) => ls.filter((x) => x.id !== editId))
      setMsg(`「${p.name}」를 지웠어요.`)
      reset()
    } catch (err) {
      setMsg(err.message)
    }
  }

  return (
    <>
      <section className="card">
        <h2>{editId == null ? '새 장소 추가' : '장소 고치기'}</h2>
        <p className="muted">
          {editId == null
            ? '지도에서 위치를 누른 뒤 이름과 종류를 넣으세요. 기존 핀을 누르면 고칠 수 있어요.'
            : '위치를 옮기려면 지도에서 새 위치를 누르세요.'}
        </p>
        <MapView
          markers={markers}
          onMapClick={(lat, lng) => setForm((f) => ({ ...f, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }))}
          height={320}
          label="장소 위치 고르기"
        />
        <form onSubmit={save}>
          <p className="fine">
            {form.lat != null ? `선택한 위치: ${form.lat}, ${form.lng}` : editId == null ? '아직 위치를 고르지 않았어요.' : '위치는 그대로 둬요.'}
          </p>
          <label htmlFor="pn">이름</label>
          <input id="pn" value={form.name} onChange={set('name')} maxLength={60} required placeholder="예) 임시 화장실" />
          <label htmlFor="pc">종류</label>
          <select id="pc" value={form.category} onChange={set('category')}>
            {Object.entries(PLACE_CATEGORY).map(([k, v]) => (
              <option key={k} value={k}>{v.word}</option>
            ))}
          </select>
          <label htmlFor="pd">설명</label>
          <input id="pd" value={form.description} onChange={set('description')} maxLength={300} placeholder="무엇을 할 수 있는 곳인지" />
          <label htmlFor="pf">이용료 (없으면 비움)</label>
          <input id="pf" value={form.fee} onChange={set('fee')} maxLength={200} placeholder="예) 5,000원" />
          {msg && <p className="alert info">{msg}</p>}
          <button className="btn primary big" disabled={busy}>{editId == null ? '추가' : '저장'}</button>
          {editId != null && (
            <div className="row">
              <button type="button" className="btn ghost" onClick={reset}>취소</button>
              <button type="button" className="btn danger" onClick={remove}>지우기</button>
            </div>
          )}
        </form>
      </section>

      <section className="card">
        <h2>등록된 장소 {places ? `${places.length}곳` : ''}</h2>
        <ul className="place-list">
          {(places ?? []).map((p) => {
            const c = PLACE_CATEGORY[p.category] ?? PLACE_CATEGORY.ETC
            return (
              <li key={p.id} className={p.id === editId ? 'selected' : ''}>
                <button className="place-main" onClick={() => startEdit(p)}>
                  <span className={`cat ${c.cls}`}>{c.word}</span>
                  <strong>{p.name}</strong>
                  <span className="fee">{p.coordSource}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
