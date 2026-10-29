const C = window.CONFIG || {};
const sb = (C.SUPABASE_URL && window.supabase) ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = n => (n == null || n === '') ? 'Consulte o valor' : Number(n).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const hasPromo = p => p.price != null && p.old_price != null && Number(p.old_price) > Number(p.price);
const off = p => Math.round((1 - p.price / p.old_price) * 100);
const priceHtml = (p, withOff) => `<div class="pr">${hasPromo(p) ? `<s>${brl(p.old_price)}</s>` : ''}<span class="price">${brl(p.price)}</span>${withOff && hasPromo(p) ? `<small class="off">-${off(p)}%</small>` : ''}</div>`;
const LEAF = '<svg viewBox="0 0 120 200" fill="currentColor"><path d="M62 150c-22-4-34-20-36-38 22 2 34 16 36 38zM64 120c20-6 30-22 30-40-20 4-30 20-30 40zM66 90c-20-6-28-22-28-38 20 4 28 18 28 38z"/></svg>';
const WA = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z"/></svg>';
const DEFAULTS = {
  pay: 'As formas de pagamento são combinadas pelo WhatsApp na hora do pedido.',
  about: 'Uma caneca. Um nome. Uma história.\nPresentes personalizados feitos com carinho, para acompanhar rotinas, afetos e memórias.\nEncomendas via WhatsApp.'
};
let cats = [], prods = [], cfg = {}, banners = [], catId = 'all', subId = 'all', query = '';
let editingBannerId = null;

const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); };
const paras = t => String(t).split('\n').filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('');
const catName = id => (cats.find(c => c.id === id) || {}).name || '';
const catPath = id => { const c = cats.find(x => x.id === id); if (!c) return ''; const p = cats.find(x => x.id === c.parent_id); return p ? `${p.name} › ${c.name}` : c.name; };
const kidsOf = id => cats.filter(c => c.parent_id === id);
const catTree = () => cats.filter(c => !c.parent_id).flatMap(c => [c, ...kidsOf(c.id)]);
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
    banners = [];
  } else {
    const [c, p, s, b] = await Promise.all([
      sb.from('categories').select('*').order('position').order('created_at'),
      prodQ(),
      sb.from('settings').select('*'),
      sb.from('banners').select('*').order('position').order('created_at')
    ]);
    if (c.error || p.error) toast('Não foi possível carregar os produtos.');
    cats = c.data || []; prods = p.data || [];
    cfg = Object.fromEntries((s.data || []).map(r => [r.key, r.value]));
    banners = (b.data || []).filter(x => x.active !== false);
  }
  render();
}

