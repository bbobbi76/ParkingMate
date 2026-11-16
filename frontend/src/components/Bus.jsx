/** 셔틀버스 모양 (앞에서 본 버스). 지도 마커용 문자열과 화면용 컴포넌트가 같은 그림을 쓴다. */
const PATH = `
<rect x="3" y="2" width="22" height="20" rx="4" fill="currentColor"/>
<rect x="6" y="5" width="16" height="7" rx="1.5" fill="#fff"/>
<rect x="6" y="14" width="4" height="3" rx="1" fill="#ffd34d"/>
<rect x="18" y="14" width="4" height="3" rx="1" fill="#ffd34d"/>
<rect x="5" y="21" width="5" height="4" rx="1.5" fill="currentColor"/>
<rect x="18" y="21" width="5" height="4" rx="1.5" fill="currentColor"/>`

export function busSvg(size = 26, color = '#14365c') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 28 26" style="color:${color}" aria-hidden="true">${PATH}</svg>`
}

export function BusIcon({ size = 26, color = '#14365c' }) {
  return <span className="bus-icon" aria-hidden dangerouslySetInnerHTML={{ __html: busSvg(size, color) }} />
}
