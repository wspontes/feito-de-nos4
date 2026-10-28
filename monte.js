const C = window.CONFIG || {};
const sb = (C.SUPABASE_URL && window.supabase) ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
const $ = s => document.querySelector(s);

/* ===== AJUSTES — edite aqui quando tiver a foto da caneca branca ===== */
const AREA_W_CM = 20, AREA_H_CM = 9.5;   // área de impressão da caneca de 325 ml
const FRONT_U = 0.5;                      // ponto da arte (0 a 1) que fica no centro da frente da caneca
const MOCK = {                           // imagem das 3 canecas brancas e os mapas de onde a arte aparece
  base: 'assets/canecas-brancas.jpg',     // foto das canecas brancas (esquerda, meio, direita)
  uv: 'assets/canecas-uv.png',            // mapa de posição da arte (gerado para esta foto)
  mask: 'assets/canecas-mask.png',        // máscara do corpo das canecas (sem a alça)
  centers: [.25, .5, .75],                // parte da arte que fica no centro de cada caneca (0 a 1)
  splits: [600, 920]                      // x onde termina a caneca da esquerda e a do meio (px da foto)
};
const MAX_FILE = 8 * 1024 * 1024;         // acima disso a original é reduzida antes de enviar
/* ===================================================================== */

const st = {img: null, file: null, x: .5, y: .5, sw: 1, rot: 0, turn: FRONT_U};
const EW = 1200, EH = Math.round(EW * AREA_H_CM / AREA_W_CM);
const edit = $('#edit'), ectx = edit.getContext('2d'); edit.width = EW; edit.height = EH;
const mock = $('#mock'), mctx = mock.getContext('2d');
const flat = document.createElement('canvas'); flat.width = 1200; flat.height = Math.round(1200 * AREA_H_CM / AREA_W_CM);

const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3500); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function drawArt(ctx, W, H, guides) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  if (st.img) {
    ctx.save(); ctx.translate(st.x * W, st.y * H); ctx.rotate(st.rot * Math.PI / 180);
    const k = st.sw * W / st.img.width; ctx.scale(k, k); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(st.img, -st.img.width / 2, -st.img.height / 2); ctx.restore();
  }
  if (!guides) return;
  const a = clamp(FRONT_U - .25, 0, 1) * W, b = clamp(FRONT_U + .25, 0, 1) * W;
  ctx.fillStyle = 'rgba(94,100,70,.14)'; ctx.fillRect(0, 0, a, H); ctx.fillRect(b, 0, W - b, H);
  ctx.strokeStyle = 'rgba(94,100,70,.55)'; ctx.lineWidth = 2; ctx.setLineDash([14, 10]);
  ctx.strokeRect(.5 / AREA_W_CM * W, .5 / AREA_H_CM * H, W - 1 / AREA_W_CM * W, H - 1 / AREA_H_CM * H);
  ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(a, H); ctx.moveTo(b, 0); ctx.lineTo(b, H); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(74,63,54,.7)'; ctx.font = '500 26px Jost, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('FRENTE', (a + b) / 2, 42); ctx.fillText('VOLTA', a / 2, 42); ctx.fillText('VOLTA', (b + W) / 2, 42);
}

const drawFlat = () => drawArt(flat.getContext('2d'), flat.width, flat.height, false);
let MP = null, mockT = 0;
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
Promise.all([MOCK.base, MOCK.uv, MOCK.mask].map(loadImg)).then(([b, uv, mk]) => {
  const w = b.naturalWidth, h = b.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', {willReadFrequently: true});
  const read = im => { g.clearRect(0, 0, w, h); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data; };
  const U = read(uv), K = read(mk), Bd = read(b), list = [];
  for (let p = 0; p < w * h; p++) if (K[p * 4]) list.push(p);
  const N = list.length, idx = Int32Array.from(list), du = new Float32Array(N), vv = new Float32Array(N), mm = new Float32Array(N), sh = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const p = idx[k], x = p % w, th = ((U[p * 4] * 256 + U[p * 4 + 1]) / 65535 - .5) * Math.PI;
    du[k] = MOCK.centers[x < MOCK.splits[0] ? 0 : x < MOCK.splits[1] ? 1 : 2] + th / (2 * Math.PI);
    vv[k] = U[p * 4 + 2] / 254; mm[k] = K[p * 4] / 255; sh[k] = 1 - .26 * Math.pow(Math.abs(Math.sin(th)), 2.6);
  }
  mock.width = w; mock.height = h; mctx.putImageData(new ImageData(Bd, w, h), 0, 0);
  MP = {idx, du, vv, mm, sh, base: Bd, out: mctx.createImageData(w, h)};
  if (st.img) queueMock();
}).catch(() => toast('Não consegui carregar a imagem das canecas.'));