function render() {
  const tops = cats.filter(c => !c.parent_id);
  if (catId !== 'all' && !tops.some(c => c.id === catId)) catId = 'all';
  const kids = kidsOf(catId);
  if (subId !== 'all' && !kids.some(c => c.id === subId)) subId = 'all';
  $('#chips').innerHTML = [{id: 'all', name: 'Todos'}, ...tops].map(c =>
    `<button class="chip" data-cat="${esc(c.id)}" aria-pressed="${c.id === catId}">${esc(c.name)}</button>`).join('');
  const sc = $('#subchips'); sc.hidden = !kids.length;
  sc.innerHTML = kids.length ? [{id: 'all', name: 'Todos'}, ...kids].map(c => `<button class="chip" data-sub="${esc(c.id)}" aria-pressed="${c.id === subId}">${esc(c.name)}</button>`).join('') : '';
  const ids = subId !== 'all' ? [subId] : [catId, ...kids.map(c => c.id)];
  const q = query.trim().toLowerCase();
  const list = prods.filter(p => p.available !== false && (catId === 'all' || ids.includes(p.category_id)) && p.name.toLowerCase().includes(q));
  $('#grid').innerHTML = list.map(p => `<button class="card" data-id="${esc(p.id)}"><div class="pic">${pic(p)}${hasPromo(p) ? `<span class="badge">-${off(p)}%</span>` : ''}</div><div class="meta"><h3>${esc(p.name)}</h3>${priceHtml(p)}</div></button>`).join('');
  $('#empty').hidden = list.length > 0;

  // Banners carousel
  const bc = $('#bannerCarousel');
  if (bc) {
    if (banners.length) {
      bc.innerHTML = banners.map((b, i) => {
        const prod = prods.find(p => p.id === b.link_product_id);
        return `<div class="banner-slide${i === 0 ? ' active' : ''}" data-banner="${esc(b.id)}"${prod ? ` data-product="${esc(prod.id)}"` : ''} style="background-image:url('${esc(b.image_url)}')"></div>`;
      }).join('');
      const dotsHtml = banners.map((_, i) => `<button class="dot${i === 0 ? ' active' : ''}" data-slide="${i}"></button>`).join('');
      const existing = $('#bannerDots');
      if (existing) existing.innerHTML = dotsHtml;
      else bc.insertAdjacentHTML('afterend', `<div class="banner-dots" id="bannerDots">${dotsHtml}</div>`);
    } else {
      bc.innerHTML = '';
      const dots = $('#bannerDots'); if (dots) dots.remove();
    }
  }

  const payTextEl = $('#payText'); if (payTextEl) payTextEl.innerHTML = paras(cfg.payments || DEFAULTS.pay);
  const aboutTextEl = $('#aboutText'); if (aboutTextEl) aboutTextEl.innerHTML = paras(cfg.about || DEFAULTS.about);
}

$('#chips').insertAdjacentHTML('afterend', '<div class="chips sub" id="subchips" hidden></div>');
$('#chips').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { catId = b.dataset.cat; subId = 'all'; render(); } };
$('#subchips').onclick = e => { const b = e.target.closest('[data-sub]'); if (b) { subId = b.dataset.sub; render(); } };
$('#search').oninput = e => { query = e.target.value; render(); };
$('#grid').onclick = e => { const b = e.target.closest('[data-id]'); if (b) openProduct(prods.find(p => p.id === b.dataset.id)); };

