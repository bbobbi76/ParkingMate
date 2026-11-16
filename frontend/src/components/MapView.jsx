import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { FESTIVAL } from '../lib.js'
import { loadKakao } from './LotMap.jsx'

/**
 * 범용 지도. 카카오맵 키가 있으면 카카오맵, 없거나 실패하면 OpenStreetMap.
 * markers: [{ id, lat, lng, html, onClick?, z? }]  html 최상위 요소 1개, 위치 맞춤은 CSS(.pin transform)
 * line: [[lat, lng], ...] 노선 같은 선(선택)
 * onMapClick(lat, lng): 빈 곳을 누르면 호출(장소 추가용, 선택)
 * focus: { lat, lng } 이 위치로 이동(선택)
 * polygons: [{ id, path: [[lat, lng], ...], fill, stroke, opacity, weight, onClick? }] 구역(선택)
 */
export default function MapView({ markers, line, polygons, onMapClick, focus, height = 320, label = '지도', fitKey }) {
  const box = useRef(null)
  const map = useRef(null)
  const layer = useRef([])
  const lineRef = useRef(null)
  const polyRef = useRef([])
  const clickRef = useRef(onMapClick)
  clickRef.current = onMapClick
  const [engine, setEngine] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled) return
        const m = new kakao.maps.Map(box.current, { center: new kakao.maps.LatLng(FESTIVAL.lat, FESTIVAL.lng), level: 4 })
        m.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
        kakao.maps.event.addListener(m, 'click', (e) => clickRef.current?.(e.latLng.getLat(), e.latLng.getLng()))
        map.current = { kind: 'kakao', m, kakao }
        setEngine('kakao')
      })
      .catch(() => {
        if (cancelled) return
        const m = L.map(box.current, { zoomControl: true }).setView([FESTIVAL.lat, FESTIVAL.lng], 16)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m)
        m.on('click', (e) => clickRef.current?.(e.latlng.lat, e.latlng.lng))
        map.current = { kind: 'leaflet', m }
        setEngine('leaflet')
      })
    return () => {
      cancelled = true
      if (map.current?.kind === 'leaflet') map.current.m.remove()
      map.current = null
    }
  }, [])

  // 마커
  useEffect(() => {
    const mm = map.current
    if (!mm) return
    layer.current.forEach((x) => (mm.kind === 'kakao' ? x.setMap(null) : x.remove()))
    layer.current = []
    for (const mk of markers ?? []) {
      if (mm.kind === 'kakao') {
        const el = document.createElement('div')
        el.innerHTML = mk.html
        const node = el.firstChild
        if (mk.onClick) {
          node.addEventListener('click', (e) => {
            e.stopPropagation()
            mk.onClick()
          })
        }
        const o = new mm.kakao.maps.CustomOverlay({
          position: new mm.kakao.maps.LatLng(mk.lat, mk.lng),
          content: node,
          xAnchor: 0,
          yAnchor: 0,
          zIndex: mk.z ?? 2,
        })
        o.setMap(mm.m)
        layer.current.push(o)
      } else {
        const o = L.marker([mk.lat, mk.lng], {
          icon: L.divIcon({ html: mk.html, className: 'pin-wrap', iconSize: null, iconAnchor: [0, 0] }),
          zIndexOffset: (mk.z ?? 2) * 100,
        }).addTo(mm.m)
        if (mk.onClick) o.on('click', mk.onClick)
        layer.current.push(o)
      }
    }
  }, [markers, engine])

  // 선
  useEffect(() => {
    const mm = map.current
    if (!mm) return
    if (lineRef.current) {
      if (mm.kind === 'kakao') lineRef.current.setMap(null)
      else lineRef.current.remove()
      lineRef.current = null
    }
    if (!line || line.length < 2) return
    if (mm.kind === 'kakao') {
      lineRef.current = new mm.kakao.maps.Polyline({
        map: mm.m,
        path: line.map(([a, b]) => new mm.kakao.maps.LatLng(a, b)),
        strokeWeight: 4,
        strokeColor: '#14365c',
        strokeOpacity: 0.55,
        strokeStyle: 'shortdash',
      })
    } else {
      lineRef.current = L.polyline(line, { color: '#14365c', weight: 4, opacity: 0.55, dashArray: '6 6' }).addTo(mm.m)
    }
  }, [line, engine])

  // 구역(다각형): 마커보다 아래에 그린다
  useEffect(() => {
    const mm = map.current
    if (!mm) return
    polyRef.current.forEach((x) => (mm.kind === 'kakao' ? x.setMap(null) : x.remove()))
    polyRef.current = []
    for (const pg of polygons ?? []) {
      if (mm.kind === 'kakao') {
        const o = new mm.kakao.maps.Polygon({
          map: mm.m,
          path: pg.path.map(([a, b]) => new mm.kakao.maps.LatLng(a, b)),
          strokeWeight: pg.weight ?? 2,
          strokeColor: pg.stroke ?? pg.fill,
          strokeOpacity: 0.9,
          fillColor: pg.fill,
          fillOpacity: pg.opacity ?? 0.35,
          zIndex: 1,
        })
        if (pg.onClick) mm.kakao.maps.event.addListener(o, 'click', pg.onClick)
        polyRef.current.push(o)
      } else {
        const o = L.polygon(pg.path, {
          color: pg.stroke ?? pg.fill,
          weight: pg.weight ?? 2,
          fillColor: pg.fill,
          fillOpacity: pg.opacity ?? 0.35,
        }).addTo(mm.m)
        if (pg.onClick) o.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          pg.onClick()
        })
        polyRef.current.push(o)
      }
    }
  }, [polygons, engine])

  // 처음(또는 fitKey 가 바뀔 때) 모든 마커가 보이게
  const fitted = useRef(null)
  useEffect(() => {
    const mm = map.current
    if (!mm || !markers?.length || fitted.current === (fitKey ?? 'once')) return
    fitted.current = fitKey ?? 'once'
    const pts = markers.map((m) => [m.lat, m.lng])
    if (mm.kind === 'kakao') {
      const b = new mm.kakao.maps.LatLngBounds()
      pts.forEach(([a, c]) => b.extend(new mm.kakao.maps.LatLng(a, c)))
      mm.m.setBounds(b, 40, 40, 40, 40)
    } else {
      mm.m.fitBounds(pts, { padding: [36, 36] })
    }
  }, [markers, engine, fitKey])

  useEffect(() => {
    const mm = map.current
    if (!mm || !focus) return
    if (mm.kind === 'kakao') mm.m.panTo(new mm.kakao.maps.LatLng(focus.lat, focus.lng))
    else mm.m.panTo([focus.lat, focus.lng])
  }, [focus, engine])

  return <div ref={box} className="map" style={{ height }} role="img" aria-label={label} />
}

/** HTML 문자열에 넣을 글자 이스케이프 (관리 화면에서 직원이 입력한 이름이 들어가므로). */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
