"""Лапа и доска: сервер заказов. Только стандартная библиотека Python 3.8+.
Запуск: python server.py  ->  http://localhost:8000"""
import sqlite3, json, hashlib, secrets, os, re, mimetypes
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, 'pets.db')
STATIC = os.path.join(ROOT, 'static')
SESS = {}  # токен -> id пользователя

SCHEMA = """
create table if not exists users(id integer primary key, name text not null, email text unique not null,
  salt text, hash text, role text default 'client');
create table if not exists products(id integer primary key, name text not null, cat text, price integer, descr text);
create table if not exists pets(id integer primary key, user_id integer references users(id), name text, kind text, size text);
create table if not exists orders(id integer primary key, user_id integer references users(id), item text, pet text,
  size text, material text, note text, contact text, phone text, delivery text, price integer default 0,
  status integer default 0, master_id integer references users(id), stage integer default 0,
  created text default current_timestamp);
"""

def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute('pragma foreign_keys=on')
    return c

def hp(pw, salt):
    return hashlib.sha256((salt + pw).encode()).hexdigest()

def add_user(c, name, email, pw, role='client'):
    s = secrets.token_hex(8)
    return c.execute('insert into users(name,email,salt,hash,role) values(?,?,?,?,?)',
                     (name, email.lower(), s, hp(pw, s), role)).lastrowid

def init():
    c = db(); c.executescript(SCHEMA)
    if not c.execute('select 1 from users').fetchone():
        add_user(c, 'Админ', 'admin@lapa.ru', 'admin123', 'admin')
        add_user(c, 'Марина', 'manager@lapa.ru', 'manager123', 'manager')
        add_user(c, 'Иван', 'master@lapa.ru', 'master123', 'master')
        add_user(c, 'Анна', 'client@lapa.ru', 'client123', 'client')
        for p in [('Домик «Конура»', 'cat', 4200), ('Комплекс «Башня»', 'cat', 11800), ('Когтеточка-стол', 'cat', 3100),
                  ('Будка утеплённая', 'dog', 9500), ('Лежанка-диван', 'dog', 5400), ('Миски на подставке', 'dog', 2300),
                  ('Клетка-терраса', 'small', 6800), ('Домик для хомяка', 'small', 1500)]:
            c.execute('insert into products(name,cat,price) values(?,?,?)', p)
    c.commit(); c.close()

ORD = """select o.*, u.name client, m.name master from orders o
  left join users u on u.id=o.user_id left join users m on m.id=o.master_id """

class Err(Exception):
    def __init__(self, code, msg): self.code, self.msg = code, msg

def need(u, *roles):
    if not u: raise Err(401, 'Нужно войти в систему')
    if u['role'] not in roles: raise Err(403, 'Недостаточно прав')