function openProduct(p) {
  const msg = `Olá! Quero fazer um pedido:\n*${p.name}*${catPath(p.category_id) ? '\nCategoria: ' + catPath(p.category_id) : ''}\nValor: ${hasPromo(p) ? `de ${brl(p.old_price)} por ${brl(p.price)}` : brl(p.price)}`;
  const m = $('#modal');
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
    <button class="close" aria-label="Fechar">×</button>
    <div class="zoom" title="Toque para ampliar">${pic(p)}</div>
    <div class="body"><h2>${esc(p.name)}</h2><div class="cat">${esc(catPath(p.category_id))}</div>
    <p class="desc">${esc(p.description)}</p>${priceHtml(p, true)}
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
  const tabs = [['produtos', 'Produtos'], ['categorias', 'Categorias'], ['pedidos', 'Pedidos'], ['textos', 'Textos'], ['banners', 'Banners']]
    .map(([k, n]) => `<button class="chip" data-tab="${k}" aria-pressed="${k === tab}">${n}</button>`).join('');
  let body = '';
  if (tab === 'produtos') {
    const p = editing || {};
    body = `<form id="pf"><input type="hidden" name="id" value="${esc(p.id)}">
      <label>Nome<input name="name" required value="${esc(p.name)}"></label>
      <label>Descrição<textarea name="description" rows="3">${esc(p.description)}</textarea></label>
      <label>Preço atual (R$) — deixe vazio para "Consulte o valor"<input name="price" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(p.price)}"></label>
      <label>Preço antigo (R$), opcional — preencha só se estiver em promoção<input name="old_price" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(p.old_price)}"></label>
      <label>Categoria<select name="category_id"><option value="">Sem categoria</option>${catTree().map(c => `<option value="${esc(c.id)}" ${c.id === p.category_id ? 'selected' : ''}>${esc(catPath(c.id))}</option>`).join('')}</select></label>
      <label>Foto${p.image_url ? ' (envie outra para trocar)' : ''}<input name="photo" type="file" accept="image/*" ${p.id ? '' : 'required'}></label>
      <label class="chk"><input name="available" type="checkbox" ${p.available === false ? '' : 'checked'}> Visível na vitrine</label>
      <button class="btn">${p.id ? 'Salvar alterações' : 'Adicionar produto'}</button>
      ${p.id ? '<button class="btn alt" type="button" data-tab="produtos">Cancelar edição</button>' : ''}</form>
      ${prods.map((x, i) => `<div class="row"><div class="mv"><button class="btn alt sm" data-up="${esc(x.id)}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn alt sm" data-dn="${esc(x.id)}" aria-label="Descer" ${i === prods.length - 1 ? 'disabled' : ''}>↓</button></div><img src="${esc(x.image_url)}" alt=""><div class="t"><b>${esc(x.name)}</b><small>${hasPromo(x) ? 'promoção · ' : ''}${brl(x.price)}${x.available === false ? ' · oculto' : ''}</small></div>
      <button class="btn alt sm" data-edit="${esc(x.id)}">Editar</button><button class="btn alt sm" data-del="${esc(x.id)}">Excluir</button></div>`).join('')}`;
  } else if (tab === 'pedidos') {
    body = '<div id="pedlist"><p>Carregando…</p></div>';
  } else if (tab === 'categorias') {
    body = `<form id="cf"><label>Nome<input name="name" required></label><label>Dentro de<select name="parent_id"><option value="">Nenhuma (categoria principal)</option>${cats.filter(c => !c.parent_id).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><button class="btn">Adicionar</button></form>
      ${catTree().map(c => `<div class="row"${c.parent_id ? ' style="padding-left:20px"' : ''}><div class="t"><b>${c.parent_id ? '↳ ' : ''}${esc(c.name)}</b></div><button class="btn alt sm" data-ren="${esc(c.id)}">Renomear</button><button class="btn alt sm" data-delc="${esc(c.id)}">Excluir</button></div>`).join('')}`;
  } else if (tab === 'textos') {
    body = `<form id="tf"><label>Formas de pagamento (uma linha por parágrafo)<textarea name="payments" rows="5">${esc(cfg.payments || DEFAULTS.pay)}</textarea></label>
      <label>Sobre (uma linha por parágrafo)<textarea name="about" rows="6">${esc(cfg.about || DEFAULTS.about)}</textarea></label><button class="btn">Salvar textos</button></form>`;
  } else if (tab === 'banners') {
    body = `<form id="bf"><label>Imagem do banner<input name="image" type="file" accept="image/*" ${!editing ? 'required' : ''}></label>
      <label>Título (opcional)<input name="title" value="${esc(editing?.title || '')}"></label>
      <label>Vincular a produto<select name="link_product_id"><option value="">Nenhum (apenas imagem)</option>${prods.map(p => `<option value="${esc(p.id)}" ${editing?.link_product_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="chk"><input name="active" type="checkbox" ${editing?.active === false ? '' : 'checked'}> Ativo</label>
      <label>Ordem<input name="position" type="number" min="0" value="${esc(editing?.position || 0)}"></label>
      <button class="btn">${editing ? 'Salvar banner' : 'Adicionar banner'}</button>
      ${editing ? '<button class="btn alt" type="button" data-tab="banners">Cancelar</button>' : ''}</form>
      ${banners.map((b, i) => {
        const prod = prods.find(p => p.id === b.link_product_id);
        return `<div class="row"><div class="t"><b>${esc(b.title || 'Sem título')}</b><small>${prod ? '→ ' + esc(prod.name) : 'sem link'}</small></div>
        <img src="${esc(b.image_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;">
        <button class="btn alt sm" data-editb="${esc(b.id)}">Editar</button>
        <button class="btn alt sm" data-delb="${esc(b.id)}">Excluir</button></div>`;
      }).join('')}`;
  }
  adm().innerHTML = `<div class="adm"><h2>Painel da loja</h2><div class="bar">${tabs}<button class="btn alt sm" data-close style="margin-left:auto">Fechar</button><button class="btn alt sm" data-out>Sair</button></div>${body}</div>`;
  bindAdmin(tab);
  if (tab === 'pedidos') loadPedidos();
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
async function uploadBanner(file) {
  const blob = await compress(file), path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
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

let peds = [];
const okUrl = u => typeof u === 'string' && u.startsWith('https://');
async function loadPedidos() {
  const box = $('#pedlist'); if (!box) return;
  const {data, error} = await sb.from('pedidos').select('*').order('created_at', {ascending: false}).limit(100);
  if (error) { box.innerHTML = '<p>Não foi possível carregar os pedidos. Confira se o SQL dos pedidos foi rodado no Supabase.</p>'; return; }
  peds = data || [];
  const lk = (u, t) => okUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>` : '';
  box.innerHTML = peds.length ? peds.map(o => `<div class="row" style="flex-wrap:wrap"><div class="t" style="white-space:normal;flex-basis:100%"><b style="white-space:normal">#${esc(o.id.slice(0, 6).toUpperCase())}${o.nome ? ' · ' + esc(o.nome) : ''}</b><small style="display:block">${new Date(o.created_at).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})} · ${o.status === 'concluido' ? 'concluído' : 'novo'}</small>${o.observacoes ? `<small style="display:block">${esc(o.observacoes)}</small>` : ''}<small style="display:block">${[lk(o.previa_url, 'Prévia'), lk(o.arte_url, 'Arte final'), lk(o.original_url, 'Original')].filter(Boolean).join(' · ')}</small></div><button class="btn alt sm" data-done="${esc(o.id)}">${o.status === 'concluido' ? 'Reabrir' : 'Concluir'}</button><button class="btn alt sm" data-delp="${esc(o.id)}">Excluir</button></div>`).join('') : '<p>Nenhum pedido personalizado ainda.</p>';
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
      else if (d.done) { const o = peds.find(x => x.id === d.done); const u = await sb.from('pedidos').update({status: o && o.status === 'concluido' ? 'novo' : 'concluido'}).eq('id', d.done); if (u.error) throw u.error; loadPedidos(); }
      else if (d.delp && confirm('Excluir este pedido e os arquivos enviados?')) {
        const {data: fs} = await sb.storage.from('pedidos').list(d.delp);
        if (fs && fs.length) await sb.storage.from('pedidos').remove(fs.map(f => `${d.delp}/${f.name}`));
        const dl = await sb.from('pedidos').delete().eq('id', d.delp); if (dl.error) throw dl.error; loadPedidos(); toast('Pedido excluído.');
      }
      else if (d.delc && kidsOf(d.delc).length) toast('Exclua primeiro as subcategorias desta categoria.');
      else if (d.delc && confirm('Excluir categoria? Os produtos dela ficam sem categoria.')) { const r = await sb.from('categories').delete().eq('id', d.delc); if (r.error) throw r.error; refresh('categorias', 'Categoria excluída.'); }
      else if (d.ren) { const n = prompt('Novo nome da categoria:', catName(d.ren)); if (n && n.trim()) { const r = await sb.from('categories').update({name: n.trim()}).eq('id', d.ren); if (r.error) throw r.error; refresh('categorias', 'Categoria renomeada.'); } }
      else if (d.editb) { editingBannerId = d.editb; adminPanel('banners', banners.find(b => b.id === d.editb)); a.scrollTo(0, 0); }
      else if (d.delb && confirm('Excluir este banner?')) { const r = await sb.from('banners').delete().eq('id', d.delb); if (r.error) throw r.error; refresh('banners', 'Banner excluído.'); }
    } catch (err) { fail(err); }
  };
  const pf = $('#pf'), cf = $('#cf'), tf = $('#tf'), bf = $('#bf');
  if (pf) pf.onsubmit = async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('.btn'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const row = {name: f.name.value.trim(), description: f.description.value.trim(), price: f.price.value === '' ? null : Number(f.price.value), old_price: f.old_price.value === '' ? null : Number(f.old_price.value), category_id: f.category_id.value || null, available: f.available.checked};
      if (row.old_price != null && (row.price == null || row.old_price <= row.price)) { toast('O preço antigo precisa ser maior que o preço atual.'); btn.disabled = false; btn.textContent = f.id.value ? 'Salvar alterações' : 'Adicionar produto'; return; }
      if (f.photo.files[0]) row.image_url = await upload(f.photo.files[0]);
      if (!f.id.value) row.position = Math.max(0, ...prods.map(p => p.position || 0)) + 1;
      const r = f.id.value ? await sb.from('products').update(row).eq('id', f.id.value) : await sb.from('products').insert(row);
      if (r.error) throw r.error;
      refresh('produtos', 'Produto salvo.');
    } catch (err) { fail(err); btn.disabled = false; btn.textContent = 'Tentar de novo'; }
  };
  if (cf) cf.onsubmit = async e => {
    e.preventDefault();
    const r = await sb.from('categories').insert({name: e.target.name.value.trim(), position: cats.length + 1, parent_id: e.target.parent_id.value || null});
    r.error ? fail(r.error) : refresh('categorias', 'Categoria adicionada.');
  };
  if (tf) tf.onsubmit = async e => {
    e.preventDefault();
    const r = await sb.from('settings').upsert([{key: 'payments', value: e.target.payments.value}, {key: 'about', value: e.target.about.value}]);
    r.error ? fail(r.error) : refresh('textos', 'Textos salvos.');
  };
  if (bf) bf.onsubmit = async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('.btn'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const row = {title: f.title.value.trim() || null, link_product_id: f.link_product_id.value || null, active: f.active.checked, position: Number(f.position.value) || 0};
      if (f.image.files[0]) row.image_url = await uploadBanner(f.image.files[0]);
      if (!editingBannerId) {
        const r = await sb.from('banners').insert({...row, position: banners.length + 1});
        if (r.error) throw r.error;
      } else {
        const r = await sb.from('banners').update(row).eq('id', editingBannerId);
        if (r.error) throw r.error;
      }
      editingBannerId = null;
      refresh('banners', 'Banner salvo.');
    } catch (err) { fail(err); btn.disabled = false; btn.textContent = 'Tentar de novo'; }
  };
}

