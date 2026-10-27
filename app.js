const C = window.CONFIG || {};
const sb = (C.SUPABASE_URL && window.supabase) ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = n => (n == null || n === '') ? 'Consulte o valor' : Number(n).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const LEAF = '<svg viewBox="0 0 120 200" fill="currentColor"><path d="M62 150c-22-4-34-20-36-38 22 2 34 16 36 38zM64 120c20-6 30-22 30-40-20 4-30 20-30 40zM66 90c-20-6-28-22-28-38 20 4 28 18 28 38z"/></svg>';
const WA = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z"/></svg>';
const DEFAULTS = {
  pay: 'As formas de pagamento são combinadas pelo WhatsApp na hora do pedido.',
  about: 'Uma caneca. Um nome. Uma história.\nPresentes personalizados feitos com carinho, para acompanhar rotinas, afetos e memórias.\nEncomendas via WhatsApp.'
};
let cats = [], prods = [], cfg = {}, catId = 'all', query = '';

const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); };
const paras = t => String(t).split('\n').filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('');
const catName = id => (cats.find(c => c.id === id) || {}).name || '';
const pic = p => p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : LEAF;

async function prodQ() {
  const r = await sb.from('products').select('*').order('position').order('created_at', {ascending: false});
  return r.error ? sb.from('products').select('*').order('created_at', {ascending: false}) : r;
}

async function load() {
  if (!sb) {
    cats = ['Canecas', 'Quadros', 'Azulejos'].map((name, i) => ({id: 'c' + i, name}));
    prods = [['Caneca Aqui tem amor', 'c0', 45], ['Caneca com nome', 'c0', 39.9], ['Quadro Família', 'c1', 79], ['Quadro Botânico', 'c1', 65], ['Azulejo Lar', 'c2', 32], ['Azulejo com data', 'c2', null]]
      .map(([name, category_id, price], i) => ({id: 'p' + i, name, category_id, price, description: 'Exemplo de produto. Configure o Supabase para ver os seus.', available: true}));
    prods[0] = {...prods[0], name: 'Caneca Angry Birds', price: 45, description: 'Caneca personalizada com o tema Angry Birds.', image_url: 'assets/demo-angry-birds.jpg'};
  } else {
    const [c, p, s] = await Promise.all([
      sb.from('categories').select('*').order('position').order('created_at'),
      prodQ(),
      sb.from('settings').select('*')]);
    if (c.error || p.error) toast('Não foi possível carregar os produtos.');
    cats = c.data || []; prods = p.data || [];
    cfg = Object.fromEntries((s.data || []).map(r => [r.key, r.value]));
  }
  render();
}

function render() {
  $('#chips').innerHTML = [{id: 'all', name: 'Todos'}, ...cats].map(c =>
    `<button class="chip" data-cat="${esc(c.id)}" aria-pressed="${c.id === catId}">${esc(c.name)}</button>`).join('');
  const q = query.trim().toLowerCase();
  const list = prods.filter(p => p.available !== false && (catId === 'all' || p.category_id === catId) && p.name.toLowerCase().includes(q));
  $('#grid').innerHTML = list.map(p => `<button class="card" data-id="${esc(p.id)}"><div class="pic">${pic(p)}</div><div class="meta"><h3>${esc(p.name)}</h3><div class="price">${brl(p.price)}</div></div></button>`).join('');
  $('#empty').hidden = list.length > 0;
  $('#payText').innerHTML = paras(cfg.payments || DEFAULTS.pay);
  $('#aboutText').innerHTML = paras(cfg.about || DEFAULTS.about);
}

$('#chips').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { catId = b.dataset.cat; render(); } };
$('#search').oninput = e => { query = e.target.value; render(); };
$('#grid').onclick = e => { const b = e.target.closest('[data-id]'); if (b) openProduct(prods.find(p => p.id === b.dataset.id)); };

