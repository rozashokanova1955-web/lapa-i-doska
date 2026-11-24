import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useCart } from '../cart.jsx';
import { money } from '../format.js';

export default function Checkout() {
  const cart = useCart();
  const nav = useNavigate();
  const [petNote, setPetNote] = useState('');
  const [address, setAddress] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (cart.items.length === 0) {
    return <p>Корзина пуста. <Link to="/">Выбрать изделие</Link></p>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      // Отправляем только выбор клиента — цену сервер посчитает сам
      const items = cart.items.map(({ productId, width, depth, height, materialId, optionIds, quantity }) =>
        ({ productId, width, depth, height, materialId, optionIds, quantity }));
      const d = await api.post('/orders', { items, petNote: petNote || null, address: address || null });
      cart.clear();
      nav(`/cabinet/orders/${d.item.id}`, { replace: true });
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const total = cart.items.reduce((s, i) => s + (i.shownPrice || 0), 0);

  return (
    <form onSubmit={submit} className="two">
      <div>
        <h1>Оформление заказа</h1>
        {cart.items.map((i) => (
          <div key={i.key} className="card row">
            <div>
              <strong>{i.productName}</strong> × {i.quantity}
              <div className="muted small">{i.width}×{i.depth}×{i.height} см · {i.materialName}
                {i.optionNames.length ? ` · ${i.optionNames.join(', ')}` : ''}</div>
            </div>
            <div>
              <div>{money(i.shownPrice)}</div>
              <button type="button" className="btn small ghost" onClick={() => cart.remove(i.key)}>Убрать</button>
            </div>
          </div>
        ))}
        <p className="price">Ориентировочно: <strong>{money(total)}</strong></p>
      </div>
      <div className="panel">
        <label>Адрес доставки или самовывоз
          <input maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Город, улица, дом" />
        </label>
        <label>Питомец (кличка, порода)
          <input maxLength={300} value={petNote} onChange={(e) => setPetNote(e.target.value)} />
        </label>
        <p className="muted small">Менеджер проверит заказ и подтвердит итоговую цену. Для запуска в производство нужна предоплата 50 %.</p>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Отправляем…' : 'Оформить заказ'}</button>
      </div>
    </form>
  );
}
