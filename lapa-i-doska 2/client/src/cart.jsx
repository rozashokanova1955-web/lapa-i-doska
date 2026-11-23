import { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

const KEY = 'lapa_cart';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };

// Корзина хранит только то, что выбрал клиент (размеры, материал, опции). Цена в ней — для показа, настоящую считает сервер.
export function CartProvider({ children }) {
  const [items, setItems] = useState(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ } }, [items]);

  const add = (item) => setItems((a) => [...a, { ...item, key: crypto.randomUUID() }]);
  const remove = (key) => setItems((a) => a.filter((i) => i.key !== key));
  const clear = () => setItems([]);
  return <Ctx.Provider value={{ items, add, remove, clear }}>{children}</Ctx.Provider>;
}
