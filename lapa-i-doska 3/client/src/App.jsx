import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { useCart } from './cart.jsx';
import { HOME_BY_ROLE, ROLE } from './format.js';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import Checkout from './pages/Checkout.jsx';
import { OrderList, OrderDetail } from './pages/Orders.jsx';
import Admin from './pages/Admin.jsx';

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Загрузка…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}

function Header() {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const nav = useNavigate();
  return (
    <header className="header">
      <Link to="/" className="logo">🐾 Лапа и доска</Link>
      <nav>
        <NavLink to="/">Каталог</NavLink>
        {user?.role === 'CLIENT' && <NavLink to="/checkout">Корзина{items.length ? ` (${items.length})` : ''}</NavLink>}
        {user && <NavLink to={HOME_BY_ROLE[user.role]}>{user.role === 'ADMIN' ? 'Админка' : 'Заказы'}</NavLink>}
      </nav>
      <div className="who">
        {user ? (
          <>
            <span>{user.fullName} · {ROLE[user.role]}</span>
            <button className="btn small ghost" onClick={() => { logout(); nav('/'); }}>Выйти</button>
          </>
        ) : (
          <>
            <Link className="btn small ghost" to="/login">Войти</Link>
            <Link className="btn small" to="/register">Регистрация</Link>
          </>
        )}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/products/:id" element={<Product />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/checkout" element={<Guard roles={['CLIENT']}><Checkout /></Guard>} />

          <Route path="/cabinet" element={<Guard roles={['CLIENT']}><OrderList title="Мои заказы" base="/cabinet" /></Guard>} />
          <Route path="/cabinet/orders/:id" element={<Guard roles={['CLIENT']}><OrderDetail back="/cabinet" /></Guard>} />

          <Route path="/manager" element={<Guard roles={['MANAGER']}><OrderList title="Заказы" base="/manager" filter /></Guard>} />
          <Route path="/manager/orders/:id" element={<Guard roles={['MANAGER']}><OrderDetail back="/manager" /></Guard>} />

          <Route path="/master" element={<Guard roles={['MASTER']}><OrderList title="Мои заказы в цехе" base="/master" /></Guard>} />
          <Route path="/master/orders/:id" element={<Guard roles={['MASTER']}><OrderDetail back="/master" /></Guard>} />

          <Route path="/admin/*" element={<Guard roles={['ADMIN']}><Admin /></Guard>} />
          <Route path="*" element={<p>Страница не найдена. <Link to="/">В каталог</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