function openProduct(p) {
  const msg = `Olá! Quero fazer um pedido:\n*${p.name}*${catName(p.category_id) ? '\nCategoria: ' + catName(p.category_id) : ''}\nValor: ${brl(p.price)}`;
  const m = $('#modal');
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
    <button class="close" aria-label="Fechar">×</button>
    <div class="zoom" title="Toque para ampliar">${pic(p)}</div>
    <div class="body"><h2>${esc(p.name)}</h2><div class="cat">${esc(catName(p.category_id))}</div>
    <p class="desc">${esc(p.description)}</p><div class="price">${brl(p.price)}</div>
    <a class="btn" target="_blank" rel="noopener" href="https://wa.me/${C.WHATSAPP || '558391685057'}?text=${encodeURIComponent(msg)}">${WA} Pedir no WhatsApp</a></div></div>`;
  m.hidden = false; document.body.style.overflow = 'hidden';
  const z = m.querySelector('.zoom');
  z.onclick = e => { const r = z.getBoundingClientRect(); z.firstElementChild.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`; z.classList.toggle('on'); };
  m.querySelector('.close').focus();
}
const closeModal = () => { $('#modal').hidden = true; document.body.style.overflow = ''; };
$('#modal').onclick = e => { if (e.target.id === 'modal' || e.target.closest('.close')) closeModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); } });

/* ---------- Backoffice: 5 toques na logo ---------- */
let taps = 0, tapT;
$('#logo').onclick = async () => {
  clearTimeout(tapT); tapT = setTimeout(() => taps = 0, 2000);
  if (++taps < 5) return;
  taps = 0;
  if (!sb) return toast('Configure o Supabase em config.js para usar o admin.');
  const {data} = await sb.auth.getSession();
  data.session ? adminPanel('produtos') : loginView();
};
const adm = () => $('#admin');
function loginView() {
  adm().hidden = false; document.body.style.overflow = 'hidden';
  adm().innerHTML = `<form class="adm login" id="lf"><h2>Acesso da loja</h2>
    <label>Senha<input type="password" name="pw" autocomplete="current-password" required autofocus></label>
    <button class="btn">Entrar</button><button class="btn alt" type="button" data-x>Cancelar</button></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const {error} = await sb.auth.signInWithPassword({email: C.ADMIN_EMAIL, password: e.target.pw.value});
    error ? toast('Senha incorreta.') : adminPanel('produtos');
  };
  adm().querySelector('[data-x]').onclick = closeAdmin;
}
const closeAdmin = () => { adm().hidden = true; document.body.style.overflow = ''; };

function adminPanel(tab, editing) {
  adm().hidden = false; document.body.style.overflow = 'hidden';
  const tabs = [['produtos', 'Produtos'], ['categorias', 'Categorias'], ['textos', 'Textos']]
    .map(([k, n]) => `<button class="chip" data-tab="${k}" aria-pressed="${k === tab}">${n}</button>`).join('');
  let body = '';
  if (tab === 'produtos') {
    const p = editing || {};
    body = `<form id="pf"><input type="hidden" name="id" value="${esc(p.id)}">
      <label>Nome<input name="name" required value="${esc(p.name)}"></label>
      <label>Descrição<textarea name="description" rows="3">${esc(p.description)}</textarea></label>
      <label>Preço (R$) — deixe vazio para "Consulte o valor"<input name="price" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(p.price)}"></label>
      <label>Categoria<select name="category_id"><option value="">Sem categoria</option>${cats.map(c => `<option value="${esc(c.id)}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>Foto${p.image_url ? ' (envie outra para trocar)' : ''}<input name="photo" type="file" accept="image/*" ${p.id ? '' : 'required'}></label>
      <label class="chk"><input name="available" type="checkbox" ${p.available === false ? '' : 'checked'}> Visível na vitrine</label>
      <button class="btn">${p.id ? 'Salvar alterações' : 'Adicionar produto'}</button>
      ${p.id ? '<button class="btn alt" type="button" data-tab="produtos">Cancelar edição</button>' : ''}</form>
      ${prods.map((x, i) => `<div class="row"><div class="mv"><button class="btn alt sm" data-up="${esc(x.id)}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn alt sm" data-dn="${esc(x.id)}" aria-label="Descer" ${i === prods.length - 1 ? 'disabled' : ''}>↓</button></div><img src="${esc(x.image_url)}" alt=""><div class="t"><b>${esc(x.name)}</b><small>${brl(x.price)}${x.available === false ? ' · oculto' : ''}</small></div>
      <button class="btn alt sm" data-edit="${esc(x.id)}">Editar</button><button class="btn alt sm" data-del="${esc(x.id)}">Excluir</button></div>`).join('')}`;
  } else if (tab === 'categorias') {
    body = `<form id="cf"><label>Nova categoria<input name="name" required></label><button class="btn">Adicionar categoria</button></form>
      ${cats.map(c => `<div class="row"><div class="t"><b>${esc(c.name)}</b></div><button class="btn alt sm" data-ren="${esc(c.id)}">Renomear</button><button class="btn alt sm" data-delc="${esc(c.id)}">Excluir</button></div>`).join('')}`;
  } else {
    body = `<form id="tf"><label>Formas de pagamento (uma linha por parágrafo)<textarea name="payments" rows="5">${esc(cfg.payments || DEFAULTS.pay)}</textarea></label>
      <label>Sobre (uma linha por parágrafo)<textarea name="about" rows="6">${esc(cfg.about || DEFAULTS.about)}</textarea></label><button class="btn">Salvar textos</button></form>`;
  }
  adm().innerHTML = `<div class="adm"><h2>Painel da loja</h2><div class="bar">${tabs}<button class="btn alt sm" data-close style="margin-left:auto">Fechar</button><button class="btn alt sm" data-out>Sair</button></div>${body}</div>`;
  bindAdmin(tab);
}

