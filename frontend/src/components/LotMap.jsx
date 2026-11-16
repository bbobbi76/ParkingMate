import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { FESTIVAL, LEVEL } from '../lib.js'

const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY

export function shortName(name) {
  return name.replace(/ ?(임시)?주차장$/, '').replace(/ 캠핑카·카라반$/, '')
}

function markerHtml(lot, selected, mode) {
  const lv = LEVEL[lot.level] ?? LEVEL.UNKNOWN
  const cls = `pin ${lv.cls}${selected ? ' sel' : ''}`
  // 관리 화면: 모든 주차장에 지금 차량 수를 크게 (오르내림을 바로 보도록)
  if (mode === 'count') {
    // 시내에 몰려 있어 숫자만 작게, 고른 곳만 이름까지
    if (!selected) return `<div class="${cls} cnt" title="${shortName(lot.name)} ${lot.currentCount}대"><b>${lot.currentCount}</b></div>`
    return `<div class="${cls}"><b>${lot.currentCount}대</b><span>${shortName(lot.name)}</span></div>`
  }
  // 남은 자리 숫자를 아는 곳과 선택한 곳만 크게. 나머지는 상태색 테두리의 작은 이름표 (시내에 몰려 있어 겹침 방지)
  if (lot.remaining == null && !selected) {
    return `<div class="${cls} slim" title="${lot.name} ${lv.word}"><span>${shortName(lot.name)}</span></div>`
  }
  const label = lot.remaining != null && lot.level !== 'CLOSED' ? `${lot.remaining}` : lv.word
  return `<div class="${cls}"><b>${label}</b><span>${shortName(lot.name)}</span></div>`
}

const festivalHtml = `<div class="pin festival"><b>축제장</b></div>`

let kakaoPromise
export function loadKakao() {
  if (!KAKAO_KEY) return Promise.reject(new Error('no key'))
  kakaoPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    s.onerror = reject
    document.head.appendChild(s)
  })
  return kakaoPromise
}

/** 카카오맵 키가 있으면 카카오맵, 없거나 실패하면 OpenStreetMap. */
export default function LotMap({ lots, selected, onSelect, height = 340, mode }) {
  const box = useRef(null)
  const map = useRef(null)
  const layer = useRef([])
  const [engine, setEngine] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled) return
        const m = new kakao.maps.Map(box.current, {
          center: new kakao.maps.LatLng(FESTIVAL.lat, FESTIVAL.lng),
          level: 5,
        })
        m.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
        map.current = { kind: 'kakao', m, kakao }
        setEngine('kakao')
      })
      .catch(() => {
        if (cancelled) return
        const m = L.map(box.current, { zoomControl: true }).setView([FESTIVAL.lat, FESTIVAL.lng], 15)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(m)
        map.current = { kind: 'leaflet', m }
        setEngine('leaflet')
      })
    return () => {
      cancelled = true
      if (map.current?.kind === 'leaflet') map.current.m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const mm = map.current
    if (!mm || !lots) return
    layer.current.forEach((x) => (mm.kind === 'kakao' ? x.setMap(null) : x.remove()))
    layer.current = []

    const add = (lat, lng, html, onClick, z) => {
      if (mm.kind === 'kakao') {
        const el = document.createElement('div')
        el.innerHTML = html
        if (onClick) el.firstChild.addEventListener('click', onClick)
        const o = new mm.kakao.maps.CustomOverlay({
          position: new mm.kakao.maps.LatLng(lat, lng),
          content: el.firstChild,
          // 위치 맞춤은 CSS(.pin transform)가 한다 → 카카오 기준점은 왼쪽 위로
          xAnchor: 0,
          yAnchor: 0,
          zIndex: z,
        })
        o.setMap(mm.m)
        layer.current.push(o)
      } else {
        const mk = L.marker([lat, lng], {
          icon: L.divIcon({ html, className: 'pin-wrap', iconSize: null, iconAnchor: [0, 0] }),
          zIndexOffset: z * 100,
        }).addTo(mm.m)
        if (onClick) mk.on('click', onClick)
        layer.current.push(mk)
      }
    }

    add(FESTIVAL.lat, FESTIVAL.lng, festivalHtml, null, 1)
    lots.forEach((lot) =>
      add(lot.lat, lot.lng, markerHtml(lot, lot.code === selected, mode), () => onSelect?.(lot.code), lot.code === selected ? 10 : 2),
    )
  }, [lots, selected, engine, onSelect])

  // 처음 한 번: 모든 주차장이 보이도록 맞춤
  const fitted = useRef(false)
  useEffect(() => {
    const mm = map.current
    if (!mm || !lots?.length || fitted.current) return
    fitted.current = true
    const pts = [...lots.map((l) => [l.lat, l.lng]), [FESTIVAL.lat, FESTIVAL.lng]]
    if (mm.kind === 'kakao') {
      const b = new mm.kakao.maps.LatLngBounds()
      pts.forEach(([a, c]) => b.extend(new mm.kakao.maps.LatLng(a, c)))
      mm.m.setBounds(b, 40, 40, 40, 40)
    } else {
      mm.m.fitBounds(pts, { padding: [36, 36] })
    }
  }, [lots, engine])

  useEffect(() => {
    const mm = map.current
    const lot = lots?.find((l) => l.code === selected)
    if (!mm || !lot) return
    if (mm.kind === 'kakao') mm.m.panTo(new mm.kakao.maps.LatLng(lot.lat, lot.lng))
    else mm.m.panTo([lot.lat, lot.lng])
  }, [selected, lots, engine])

  return <div ref={box} className="map" style={{ height }} role="img" aria-label="임시주차장 지도" />
}
