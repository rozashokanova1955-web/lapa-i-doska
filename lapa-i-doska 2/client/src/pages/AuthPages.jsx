import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { HOME_BY_ROLE } from '../format.js';

function useForm(initial, action) {
  const nav = useNavigate();
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { const u = await action(f); nav(HOME_BY_ROLE[u.role], { replace: true }); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };
  return { f, set, err, busy, submit };
}

export function Login() {
  const { user, login } = useAuth();
  const { f, set, err, busy, submit } = useForm({ email: '', password: '' }, (v) => login(v.email, v.password));
  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return (
    <form className="panel narrow" onSubmit={submit}>
      <h2>Вход</h2>
      <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></label>
      <label>Пароль<input type="password" required autoComplete="current-password" value={f.password} onChange={set('password')} /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
      <p className="muted">Нет аккаунта? <Link to="/register">Регистрация</Link></p>
    </form>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const { f, set, err, busy, submit } = useForm({ fullName: '', email: '', phone: '', password: '' }, (v) => register(v));
  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return (
    <form className="panel narrow" onSubmit={submit}>
      <h2>Регистрация клиента</h2>
      <label>Ваше имя<input required minLength={2} maxLength={120} autoComplete="name" value={f.fullName} onChange={set('fullName')} /></label>
      <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></label>
      <label>Телефон<input type="tel" placeholder="+7 7xx xxx xx xx" autoComplete="tel" value={f.phone} onChange={set('phone')} /></label>
      <label>Пароль (минимум 8 символов)<input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Создаём…' : 'Зарегистрироваться'}</button>
      <p className="muted">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
    </form>
  );
}