const refresh = async (tab, msg) => { await load(); adminPanel(tab); if (msg) toast(msg); };
const fail = e => toast(e.message || 'Algo deu errado. Tente de novo.');

async function compress(file) {
  const bmp = await createImageBitmap(file), s = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = bmp.width * s; cv.height = bmp.height * s;
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(r => cv.toBlob(r, 'image/webp', .85));
}
async function upload(file) {
  const blob = await compress(file), path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const {error} = await sb.storage.from('produtos').upload(path, blob, {contentType: 'image/webp'});
  if (error) throw error;
  return sb.storage.from('produtos').getPublicUrl(path).data.publicUrl;
}

async function move(id, dir) {
  const i = prods.findIndex(p => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= prods.length) return;
  const a = prods.slice(); [a[i], a[j]] = [a[j], a[i]];
  const rs = await Promise.all(a.map((p, k) => p.position === k + 1 ? null : sb.from('products').update({position: k + 1}).eq('id', p.id)).filter(Boolean));
  const bad = rs.find(r => r.error);
  if (bad) return fail(bad.error);
  refresh('produtos');
}

function bindAdmin(tab) {
  const a = adm();
  a.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    try {
      if (d.tab) adminPanel(d.tab);
      else if ('out' in d) { await sb.auth.signOut(); closeAdmin(); }
      else if ('close' in d) closeAdmin();
      else if (d.up || d.dn) await move(d.up || d.dn, d.up ? -1 : 1);
      else if (d.edit) { adminPanel('produtos', prods.find(p => p.id === d.edit)); a.scrollTo(0, 0); }
      else if (d.del && confirm('Excluir este produto?')) { const r = await sb.from('products').delete().eq('id', d.del); if (r.error) throw r.error; refresh('produtos', 'Produto excluído.'); }
      else if (d.delc && confirm('Excluir categoria? Os produtos dela ficam sem categoria.')) { const r = await sb.from('categories').delete().eq('id', d.delc); if (r.error) throw r.error; refresh('categorias', 'Categoria excluída.'); }
      else if (d.ren) { const n = prompt('Novo nome da categoria:', catName(d.ren)); if (n && n.trim()) { const r = await sb.from('categories').update({name: n.trim()}).eq('id', d.ren); if (r.error) throw r.error; refresh('categorias', 'Categoria renomeada.'); } }
    } catch (err) { fail(err); }
  };
  const pf = $('#pf'), cf = $('#cf'), tf = $('#tf');
  if (pf) pf.onsubmit = async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('.btn'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const row = {name: f.name.value.trim(), description: f.description.value.trim(), price: f.price.value === '' ? null : Number(f.price.value), category_id: f.category_id.value || null, available: f.available.checked};
      if (f.photo.files[0]) row.image_url = await upload(f.photo.files[0]);
      if (!f.id.value) row.position = Math.max(0, ...prods.map(p => p.position || 0)) + 1;
      const r = f.id.value ? await sb.from('products').update(row).eq('id', f.id.value) : await sb.from('products').insert(row);
      if (r.error) throw r.error;
      refresh('produtos', 'Produto salvo.');
    } catch (err) { fail(err); btn.disabled = false; btn.textContent = 'Tentar de novo'; }
  };
  if (cf) cf.onsubmit = async e => {
    e.preventDefault();
    const r = await sb.from('categories').insert({name: e.target.name.value.trim(), position: cats.length + 1});
    r.error ? fail(r.error) : refresh('categorias', 'Categoria adicionada.');
  };
  if (tf) tf.onsubmit = async e => {
    e.preventDefault();
    const r = await sb.from('settings').upsert([{key: 'payments', value: e.target.payments.value}, {key: 'about', value: e.target.about.value}]);
    r.error ? fail(r.error) : refresh('textos', 'Textos salvos.');
  };
}

load();
