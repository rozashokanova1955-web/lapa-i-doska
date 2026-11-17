const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ST = ['Новый', 'Согласование', 'В производстве', 'Готов', 'Доставлен'];
const STG = ['Чертёж', 'Распил', 'Сборка', 'Покраска', 'Упаковка'];
const CAT = {cat: ['Кошки', '🐱', 'c-cat'], dog: ['Собаки', '🐶', 'c-dog'], small: ['Грызуны и птицы', '🐹', 'c-small']};
const MAT = {'Фанера': 1, 'Массив сосны': 1.35, 'Дуб': 1.8};
const OPT = {'Когтеточка': 900, 'Мягкая подушка': 600, 'Окошко': 400};
const money = n => n ? Number(n).toLocaleString('ru-RU') + ' ₽' : 'по расчёту';
const tl = st => '<div class="tl">' + ST.map((_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('') + '</div>';
let U = null, P = [], cfg = {a: 'cat', w: 60, dp: 50, h: 60, m: 'Фанера', o: []}, D = {}, step = 1, done = 0, filt = 'all', mode = 'login';

async function api(path, method = 'GET', body) {
  const r = await fetch('/api/' + path, {method, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('tk') || '')}, body: body ? JSON.stringify(body) : undefined});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Ошибка ' + r.status);
  return j;
}
const err = m => { const e = $('#er'); if (e) e.textContent = m; };
const gate = roles => (U && roles.includes(U.role)) ? null : `<h1>Нужен вход</h1><p>Этот раздел для роли: ${roles.join(', ')}.</p><a class="btn" href="#login">Войти</a>`;

function card(p) {
  const c = CAT[p.cat] || ['', '🪵', 'c-x'];
  return `<div class="card"><div class="pic ${c[2]}">${c[1]}</div><h3>${esc(p.name)}</h3><p class="mu">${c[0]} · от ${money(p.price)}</p><button class="sm" onclick="pick(${p.id})">Заказать</button></div>`;
}
function calc() {
  const b = {cat: 3500, dog: 5500, small: 1800}[cfg.a], v = Math.min(3, Math.max(.4, cfg.w * cfg.dp * cfg.h / 216000));
  return Math.round((b * v * MAT[cfg.m] + cfg.o.reduce((a, x) => a + OPT[x], 0)) / 10) * 10;
}
function house() {
  const w = cfg.w * 1.6, h = cfg.h * .9, x = (240 - w) / 2, y = 200 - h, ry = Math.min(h * .35, 40);
  return `<svg viewBox="0 -10 240 240" width="100%" role="img" aria-label="Эскиз по вашим размерам"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffd23f" stroke="#14110f" stroke-width="4"/><path d="M${x - 8} ${y}L120 ${y - 40}L${x + w + 8} ${y}Z" fill="#ff5a3c" stroke="#14110f" stroke-width="4" stroke-linejoin="round"/><ellipse cx="120" cy="${200 - ry}" rx="${Math.min(w * .18, 26)}" ry="${ry}" fill="#14110f"/><text x="120" y="222" text-anchor="middle" font-size="13" font-family="Onest,sans-serif">${cfg.w} × ${cfg.dp} × ${cfg.h} см</text></svg>`;
}

