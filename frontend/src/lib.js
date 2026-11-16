import { useEffect, useRef, useState } from 'react'

/** 산천어축제 얼음낚시터(화천천) 대략 위치. 걷는 시간 추정 기준점. */
export const FESTIVAL = { name: '산천어축제장', lat: 38.106, lng: 127.7105 }

export const LEVEL = {
  AVAILABLE: { word: '여유', cls: 'ok' },
  BUSY: { word: '혼잡', cls: 'busy' },
  FULL: { word: '만차', cls: 'full' },
  CLOSED: { word: '운영 안 함', cls: 'closed' },
  UNKNOWN: { word: '확인 중', cls: 'unknown' },
}

export function distanceMeters(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 직선거리 × 1.3(도로 우회) ÷ 분당 65m(천천히 걷는 속도). */
export function walkMinutesBetween(a, b) {
  return Math.max(1, Math.round((distanceMeters(a, b) * 1.3) / 65))
}

/** 주차장 → 축제장 걸어서 */
export function walkMinutes(lot) {
  return walkMinutesBetween(lot, FESTIVAL)
}

/** 카카오맵 길찾기: 지금 내 위치 → 목적지 (휴대폰에 카카오맵 앱이 있으면 앱으로 열림). */
export function kakaoDirections(place) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`
}

/** 축제장 장소 분류: 지도 핀 색(cls)과 화면 이름. */
export const PLACE_CATEGORY = {
  FISHING: { word: '낚시', cls: 'c-fish' },
  SNOW: { word: '눈·얼음 체험', cls: 'c-snow' },
  CULTURE: { word: '볼거리', cls: 'c-culture' },
  FOOD: { word: '먹거리', cls: 'c-food' },
  INFO: { word: '안내·접수', cls: 'c-info' },
  ETC: { word: '기타', cls: 'c-etc' },
}

export function hhmm(t) {
  return t ? t.slice(0, 5) : ''
}

/** 주기적으로 데이터를 다시 불러온다. 화면이 숨겨져 있으면 쉰다. */
export function usePolling(load, ms, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    let alive = true
    const run = () => {
      if (document.hidden) return
      loadRef.current()
        .then((d) => alive && (setData(d), setError(null)))
        .catch((e) => alive && setError(e))
    }
    run()
    const id = setInterval(run, ms)
    document.addEventListener('visibilitychange', run)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, error, setData }
}