function queueMock() { if (!mockT) mockT = setTimeout(() => { mockT = 0; drawFlat(); drawMock(); }, 60); }

function drawMock() {
  if (!MP || !st.img) return;
  const {idx, du, vv, mm, sh, base, out} = MP, o = out.data, fw = flat.width, fh = flat.height;
  o.set(base);
  const f = flat.getContext('2d').getImageData(0, 0, fw, fh).data;
  for (let k = 0; k < idx.length; k++) {
    const u = du[k] - Math.floor(du[k]), fx = u * fw, fy = vv[k] * (fh - 1), ix = Math.floor(fx), y0 = Math.floor(fy);
    const x0 = ix % fw, x1 = (ix + 1) % fw, y1 = Math.min(fh - 1, y0 + 1), tx = fx - ix, ty = fy - y0;
    const a = (y0 * fw + x0) * 4, b = (y0 * fw + x1) * 4, c = (y1 * fw + x0) * 4, d = (y1 * fw + x1) * 4;
    const w0 = (1 - tx) * (1 - ty), w1 = tx * (1 - ty), w2 = (1 - tx) * ty, w3 = tx * ty, p = idx[k] * 4, m = mm[k], s = sh[k];
    for (let ch = 0; ch < 3; ch++) {
      const art = f[a + ch] * w0 + f[b + ch] * w1 + f[c + ch] * w2 + f[d + ch] * w3;
      o[p + ch] = base[p + ch] * (1 - m) + base[p + ch] * art / 255 * s * m;
    }
  }
  mctx.putImageData(out, 0, 0);
}

mock.onclick = () => {
  if (!st.img) return;
  const d = document.createElement('div'); d.className = 'lb';
  d.innerHTML = `<img alt="Prévia ampliada" src="${mock.toDataURL('image/jpeg', .92)}">`; d.onclick = () => d.remove(); document.body.append(d);
};

function quality() {
  if (!st.img) return;
  const dpi = st.img.naturalWidth / (st.sw * AREA_W_CM / 2.54);
  const [c, t] = dpi >= 200 ? ['ok', 'Qualidade ótima para impressão.'] : dpi >= 130 ? ['ok', 'Qualidade boa para impressão.']
    : dpi >= 80 ? ['mid', 'Qualidade regular: pode ficar um pouco borrada.'] : ['low', 'Qualidade baixa: pode sair borrada. Use uma imagem maior ou diminua o tamanho.'];
  $('#qual').className = 'qual ' + c; $('#qual').textContent = t;
}
function renderAll() {
  drawArt(ectx, EW, EH, true); quality(); queueMock();
  $('#size').value = Math.log(st.sw / .05) / Math.log(60) * 100; $('#rot').value = st.rot;
}
const setSw = v => { st.sw = clamp(v, .05, 3); };
const ratio = () => (EH * st.img.width) / (EW * st.img.height);
const fit = () => { setSw(Math.min(1, ratio())); st.x = st.y = .5; };

$('#size').oninput = e => { setSw(.05 * Math.pow(60, e.target.value / 100)); renderAll(); };
$('#rot').oninput = e => { st.rot = +e.target.value; renderAll(); };
$('#fit').onclick = () => { fit(); renderAll(); };
$('#fill').onclick = () => { setSw(Math.max(1, ratio())); st.x = st.y = .5; renderAll(); };
$('#center').onclick = () => { st.x = st.y = .5; renderAll(); };
$('#r90').onclick = () => { st.rot = (st.rot + 90 + 180) % 360 - 180; renderAll(); };
$('#change').onclick = () => $('#file').click();

const ptrs = new Map(); let pinch = null;
edit.addEventListener('pointerdown', e => {
  edit.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), sw: st.sw}; }
});
edit.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p || !st.img) return;
  const r = edit.getBoundingClientRect();
  if (ptrs.size === 1) { st.x += (e.clientX - p.x) / r.width; st.y += (e.clientY - p.y) / r.height; }
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; setSw(pinch.sw * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d); }
  renderAll();
});
['pointerup', 'pointercancel'].forEach(n => edit.addEventListener(n, e => { ptrs.delete(e.pointerId); pinch = null; }));
edit.addEventListener('wheel', e => { e.preventDefault(); if (st.img) { setSw(st.sw * Math.exp(-e.deltaY * .0015)); renderAll(); } }, {passive: false});

