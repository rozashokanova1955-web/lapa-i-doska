import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { money } from '../format.js';

export default function Catalog() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/products').then((d) => setItems(d.items)).catch((e) => setErr(e.message)); }, []);

  return (
    <>
      <h1>Мебель для животных на заказ</h1>
      <p className="muted">Выберите изделие, задайте размеры и материал — цена посчитается сразу. Предоплата 50 %.</p>
      {err && <p className="error">{err}</p>}
      {!items && !err && <p className="muted">Загрузка…</p>}
      <div className="grid">
        {items?.map((p) => (
          <Link key={p.id} to={`/products/${p.id}`} className="card product">
            <span className="tag">{p.category}</span>
            <h3>{p.name}</h3>
            <p className="muted">{p.description}</p>
            <strong>от {money(p.basePrice)}</strong>
          </Link>
        ))}
      </div>
      {items?.length === 0 && <p className="muted">Каталог пока пуст.</p>}
    </>
  );
}
