const C = window.CONFIG || {};
const sb = (C.SUPABASE_URL && window.supabase) ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
const $ = s => document.querySelector(s);

/* ===== AJUSTES ===== */
const AREA_W_CM = 20, AREA_H_CM = 9.5;   // área de impressão da caneca de 325 ml
const MAX_FILE = 8 * 1024 * 1024;         // acima disso a original é reduzida antes de enviar

const MUG_3 = {
  image: 'assets/caneca-3visoes.png',     // imagem com 3 canecas lado a lado
  width: 1500,                            // largura da imagem (ajuste se necessário)
  height: 1000                            // altura da imagem (ajuste se necessário)
};
/* =================== */

const st = {img: null, file: null, x: .5, y: .5, sw: 1, rot: 0};
const EW = 1200, EH = Math.round(EW * AREA_H_CM / AREA_W_CM);
const edit = $('#edit'), ectx = edit.getContext('2d'); edit.width = EW; edit.height = EH;
const viewsCanvas = document.createElement('canvas');
viewsCanvas.width = MUG_3.width; viewsCanvas.height = MUG_3.height;
const vctx = viewsCanvas.getContext('2d');

const mugImg = new Image(); mugImg.src = MUG_3.image;

const flatCanvas = document.createElement('canvas');
flatCanvas.width = EW; flatCanvas.height = EH;
const fctx = flatCanvas.getContext('2d');

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
  const a = clamp(0.5 - .25, 0, 1) * W, b = clamp(0.5 + .25, 0, 1) * W;
  ctx.fillStyle = 'rgba(94,100,70,.14)'; ctx.fillRect(0, 0, a, H); ctx.fillRect(b, 0, W - b, H);
  ctx.strokeStyle = 'rgba(94,100,70,.55)'; ctx.lineWidth = 2; ctx.setLineDash([14, 10]);
  ctx.strokeRect(.5 / AREA_W_CM * W, .5 / AREA_H_CM * H, W - 1 / AREA_W_CM * W, H - 1 / AREA_H_CM * H);
  ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(a, H); ctx.moveTo(b, 0); ctx.lineTo(b, H); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(74,63,54,.7)'; ctx.font = '500 26px Jost, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('FRENTE', (a + b) / 2, 42); ctx.fillText('VOLTA', a / 2, 42); ctx.fillText('VOLTA', (b + W) / 2, 42);
}

function drawViews() {
  vctx.clearRect(0, 0, viewsCanvas.width, viewsCanvas.height);
  if (!mugImg.complete || !mugImg.naturalWidth) return;
  
  // Desenha a imagem de fundo (3 canecas)
  vctx.drawImage(mugImg, 0, 0, viewsCanvas.width, viewsCanvas.height);
  
  if (!st.img) return;
  
  // Divide a imagem em 3 colunas iguais e desenha a arte em cada uma
  const colW = viewsCanvas.width / 3;
  const marginX = colW * 0.10;   // margem lateral dentro de cada coluna
  const marginY = viewsCanvas.height * 0.12; // margem superior/inferior
  
  vctx.save();
  vctx.globalCompositeOperation = 'multiply';
  
  for (let i = 0; i < 3; i++) {
    const cx = i * colW + colW / 2;
    const drawW = colW - marginX * 2;
    const drawH = drawW * (EH / EW); // mantém proporção da arte
    
    const dx = cx - drawW / 2;
    const dy = marginY;
    
    vctx.drawImage(flatCanvas, dx, dy, drawW, drawH);
  }
  
  vctx.globalCompositeOperation = 'source-over';
  vctx.restore();
}

function renderAll() {
  drawArt(ectx, EW, EH, true);
  drawArt(fctx, EW, EH, false);
  drawViews();
  quality();

  // Atualiza o canvas de prévia no HTML
  const mock = $('#mock');
  if (mock) {
    const mctx = mock.getContext('2d');
    mctx.clearRect(0, 0, mock.width, mock.height);
    mctx.drawImage(viewsCanvas, 0, 0, mock.width, mock.height);
  }

  $('#size').value = Math.log(st.sw / .05) / Math.log(60) * 100; $('#rot').value = st.rot;
}

function quality() {
  if (!st.img) return;
  const dpi = st.img.naturalWidth / (st.sw * AREA_W_CM / 2.54);
  const [c, t] = dpi >= 200 ? ['ok', 'Qualidade ótima para impressão.'] : dpi >= 130 ? ['ok', 'Qualidade boa para impressão.']
    : dpi >= 80 ? ['mid', 'Qualidade regular: pode ficar um pouco borrada.'] : ['low', 'Qualidade baixa: pode sair borrada. Use uma imagem maior ou diminua o tamanho.'];
  $('#qual').className = 'qual ' + c; $('#qual').textContent = t;
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
  img.onload = () => { st.img = img; st.file = f; st.rot = 0; st.x = st.y = .5; fit(); $('#drop').hidden = true; $('#work').hidden = false; renderAll(); };
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
  const snap = document.createElement('canvas'); snap.width = viewsCanvas.width; snap.height = viewsCanvas.height;
  const sx = snap.getContext('2d'); sx.fillStyle = '#F6EFE3'; sx.fillRect(0, 0, snap.width, snap.height); sx.drawImage(viewsCanvas, 0, 0);
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