/* ---------- Carousel ---------- */
let bannerIdx = 0, bannerTimer;
function showBanner(i) {
  bannerIdx = (i + banners.length) % banners.length;
  document.querySelectorAll('.banner-slide').forEach((s, idx) => s.classList.toggle('active', idx === bannerIdx));
  document.querySelectorAll('.dot').forEach((d, idx) => d.classList.toggle('active', idx === bannerIdx));
}
function startBannerTimer() {
  if (bannerTimer) clearInterval(bannerTimer);
  bannerTimer = setInterval(() => showBanner(bannerIdx + 1), 5000);
}
function stopBannerTimer() { if (bannerTimer) clearInterval(bannerTimer); }

document.body.addEventListener('click', e => {
  const slide = e.target.closest('.banner-slide');
  if (slide) {
    const pid = slide.dataset.product;
    if (pid) {
      const p = prods.find(x => x.id === pid);
      if (p) openProduct(p);
    }
  }
  const dot = e.target.closest('.dot');
  if (dot) {
    showBanner(Number(dot.dataset.slide));
    stopBannerTimer();
    startBannerTimer();
  }
});

const hp = document.querySelector('.hero p');
if (hp) hp.insertAdjacentHTML('afterend', '<a class="btn" href="monte.html" style="display:inline-flex;width:auto;padding:12px 28px;margin-top:20px">Monte a sua caneca</a>');
const ft = document.querySelector('footer');
if (ft) ft.insertAdjacentHTML('afterbegin', '<a href="monte.html">Monte a sua caneca</a>');

load();
startBannerTimer();