def api(u, m, path, d):
    c = db()
    try:
        rows = lambda q, a=(): [dict(r) for r in c.execute(q, a).fetchall()]
        if path == '/register' and m == 'POST':
            if not (d.get('name') and d.get('email') and len(d.get('password', '')) >= 6):
                raise Err(400, 'Заполните имя, почту и пароль от 6 символов')
            try: uid = add_user(c, d['name'], d['email'], d['password'])
            except sqlite3.IntegrityError: raise Err(400, 'Эта почта уже зарегистрирована')
            c.commit(); return login_ok(c, uid)
        if path == '/login' and m == 'POST':
            r = c.execute('select * from users where email=?', (d.get('email', '').lower(),)).fetchone()
            if not r or hp(d.get('password', ''), r['salt']) != r['hash']: raise Err(401, 'Неверная почта или пароль')
            return login_ok(c, r['id'])
        if path == '/me': return {'user': u}
        if path == '/products':
            if m == 'GET': return rows('select * from products order by id')
            need(u, 'admin')
            c.execute('insert into products(name,cat,price) values(?,?,?)', (d['name'], d['cat'], int(d['price'])))
            c.commit(); return {'ok': 1}
        g = re.fullmatch(r'/products/(\d+)', path)
        if g:
            need(u, 'admin')
            if m == 'DELETE': c.execute('delete from products where id=?', (g[1],))
            else: c.execute('update products set price=? where id=?', (int(d['price']), g[1]))
            c.commit(); return {'ok': 1}
        if path == '/orders':
            if m == 'POST':
                if not d.get('pet'): raise Err(400, 'Укажите питомца')
                cur = c.execute('insert into orders(user_id,item,pet,size,material,note,contact,phone,delivery,price) values(?,?,?,?,?,?,?,?,?,?)',
                    (u and u['id'], d.get('item'), d['pet'], d.get('size'), d.get('material'), d.get('note'),
                     d.get('contact'), d.get('phone'), d.get('delivery'), int(d.get('price') or 0)))
                c.commit(); return {'id': cur.lastrowid}
            need(u, 'client', 'manager', 'master', 'admin')
            if u['role'] == 'client': return rows(ORD + 'where o.user_id=? order by o.id desc', (u['id'],))
            if u['role'] == 'master': return rows(ORD + 'where o.master_id=? order by o.id desc', (u['id'],))
            return rows(ORD + 'order by o.id desc')
        g = re.fullmatch(r'/orders/(\d+)', path)
        if g and m == 'PATCH':
            need(u, 'manager', 'master', 'admin')
            o = c.execute('select * from orders where id=?', (g[1],)).fetchone()
            if not o: raise Err(404, 'Заказ не найден')
            if u['role'] == 'master':
                if o['master_id'] != u['id']: raise Err(403, 'Это не ваш заказ')
                st = max(0, min(5, int(d['stage'])))
                c.execute('update orders set stage=?, status=? where id=?', (st, 3 if st >= 5 else o['status'], o['id']))
            else:
                for k in ('status', 'price', 'master_id'):
                    if k in d: c.execute(f'update orders set {k}=? where id=?', (d[k] or None, o['id']))
            c.commit(); return {'ok': 1}
        if path == '/pets':
            need(u, 'client', 'admin')
            if m == 'POST':
                c.execute('insert into pets(user_id,name,kind,size) values(?,?,?,?)', (u['id'], d['name'], d.get('kind'), d.get('size')))
                c.commit(); return {'ok': 1}
            return rows('select * from pets where user_id=?', (u['id'],))
        if path == '/staff':
            need(u, 'manager', 'admin'); return rows("select id,name from users where role='master'")
        if path == '/stats':
            need(u, 'admin')
            return {'orders': c.execute('select count(*) from orders').fetchone()[0],
                    'revenue': c.execute('select coalesce(sum(price),0) from orders').fetchone()[0],
                    'by_status': rows('select status, count(*) n from orders group by status')}
        if path == '/users' and m == 'GET':
            need(u, 'admin'); return rows('select id,name,email,role from users')
        g = re.fullmatch(r'/users/(\d+)', path)
        if g and m == 'PATCH':
            need(u, 'admin')
            if d.get('role') not in ('client', 'manager', 'master', 'admin'): raise Err(400, 'Неверная роль')
            c.execute('update users set role=? where id=?', (d['role'], g[1])); c.commit(); return {'ok': 1}
        raise Err(404, 'Не найдено')
    finally:
        c.close()

def login_ok(c, uid):
    t = secrets.token_hex(16); SESS[t] = uid
    r = c.execute('select id,name,email,role from users where id=?', (uid,)).fetchone()
    return {'token': t, 'user': dict(r)}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def out(self, code, body, ctype='application/json; charset=utf-8'):
        if not isinstance(body, bytes): body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def user(self):
        uid = SESS.get(self.headers.get('Authorization', '')[7:])
        if not uid: return None
        c = db()
        try:
            r = c.execute('select id,name,email,role from users where id=?', (uid,)).fetchone()
            return dict(r) if r else None
        finally: c.close()

    def handle_any(self, m):
        path = self.path.split('?')[0]
        if path.startswith('/api/'):
            try:
                n = int(self.headers.get('Content-Length', 0))
                d = json.loads(self.rfile.read(n) or b'{}') if n else {}
                self.out(200, api(self.user(), m, path[4:], d))
            except Err as e: self.out(e.code, {'error': e.msg})
            except (KeyError, ValueError, TypeError): self.out(400, {'error': 'Некорректные данные'})
            return
        if m != 'GET': return self.out(405, {'error': 'Метод не поддерживается'})
        f = os.path.normpath(os.path.join(STATIC, path.lstrip('/') or 'index.html'))
        if not f.startswith(STATIC) or not os.path.isfile(f): f = os.path.join(STATIC, 'index.html')
        with open(f, 'rb') as fh:
            self.out(200, fh.read(), (mimetypes.guess_type(f)[0] or 'text/plain') + '; charset=utf-8')

    do_GET = lambda s: s.handle_any('GET')
    do_POST = lambda s: s.handle_any('POST')
    do_PATCH = lambda s: s.handle_any('PATCH')
    do_DELETE = lambda s: s.handle_any('DELETE')

if __name__ == '__main__':
    init()
    port = int(os.environ.get('PORT', 8000))
    print(f'Сайт: http://localhost:{port}')
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