const V = {
  async home() {
    const word = 'Домики · лежанки · будки · когтеточки · клетки · комплексы · ';
    return `<div class="hero"><div><h1>Домик, где хвосту всё по размеру</h1><p>Мастерская делает мебель для кошек, собак и мелких зверей из фанеры, сосны и дуба. Вы называете размеры, мы чертим, пилим и привозим.</p><p><a class="btn" href="#order">Сделать заказ</a> <a class="btn sec" href="#config">Рассчитать цену</a></p></div>
<svg id="cat" class="cat" viewBox="0 0 300 260" role="img" aria-label="Кот выглядывает из коробки" stroke="#14110f" stroke-width="6" stroke-linejoin="round"><path d="M62 120L78 30L128 82Z" fill="#b9a5ff"/><path d="M238 120L222 30L172 82Z" fill="#b9a5ff"/><ellipse cx="150" cy="115" rx="92" ry="74" fill="#b9a5ff"/><circle cx="114" cy="105" r="22" fill="#fff"/><circle cx="186" cy="105" r="22" fill="#fff"/><circle class="pu" cx="114" cy="105" r="9" fill="#14110f" stroke="none"/><circle class="pu" cx="186" cy="105" r="9" fill="#14110f" stroke="none"/><path d="M140 132h20l-10 12z" fill="#ff5a3c"/><rect x="24" y="160" width="252" height="92" rx="10" fill="#ffd23f"/></svg></div>
<div class="marq"><span>${(word + word).repeat(2)}</span></div>
<h2>Популярное</h2><div class="grid">${P.slice(0, 3).map(card).join('')}</div>
<h2>Как это работает</h2><div class="grid"><div class="card"><h3>Выбираете или рисуете</h3><p class="mu">Готовая модель или свои размеры в конфигураторе.</p></div><div class="card"><h3>Согласуем чертёж</h3><p class="mu">Менеджер уточняет детали и называет цену.</p></div><div class="card"><h3>Делаем и привозим</h3><p class="mu">Этапы работы видны в личном кабинете.</p></div></div>`;
  },
  async catalog() {
    const L = P.filter(p => filt === 'all' || p.cat === filt);
    return `<h1>Каталог</h1><div class="chips">${[['all', 'Все']].concat(Object.entries(CAT).map(([k, v]) => [k, v[0]])).map(([k, n]) => `<button class="chip ${filt === k ? 'on' : ''}" onclick="filt='${k}';render()">${n}</button>`).join('')}</div><div class="grid">${L.map(card).join('')}<div class="card"><div class="pic c-x">✏️</div><h3>Индивидуальный заказ</h3><p class="mu">Нужного нет? Сделаем по вашим размерам.</p><button class="sm" onclick="pick(0)">Описать идею</button></div></div>`;
  },
  async config() {
    return `<h1>Конфигуратор</h1><div class="cfg"><div class="card"><label>Для кого</label><select onchange="cfg.a=this.value;cu()">${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${cfg.a === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
<label>Ширина</label><input type="range" min="30" max="120" value="${cfg.w}" aria-label="Ширина" oninput="cfg.w=+this.value;cu()"><label>Глубина</label><input type="range" min="30" max="100" value="${cfg.dp}" aria-label="Глубина" oninput="cfg.dp=+this.value;cu()"><label>Высота</label><input type="range" min="30" max="180" value="${cfg.h}" aria-label="Высота" oninput="cfg.h=+this.value;cu()">
<label>Материал</label><select onchange="cfg.m=this.value;cu()">${Object.keys(MAT).map(m => `<option ${cfg.m === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
${Object.entries(OPT).map(([o, p]) => `<label><input type="checkbox" ${cfg.o.includes(o) ? 'checked' : ''} onchange="tog('${o}')"> ${o} (+${p} ₽)</label>`).join('')}</div>
<div><div class="demo" id="demo">${house()}</div><div class="bar" style="margin-top:14px"><div><div class="mu">Ориентировочная цена</div><div class="price" id="pr">${money(calc())}</div></div><button onclick="fromCfg()">Оформить</button></div></div></div>`;
  },
  async about() {
    return `<h1>Мастерская</h1><p>Делаем мебель для животных с 2018 года. Работаем без токсичных лаков: только вода, масло и воск.</p><h2>Недавние работы</h2><div class="grid">${[['Башня для трёх кошек', 'c-cat', '🐱'], ['Утеплённая будка для лайки', 'c-dog', '🐶'], ['Терраса для кролика', 'c-small', '🐰'], ['Диван для мопса, дуб', 'c-x', '🐶']].map(x => `<div class="card"><div class="pic ${x[1]}">${x[2]}</div><h3>${x[0]}</h3></div>`).join('')}</div>
<h2>Доставка и оплата</h2><p>По городу от 500 ₽, бесплатно от 15 000 ₽. Предоплата 50%, остальное при получении.</p><h2>Вопросы</h2><div class="card"><h3>Сколько делается заказ?</h3><p class="mu">От 5 до 14 дней в зависимости от сложности.</p><h3>Как ухаживать?</h3><p class="mu">Протирать влажной тканью, не мыть под струёй.</p></div><h2>Контакты</h2><p>+7 (900) 000-00-00 · hello@lapa-doska.example</p>`;
  },
  async order() {
    const s = step;
    let h = `<h1>Новый заказ</h1><div class="steps">${[1, 2, 3, 4].map(i => `<i class="${i <= s ? 'on' : ''}"></i>`).join('')}</div><div class="card">`;
    if (done) return h + `<h3>Заказ №${done} принят</h3><p>Менеджер свяжется с вами, чтобы согласовать чертёж и цену.${U ? ' Статус виден в <a href="#cabinet">кабинете</a>.' : ' <a href="#login">Войдите</a> или зарегистрируйтесь, чтобы следить за статусом.'}</p></div>`;
    if (s === 1) h += `<label>Что заказываем</label><select onchange="D.item=this.value">${['Индивидуальный проект'].concat(P.map(p => p.name)).map(n => `<option ${D.item === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    if (s === 2) h += `<label>Питомец (вид и кличка)</label><input value="${esc(D.pet)}" oninput="D.pet=this.value"><div class="row"><div><label>Размеры, см</label><input value="${esc(D.size)}" placeholder="60×50×60" oninput="D.size=this.value"></div><div><label>Материал</label><select onchange="D.mat=this.value">${Object.keys(MAT).map(m => `<option ${D.mat === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div><label>Цвет и пожелания</label><textarea rows="3" oninput="D.note=this.value">${esc(D.note)}</textarea>`;
    if (s === 3) h += `<label>Имя</label><input value="${esc(D.name || (U && U.name))}" oninput="D.name=this.value"><label>Телефон</label><input type="tel" value="${esc(D.tel)}" oninput="D.tel=this.value"><label>Доставка</label><select onchange="D.dl=this.value"><option>Самовывоз</option><option ${D.dl === 'Курьер' ? 'selected' : ''}>Курьер</option></select>`;
    if (s === 4) h += `<h3>Проверьте заказ</h3><p>${esc(D.item)}<br>Питомец: ${esc(D.pet)}<br>Размеры: ${esc(D.size || '—')}, ${esc(D.mat || 'Фанера')}<br>${esc(D.name)}, ${esc(D.tel)}, ${esc(D.dl || 'Самовывоз')}</p>`;
    return h + `<div class="err" id="er"></div><div class="bar" style="margin-top:16px">${s > 1 ? '<button class="sec" onclick="stp(-1)">Назад</button>' : '<span></span>'}<button onclick="stp(1)">${s === 4 ? 'Отправить заказ' : 'Далее'}</button></div></div>`;
  },
  async login() {
    const reg = mode === 'reg';
    return `<h1>${reg ? 'Регистрация' : 'Вход'}</h1><div class="card" style="max-width:420px">${reg ? '<label>Имя</label><input id="nm">' : ''}<label>Почта</label><input id="em" type="email"><label>Пароль</label><input id="pw" type="password"><div class="err" id="er"></div><div class="bar" style="margin-top:14px"><button onclick="auth()">${reg ? 'Создать аккаунт' : 'Войти'}</button><button class="sec" onclick="mode='${reg ? 'login' : 'reg'}';render()">${reg ? 'Уже есть аккаунт' : 'Регистрация'}</button></div></div><p class="mu" style="margin-top:14px">Демо-входы: client@lapa.ru / client123, manager@lapa.ru / manager123, master@lapa.ru / master123, admin@lapa.ru / admin123</p>`;
  },
  async cabinet() {
    const g = gate(['client', 'admin']); if (g) return g;
    const [O, pets] = await Promise.all([api('orders'), api('pets')]);
    return `<h1>Кабинет</h1><h2>Мои заказы</h2><div class="stack">${O.length ? O.map(o => `<div class="card"><div class="bar"><h3>№${o.id} · ${esc(o.item)}</h3><span class="badge">${ST[o.status]}</span></div><p class="mu">${esc(o.pet)} · ${money(o.price)}</p>${tl(o.status)}</div>`).join('') : '<p>Заказов пока нет. <a href="#order">Оформить первый</a></p>'}</div>
<h2>Мои питомцы</h2><div class="grid">${pets.map(p => `<div class="card"><h3>${esc(p.name)}</h3><p class="mu">${esc(p.kind)} · ${esc(p.size)}</p></div>`).join('')}</div><div class="card" style="margin-top:14px"><div class="row"><input id="pn" placeholder="Кличка"><input id="pk" placeholder="Вид"></div><input id="ps" placeholder="Размеры лежанки, см" style="margin:10px 0"><button class="sm" onclick="addPet()">Добавить питомца</button></div>
<h2>Уведомления</h2>${O.map(o => `<p class="mu">Заказ №${o.id}: статус «${ST[o.status]}»</p>`).join('') || '<p class="mu">Пока тихо.</p>'}`;
  },
  async work() {
    const g = gate(['manager', 'master', 'admin']); if (g) return g;
    const mst = U.role === 'master', [O, S] = await Promise.all([api('orders'), mst ? [] : api('staff')]);
    if (!O.length) return '<h1>Заказы</h1><p>Пока нет заказов.</p>';
    return `<h1>${mst ? 'Задания' : 'Заказы'}</h1><div class="stack">${O.map(o => mst
      ? `<div class="card"><h3>№${o.id} · ${esc(o.item)}</h3><p class="mu">${esc(o.material)}, ${esc(o.size || '—')}, ${esc(o.pet)}</p>${STG.map((s, k) => `<span class="badge" style="background:${k < o.stage ? 'var(--mint)' : '#fff'}">${s}</span> `).join('')}<p style="margin-top:12px">${o.stage < 5 ? `<button class="sm" onclick="upd(${o.id},{stage:${o.stage + 1}})">Этап «${STG[o.stage]}» готов</button>` : 'Все этапы выполнены'}</p></div>`
      : `<div class="card"><div class="bar"><h3>№${o.id} · ${esc(o.item)}</h3><span class="mu">${esc(o.client || o.contact || 'Гость')}${o.phone ? ', ' + esc(o.phone) : ''}</span></div><p class="mu">${esc(o.pet)}, ${esc(o.material)}, ${esc(o.size || '—')}. ${esc(o.note)}</p><div class="row"><div><label>Статус</label><select onchange="upd(${o.id},{status:+this.value})">${ST.map((s, j) => `<option value="${j}" ${o.status === j ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div><label>Цена, ₽</label><input type="number" value="${o.price}" onchange="upd(${o.id},{price:+this.value})"></div></div><label>Мастер</label><select onchange="upd(${o.id},{master_id:this.value?+this.value:null})"><option value="">Не назначен</option>${S.map(m => `<option value="${m.id}" ${o.master === m.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>`).join('')}</div>`;
  },
  async admin() {
    const g = gate(['admin']); if (g) return g;
    const [s, us] = await Promise.all([api('stats'), api('users')]);
    return `<h1>Админка</h1><div class="grid"><div class="card"><p class="mu">Заказов</p><div class="price">${s.orders}</div></div><div class="card"><p class="mu">Сумма заказов</p><div class="price">${money(s.revenue)}</div></div></div>
<h2>Каталог и цены</h2><div class="stack">${P.map(p => `<div class="card bar"><span>${esc(p.name)}</span><span><input type="number" value="${p.price}" style="width:110px" onchange="api('products/${p.id}','PATCH',{price:this.value})"> <button class="sec sm" onclick="delP(${p.id})">Удалить</button></span></div>`).join('')}</div>
<div class="card"><div class="row"><input id="an" placeholder="Название"><select id="ac">${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div><input id="ap" type="number" placeholder="Цена" style="margin:10px 0"><div class="err" id="er"></div><button class="sm" onclick="addP()">Добавить изделие</button></div>
<h2>Пользователи и роли</h2><div class="stack">${us.map(u => `<div class="card bar"><span>${esc(u.name)} <span class="mu">${esc(u.email)}</span></span><select style="width:auto" onchange="api('users/${u.id}','PATCH',{role:this.value})">${['client', 'manager', 'master', 'admin'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`).join('')}</div>`;
  }
};

function nav() {
  const r = location.hash.slice(1) || 'home';
  const L = [['home', 'Главная'], ['catalog', 'Каталог'], ['config', 'Конфигуратор'], ['about', 'Мастерская'], ['order', 'Заказать']];
  if (!U) L.push(['login', 'Войти']);
  else {
    ({client: [['cabinet', 'Кабинет']], manager: [['work', 'Заказы']], master: [['work', 'Задания']], admin: [['admin', 'Админка'], ['work', 'Заказы']]})[U.role].forEach(x => L.push(x));
  }
  $('#nav').innerHTML = L.map(x => `<a href="#${x[0]}" class="${x[0] === r ? 'on' : ''}">${x[1]}</a>`).join('') + (U ? '<a href="#home" onclick="logout()">Выйти</a>' : '');
  $('#who').textContent = U ? U.name : '';
}
async function render() {
  let r = location.hash.slice(1) || 'home'; if (!V[r]) r = 'home';
  nav();
  try { $('#app').innerHTML = await V[r](); } catch (e) { $('#app').innerHTML = `<div class="card"><h3>Что-то пошло не так</h3><p>${esc(e.message)}</p></div>`; }
}
function cu() { $('#demo').innerHTML = house(); $('#pr').textContent = money(calc()); }
function tog(o) { const i = cfg.o.indexOf(o); i < 0 ? cfg.o.push(o) : cfg.o.splice(i, 1); cu(); }
function pick(id) { const p = P.find(x => x.id === id); D = {item: p ? p.name : 'Индивидуальный проект'}; step = 2; done = 0; location.hash = 'order'; render(); }
function fromCfg() { D = {item: 'Индивидуальный проект', size: `${cfg.w}×${cfg.dp}×${cfg.h}`, mat: cfg.m, note: 'Для: ' + CAT[cfg.a][0] + (cfg.o.length ? '; ' + cfg.o.join(', ') : ''), price: calc()}; step = 2; done = 0; location.hash = 'order'; render(); }
async function stp(k) {
  if (k > 0) {
    if (step === 1) D.item = D.item || 'Индивидуальный проект';
    if (step === 2 && !(D.pet || '').trim()) return err('Укажите питомца: вид и кличку.');
    if (step === 3) { D.name = D.name || (U && U.name) || ''; if (!D.name.trim() || !(D.tel || '').trim()) return err('Заполните имя и телефон, чтобы менеджер мог связаться.'); }
    if (step === 4) {
      try { const r = await api('orders', 'POST', {item: D.item, pet: D.pet, size: D.size, material: D.mat || 'Фанера', note: D.note, contact: D.name, phone: D.tel, delivery: D.dl || 'Самовывоз', price: D.price || 0}); done = r.id; D = {}; render(); } catch (e) { err(e.message); }
      return;
    }
  }
  step += k; render();
}
async function auth() {
  const b = {email: $('#em').value, password: $('#pw').value}; if (mode === 'reg') b.name = $('#nm').value;
  try {
    const r = await api(mode === 'reg' ? 'register' : 'login', 'POST', b);
    localStorage.setItem('tk', r.token); U = r.user;
    location.hash = {client: 'cabinet', manager: 'work', master: 'work', admin: 'admin'}[U.role]; render();
  } catch (e) { err(e.message); }
}
function logout() { localStorage.removeItem('tk'); U = null; render(); }
async function upd(id, d) { try { await api('orders/' + id, 'PATCH', d); } catch (e) { alert(e.message); } render(); }
async function addPet() { const n = $('#pn').value.trim(); if (!n) return; await api('pets', 'POST', {name: n, kind: $('#pk').value, size: $('#ps').value}); render(); }
async function addP() { try { await api('products', 'POST', {name: $('#an').value, cat: $('#ac').value, price: $('#ap').value}); P = await api('products'); render(); } catch (e) { err('Введите название и цену.'); } }
async function delP(id) { await api('products/' + id, 'DELETE'); P = await api('products'); render(); }

addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
addEventListener('pointermove', e => {
  const s = $('#cat'); if (!s) return;
  const r = s.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * .4), k = Math.min(7, Math.hypot(dx, dy) / 30), a = Math.atan2(dy, dx);
  document.querySelectorAll('.pu').forEach(p => p.style.transform = `translate(${Math.cos(a) * k}px,${Math.sin(a) * k}px)`);
});
(async () => {
  try { U = (await api('me')).user; } catch (e) { U = null; }
  try { P = await api('products'); } catch (e) { P = []; }
  render();
})();
