import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ROLE, STATUS, money } from '../format.js';

const TABS = [['products', 'Изделия'], ['materials', 'Материалы'], ['options', 'Опции'], ['users', 'Пользователи'], ['stats', 'Статистика']];

export default function Admin() {
  return (
    <>
      <h1>Админка</h1>
      <nav className="tabs">{TABS.map(([p, t]) => <NavLink key={p} to={`/admin/${p}`}>{t}</NavLink>)}</nav>
      <Routes>
        <Route index element={<Navigate to="products" replace />} />
        <Route path="products" element={<Dictionary kind="products" fields={PRODUCT_FIELDS} blank={PRODUCT_BLANK} summary={(i) => `${i.category} · от ${money(i.basePrice)}`} />} />
        <Route path="materials" element={<Dictionary kind="materials" fields={MATERIAL_FIELDS} blank={{ name: '', coefficientPercent: 100 }} summary={(i) => `коэффициент ${i.coefficientPercent} %`} />} />
        <Route path="options" element={<Dictionary kind="options" fields={OPTION_FIELDS} blank={{ name: '', extraPrice: 0 }} summary={(i) => `+${money(i.extraPrice)}`} />} />
        <Route path="users" element={<Users />} />
        <Route path="stats" element={<Stats />} />
      </Routes>
    </>
  );
}

const PRODUCT_BLANK = {
  name: '', description: '', category: '', basePrice: 10000, baseVolumeL: 50, pricePerLiter: 100,
  minWidth: 30, maxWidth: 100, minDepth: 30, maxDepth: 100, minHeight: 30, maxHeight: 100,
};
const PRODUCT_FIELDS = [
  ['name', 'Название'], ['category', 'Категория'], ['description', 'Описание', 'text'],
  ['basePrice', 'Базовая цена, ₸', 'number'], ['baseVolumeL', 'Базовый объём, л', 'number'], ['pricePerLiter', 'Цена за доп. литр, ₸', 'number'],
  ['minWidth', 'Ширина от, см', 'number'], ['maxWidth', 'Ширина до, см', 'number'],
  ['minDepth', 'Глубина от, см', 'number'], ['maxDepth', 'Глубина до, см', 'number'],
  ['minHeight', 'Высота от, см', 'number'], ['maxHeight', 'Высота до, см', 'number'],
];
const MATERIAL_FIELDS = [['name', 'Название'], ['coefficientPercent', 'Коэффициент цены, % (100 = без наценки)', 'number']];
const OPTION_FIELDS = [['name', 'Название'], ['extraPrice', 'Доплата, ₸', 'number']];

// Универсальный редактор справочника. Удаления нет — только архив (БП-2).
function Dictionary({ kind, fields, blank, summary }) {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null); // { id?, ...значения }
  const [err, setErr] = useState('');

  const load = useCallback(() => api.get(`/admin/${kind}`).then((d) => setItems(d.items)).catch((e) => setErr(e.message)), [kind]);
  useEffect(() => { setItems(null); setForm(null); load(); }, [load]);

  const save = async (e) => {
    e.preventDefault(); setErr('');
    const { id, isArchived, ...data } = form; // eslint-disable-line no-unused-vars
    try {
      if (id) await api.put(`/admin/${kind}/${id}`, data); else await api.post(`/admin/${kind}`, data);
      setForm(null); load();
    } catch (ex) { setErr(ex.message); }
  };
  const archive = async (i) => {
    try { await api.patch(`/admin/${kind}/${i.id}/archive`, { isArchived: !i.isArchived }); load(); } catch (ex) { setErr(ex.message); }
  };

  return (
    <>
      {err && <p className="error" role="alert">{err}</p>}
      {!form && <button className="btn small" onClick={() => setForm({ ...blank })}>+ Добавить</button>}
      {form && (
        <form className="panel" onSubmit={save}>
          <h3>{form.id ? 'Редактирование' : 'Новая запись'}</h3>
          <div className="formgrid">
            {fields.map(([k, label, type]) => (
              <label key={k}>{label}
                <input type={type === 'number' ? 'number' : 'text'} required={k !== 'description'}
                  value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: type === 'number' ? Number(e.target.value) : e.target.value })} />
              </label>
            ))}
          </div>
          <button className="btn small">Сохранить</button>{' '}
          <button type="button" className="btn small ghost" onClick={() => setForm(null)}>Отмена</button>
        </form>
      )}
      {!items && <p className="muted">Загрузка…</p>}
      <table className="table">
        <tbody>
          {items?.map((i) => (
            <tr key={i.id} className={i.isArchived ? 'archived' : ''}>
              <td><strong>{i.name}</strong>{i.isArchived && <span className="tag"> в архиве</span>}</td>
              <td className="muted">{summary(i)}</td>
              <td className="right">
                <button className="btn small ghost" onClick={() => setForm(i)}>Изменить</button>{' '}
                <button className="btn small ghost" onClick={() => archive(i)}>{i.isArchived ? 'Вернуть' : 'В архив'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Users() {
  const { user: me } = useAuth();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api.get('/admin/users').then((d) => setItems(d.items)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const patch = async (u, data) => {
    setErr('');
    try { await api.patch(`/admin/users/${u.id}`, data); load(); } catch (ex) { setErr(ex.message); load(); }
  };

  return (
    <>
      {err && <p className="error" role="alert">{err}</p>}
      {!items && <p className="muted">Загрузка…</p>}
      <table className="table">
        <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Доступ</th></tr></thead>
        <tbody>
          {items?.map((u) => (
            <tr key={u.id} className={u.isActive ? '' : 'archived'}>
              <td>{u.fullName}{u.id === me.id && <span className="tag"> это вы</span>}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => patch(u, { role: e.target.value })}>
                  {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td><button className="btn small ghost" onClick={() => patch(u, { isActive: !u.isActive })}>{u.isActive ? 'Заблокировать' : 'Разблокировать'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Stats() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/admin/stats').then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="error">{err}</p>;
  if (!s) return <p className="muted">Загрузка…</p>;
  return (
    <>
      <div className="grid">
        <div className="card"><div className="muted">Выручка (оплачено, без отменённых)</div><h2>{money(s.revenue)}</h2></div>
        <div className="card"><div className="muted">Пользователей</div><h2>{s.users}</h2></div>
      </div>
      <h3>Заказы по статусам</h3>
      <table className="table"><tbody>
        {Object.entries(STATUS).map(([k, v]) => <tr key={k}><td>{v}</td><td className="right">{s.ordersByStatus[k] ?? 0}</td></tr>)}
      </tbody></table>
    </>
  );
}