$('#file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return toast('Use uma imagem JPG, PNG ou WebP.');
  const img = new Image();
  img.onload = () => { st.img = img; st.file = f; st.rot = 0; fit(); $('#drop').hidden = true; $('#work').hidden = false; renderAll(); };
  img.onerror = () => toast('Não consegui abrir essa imagem. Tente outra.');
  img.src = URL.createObjectURL(f); e.target.value = '';
};

const blobOf = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));
async function shrink() {
  const k = Math.min(1, 4000 / Math.max(st.img.width, st.img.height)), c = document.createElement('canvas');
  c.width = Math.round(st.img.width * k); c.height = Math.round(st.img.height * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(st.img, 0, 0, c.width, c.height);
  return blobOf(c, 'image/jpeg', .88);
}
async function sendFiles(id, arte, previa, nome, obs) {
  const orig = st.file.size > MAX_FILE ? await shrink() : st.file;
  const ext = {'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'}[orig.type] || 'jpg';
  const up = async (name, b, type) => {
    const {error} = await sb.storage.from('pedidos').upload(`${id}/${name}`, b, {contentType: type});
    if (error) throw error; return sb.storage.from('pedidos').getPublicUrl(`${id}/${name}`).data.publicUrl;
  };
  const [original_url, arte_url, previa_url] = await Promise.all([up(`original.${ext}`, orig, orig.type), up('arte-final.jpg', arte, 'image/jpeg'), up('previa.jpg', previa, 'image/jpeg')]);
  const {error} = await sb.from('pedidos').insert({id, nome: nome || null, observacoes: obs || null, original_url, arte_url, previa_url});
  if (error) throw error;
  return {original: original_url, arte: arte_url, previa: previa_url};
}

$('#order').onclick = async () => {
  if (!st.img || $('#site').value) return;
  const btn = $('#order'); btn.disabled = true; btn.textContent = 'Preparando seu pedido…';
  const id = crypto.randomUUID(), code = id.slice(0, 6).toUpperCase();
  const nome = $('#nome').value.trim().slice(0, 80), obs = $('#obs').value.trim().slice(0, 600);
  const fc = document.createElement('canvas'); fc.width = 2362; fc.height = Math.round(2362 * AREA_H_CM / AREA_W_CM);
  drawArt(fc.getContext('2d'), fc.width, fc.height, false);
  const snap = document.createElement('canvas'); snap.width = mock.width; snap.height = mock.height;
  const sx = snap.getContext('2d'); sx.fillStyle = '#F6EFE3'; sx.fillRect(0, 0, snap.width, snap.height); sx.drawImage(mock, 0, 0);
  const arte = await blobOf(fc, 'image/jpeg', .92), previa = await blobOf(snap, 'image/jpeg', .85);
  let links = null;
  try { if (!sb) throw new Error('sem supabase'); links = await sendFiles(id, arte, previa, nome, obs); } catch (err) { console.error(err); }
  let msg = `Olá! Quero encomendar uma caneca personalizada (325 ml).\nPedido: ${code}` + (nome ? `\nNome: ${nome}` : '') + (obs ? `\nObservações: ${obs}` : '');
  if (links) msg += `\n\nPrévia: ${links.previa}\nArte final (20 x 9,5 cm): ${links.arte}\nImagem original: ${links.original}`;
  else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(arte); a.download = `arte-caneca-${code}.jpg`; a.click();
    msg += '\n\n(Não consegui enviar a arte automaticamente. Vou anexar a imagem aqui na conversa.)';
  }
  const url = `https://wa.me/${C.WHATSAPP || '558391685057'}?text=${encodeURIComponent(msg)}`;
  const d = $('#done'); d.hidden = false;
  d.innerHTML = links ? '<strong>Pedido pronto!</strong><span>Abrindo o WhatsApp com a sua arte…</span>'
    : '<strong>Quase lá!</strong><span>Não consegui enviar a arte automaticamente. Ela foi baixada no seu aparelho: anexe a imagem na conversa do WhatsApp.</span>';
  d.insertAdjacentHTML('beforeend', `<a class="btn" href="${url}" target="_blank" rel="noopener">Abrir WhatsApp</a>`);
  btn.disabled = false; btn.textContent = 'Encomendar pelo WhatsApp';
  d.scrollIntoView({behavior: 'smooth', block: 'center'});
  if (links) setTimeout(() => { location.href = url; }, 900);
};
