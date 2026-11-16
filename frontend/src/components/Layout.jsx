import { Link, NavLink } from 'react-router-dom'

export default function Layout({ children, back }) {
  return (
    <>
      <header className="top">
        <div className="top-inner">
          {back ? (
            <Link to={back} className="back" aria-label="뒤로">
              ‹
            </Link>
          ) : null}
          <Link to="/" className="brand">
            산천어축제 안내
          </Link>
        </div>
        <nav className="tabs" aria-label="메뉴">
          <NavLink to="/" end>주차장</NavLink>
          <NavLink to="/shuttle">셔틀버스</NavLink>
          <NavLink to="/festival">축제장</NavLink>
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer className="foot">
        <p>
          축제 종합안내 <a href="tel:1588-3005">1588-3005</a>
        </p>
        <p className="fine">주차장 위치 · 셔틀 노선: 2026 축제 운영 기준 / 면수 · 정류장별 시각 일부 확인 중</p>
      </footer>
    </>
  )
}
