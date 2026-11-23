import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { money } from '../format.js';

const mid = (a, b) => Math.round((a + b) / 2);

// Эскиз: прямоугольник пропорционален ширине и высоте
function Sketch({ w, h, p }) {
  const maxW = p.maxWidth, maxH = p.maxHeight;
  const sw = 40 + (w / maxW) * 160, sh = 30 + (h / maxH) * 110;
  return (
    <svg viewBox="0 0 240 170" className="sketch" role="img" aria-label="Эскиз изделия">
      <rect x={(240 - sw) / 2} y={150 - sh} width={sw} height={sh} fill="#f3e3c6" stroke="#8a5a2b" strokeWidth="3" rx="4" />
      <text x="120" y="164" textAnchor="middle" fontSize="11" fill="#6b5a45">{w} × {h} см</text>
    </svg>
  );
}

export default function Product() {
  const { id } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [options, setOptions] = useState([]);
  const [f, setF] = useState(null);
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/products/${id}`), api.get('/materials'), api.get('/options')])
      .then(([a, b, c]) => {
        setP(a.item); setMaterials(b.items); setOptions(c.items);
        setF({
          width: mid(a.item.minWidth, a.item.maxWidth), depth: mid(a.item.minDepth, a.item.maxDepth),
          height: mid(a.item.minHeight, a.item.maxHeight), materialId: b.items[0]?.id ?? 0, optionIds: [], quantity: 1,
        });
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  // Цену считает сервер; на экране — только его ответ
  useEffect(() => {
    if (!p || !f || !f.materialId) return;
    const t = setTimeout(() => {
      api.post('/price/estimate', { productId: p.id, ...f })
        .then((d) => { setQuote(d); setErr(''); })
        .catch((e) => { setQuote(null); setErr(e.message); });
    }, 250);
    return () => clearTimeout(t);
  }, [p, f]);

  if (err && !p) return <p className="error">{err}</p>;
  if (!p || !f) return <p className="muted">Загрузка…</p>;

  const num = (k) => (e) => setF({ ...f, [k]: e.target.value === '' ? 0 : Number(e.target.value) });
  const toggle = (oid) => setF({
    ...f, optionIds: f.optionIds.includes(oid) ? f.optionIds.filter((x) => x !== oid) : [...f.optionIds, oid],
  });

  const addToCart = () => {
    cart.add({
      productId: p.id, productName: p.name, width: f.width, depth: f.depth, height: f.height,
      materialId: f.materialId, materialName: materials.find((m) => m.id === f.materialId)?.name,
      optionIds: f.optionIds, optionNames: options.filter((o) => f.optionIds.includes(o.id)).map((o) => o.name),
      quantity: f.quantity, shownPrice: quote?.total,
    });
    nav(user?.role === 'CLIENT' ? '/checkout' : '/login');
  };

  const dim = (key, label, min, max) => (
    <label>{label} ({min}–{max} см)
      <input type="number" min={min} max={max} value={f[key]} onChange={num(key)} />
    </label>
  );

  return (
    <>
      <p><Link to="/">← Каталог</Link></p>
      <div className="two">
        <div>
          <h1>{p.name}</h1>
          <p className="muted">{p.description}</p>
          <Sketch w={f.width} h={f.height} p={p} />
        </div>
        <div className="panel">
          <h3>Настройте изделие</h3>
          <div className="row3">
            {dim('width', 'Ширина', p.minWidth, p.maxWidth)}
            {dim('depth', 'Глубина', p.minDepth, p.maxDepth)}
            {dim('height', 'Высота', p.minHeight, p.maxHeight)}
          </div>
          <label>Материал
            <select value={f.materialId} onChange={(e) => setF({ ...f, materialId: Number(e.target.value) })}>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Опции</legend>
            {options.map((o) => (
              <label key={o.id} className="check">
                <input type="checkbox" checked={f.optionIds.includes(o.id)} onChange={() => toggle(o.id)} />
                {o.name} <span className="muted">+{money(o.extraPrice)}</span>
              </label>
            ))}
          </fieldset>
          <label>Количество
            <input type="number" min="1" max="50" value={f.quantity} onChange={num('quantity')} />
          </label>
          <div className="price">
            {quote ? <>Ориентировочная цена: <strong>{money(quote.total)}</strong></> : <span className="muted">Цена не рассчитана</span>}
          </div>
          {err && <p className="error">{err}</p>}
          <p className="muted small">Итоговую цену подтверждает менеджер после проверки заказа.</p>
          <button className="btn" disabled={!quote} onClick={addToCart}>Добавить в заказ</button>
        </div>
      </div>
    </>
  );
}
