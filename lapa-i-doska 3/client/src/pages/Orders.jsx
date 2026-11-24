import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PAYMENT, STAGE, STAGE_ORDER, STATUS, dateTime, money } from '../format.js';

const Badge = ({ status }) => <span className={`badge st-${status}`}>{STATUS[status]}</span>;

export function OrderList({ title, base, filter }) {
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/orders${status ? `?status=${status}` : ''}`).then((d) => setItems(d.items)).catch((e) => setErr(e.message));
  }, [status]);

  return (
    <>
      <h1>{title}</h1>
      {filter && (
        <label className="inline">Статус:{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      )}
      {err && <p className="error">{err}</p>}
      {!items && !err && <p className="muted">Загрузка…</p>}
      {items?.length === 0 && <p className="muted">Заказов пока нет.</p>}
      {items?.length > 0 && (
        <table className="table">
          <thead><tr><th>№</th><th>Дата</th><th>Состав</th><th>Статус</th><th>Сумма</th><th /></tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td>{dateTime(o.createdAt)}</td>
                <td>
                  {o.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')}
                  {o.client && <div className="muted small">{o.client.fullName}</div>}
                </td>
                <td><Badge status={o.status} /></td>
                <td>{money(o.finalPrice ?? o.estimatedPrice)}{o.finalPrice == null && <div className="muted small">ориентир.</div>}</td>
                <td><Link to={`${base}/orders/${o.id}`}>Открыть</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function OrderDetail({ back }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [o, setO] = useState(null);
  const [masters, setMasters] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState('');
  const [paid, setPaid] = useState('');
  const [reason, setReason] = useState('');
  const [masterId, setMasterId] = useState('');

  const apply = useCallback((item) => {
    setO(item);
    setPrice(item.finalPrice ?? '');
    setPaid(item.paidAmount ?? 0);
    setMasterId(item.masterId ?? '');
  }, []);

  useEffect(() => {
    api.get(`/orders/${id}`).then((d) => apply(d.item)).catch((e) => setErr(e.message));
    if (user.role === 'MANAGER') api.get('/orders/masters').then((d) => setMasters(d.items)).catch(() => {});
  }, [id, user.role, apply]);

  const act = async (fn) => {
    setErr(''); setBusy(true);
    try { apply((await fn()).item); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const transition = (to, comment) => act(() => api.post(`/orders/${id}/transition`, { to, comment: comment || undefined }));

  if (!o) return err ? <p className="error">{err}</p> : <p className="muted">Загрузка…</p>;

  const isManager = user.role === 'MANAGER';
  const isClient = user.role === 'CLIENT';
  const isMaster = user.role === 'MASTER';
  const open = !['DELIVERED', 'CANCELLED'].includes(o.status);
  const doneStages = o.stages.map((s) => s.stage);
  const nextStage = STAGE_ORDER.find((s) => !doneStages.includes(s));

  return (
    <>
      <p><Link to={back}>← К списку</Link></p>
      <h1>Заказ #{o.id} <Badge status={o.status} /></h1>
      {err && <p className="error" role="alert">{err}</p>}

      <div className="two">
        <div>
          <h3>Состав</h3>
          {o.items.map((i) => (
            <div key={i.id} className="card">
              <strong>{i.productName}</strong> × {i.quantity}
              <div className="muted small">
                {i.width}×{i.depth}×{i.height} см · {i.materialName}
                {i.options.length > 0 && ` · ${i.options.map((x) => x.name).join(', ')}`}
              </div>
              <div>{money(i.unitPrice)} за шт.</div>
            </div>
          ))}
          <p>Ориентировочно: {money(o.estimatedPrice)}<br />
            <strong>Итоговая цена: {money(o.finalPrice)}</strong><br />
            Оплата: {PAYMENT[o.paymentStatus]} ({money(o.paidAmount)})</p>
          {o.client && <p className="muted">Клиент: {o.client.fullName}, {o.client.phone || o.client.email}</p>}
          {o.address && <p className="muted">Адрес: {o.address}</p>}
          {o.petNote && <p className="muted">Питомец: {o.petNote}</p>}
          {o.master && !isMaster && <p className="muted">Мастер: {o.master.fullName}</p>}
          {o.cancelReason && <p className="muted">Причина отмены: {o.cancelReason}</p>}

          <h3>Этапы производства</h3>
          <ol className="stages">
            {STAGE_ORDER.map((s) => {
              const rec = o.stages.find((x) => x.stage === s);
              return <li key={s} className={rec ? 'done' : ''}>{STAGE[s]}{rec && <span className="muted small"> · {dateTime(rec.doneAt)}</span>}</li>;
            })}
          </ol>
        </div>

        <div>
          {/* ---------- клиент ---------- */}
          {isClient && open && (
            <div className="panel">
              {o.status === 'AWAITING_APPROVAL' && o.finalPrice != null && !o.clientApproved && (
                <>
                  <p>Менеджер подтвердил цену <strong>{money(o.finalPrice)}</strong>. Согласуйте цену и чертёж, затем внесите предоплату.</p>
                  <button className="btn" disabled={busy} onClick={() => act(() => api.post(`/orders/${id}/approve`))}>Согласовать</button>
                </>
              )}
              {o.clientApproved && o.status === 'AWAITING_APPROVAL' && <p>Вы согласовали заказ. Ожидается предоплата и запуск в производство.</p>}
              {o.status === 'NEW' && <p>Менеджер проверяет заказ и скоро подтвердит цену.</p>}
              {['NEW', 'AWAITING_APPROVAL'].includes(o.status) && !(o.paidAmount > 0) && (
                <button className="btn ghost" disabled={busy}
                  onClick={() => window.confirm('Отменить заказ?') && transition('CANCELLED', 'Отменён клиентом')}>Отменить заказ</button>
              )}
            </div>
          )}

          {/* ---------- менеджер ---------- */}
          {isManager && open && (
            <div className="panel">
              {['NEW', 'AWAITING_APPROVAL'].includes(o.status) && (
                <label>Итоговая цена, ₸
                  <span className="inline-row">
                    <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} />
                    <button className="btn small" disabled={busy || !price}
                      onClick={() => act(() => api.patch(`/orders/${id}/price`, { finalPrice: Number(price) }))}>Сохранить</button>
                  </span>
                </label>
              )}
              {o.status !== 'READY' && (
                <label>Мастер
                  <span className="inline-row">
                    <select value={masterId} onChange={(e) => setMasterId(e.target.value)}>
                      <option value="">— не назначен —</option>
                      {masters.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                    </select>
                    <button className="btn small" disabled={busy || !masterId}
                      onClick={() => act(() => api.patch(`/orders/${id}/master`, { masterId: Number(masterId) }))}>Назначить</button>
                  </span>
                </label>
              )}
              {o.finalPrice != null && (
                <label>Внесено клиентом, ₸ (предоплата — {money(Math.ceil(o.finalPrice / 2))})
                  <span className="inline-row">
                    <input type="number" min="0" max={o.finalPrice} value={paid} onChange={(e) => setPaid(e.target.value)} />
                    <button className="btn small" disabled={busy}
                      onClick={() => act(() => api.patch(`/orders/${id}/payment`, { paidAmount: Number(paid) }))}>Записать</button>
                  </span>
                </label>
              )}
              <div className="actions">
                {o.status === 'NEW' && <button className="btn" disabled={busy} onClick={() => transition('AWAITING_APPROVAL')}>Отправить на согласование</button>}
                {o.status === 'AWAITING_APPROVAL' && <button className="btn" disabled={busy} onClick={() => transition('IN_PRODUCTION')}>Запустить в производство</button>}
                {o.status === 'READY' && <button className="btn" disabled={busy} onClick={() => transition('DELIVERED')}>Выдать клиенту</button>}
              </div>
              {['NEW', 'AWAITING_APPROVAL', 'IN_PRODUCTION'].includes(o.status) && (
                <label>Причина отмены
                  <span className="inline-row">
                    <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                    <button className="btn small ghost" disabled={busy}
                      onClick={() => window.confirm('Отменить заказ?') && transition('CANCELLED', reason)}>Отменить заказ</button>
                  </span>
                </label>
              )}
            </div>
          )}

          {/* ---------- мастер ---------- */}
          {isMaster && o.status === 'IN_PRODUCTION' && nextStage && (
            <div className="panel">
              <p>Следующий этап: <strong>{STAGE[nextStage]}</strong></p>
              <button className="btn" disabled={busy}
                onClick={() => act(() => api.post(`/orders/${id}/stages`, { stage: nextStage }))}>Отметить «{STAGE[nextStage]}» выполненным</button>
            </div>
          )}

          <h3>История заказа</h3>
          <ul className="history">
            {o.history.map((h) => (
              <li key={h.id}>
                <span className="muted small">{dateTime(h.createdAt)}</span>{' '}
                {h.fromStatus !== h.toStatus && <strong>{STATUS[h.toStatus]}</strong>}
                {h.comment && <span> — {h.comment}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
