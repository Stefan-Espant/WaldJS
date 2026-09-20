/* Start altijd bovenaan bij (hard) verversen en houd de URL vrij van #ankers */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash){
  history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo(0, 0);
}
/* Soepel scrollen naar secties zonder dat de anker in de URL komt */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const doel = document.querySelector(a.getAttribute('href'));
  if (doel){ e.preventDefault(); doel.scrollIntoView({ behavior:'smooth' }); }
});

function zetTaal(t){
  document.documentElement.dataset.lang = t;
  document.documentElement.lang = t;
  document.getElementById('btn-nl').classList.toggle('actief', t==='nl');
  document.getElementById('btn-en').classList.toggle('actief', t==='en');
  try { localStorage.setItem('wald-taal', t); } catch(e){}
}
try {
  const bewaard = localStorage.getItem('wald-taal');
  if (bewaard === 'nl' || bewaard === 'en') zetTaal(bewaard);
} catch(e){}

function toggleMenu(open){
  const menu = document.getElementById('mobielmenu');
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
}

/* ============================================================
   Procedurele varens — botanische decoratie
   ============================================================ */
(function(){
  const NS = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('svg.varen').forEach(svg => {
    svg.setAttribute('viewBox', '0 0 200 300');
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke-linecap', 'round');
    // hoofdstam
    const stam = document.createElementNS(NS, 'path');
    stam.setAttribute('d', 'M100 300 C 96 220, 110 140, 94 24');
    stam.setAttribute('stroke', '#7FD8BE');
    stam.setAttribute('stroke-width', '3');
    g.appendChild(stam);
    // bladveren langs de stam
    const N = 16;
    for (let i = 0; i < N; i++){
      const t = i / (N - 1);
      const y = 292 - t * 258;
      const x = 100 + Math.sin(t * 3.1) * 7 - t * 4;
      const len = 54 * (1 - t * 0.82) + 6;
      [-1, 1].forEach(kant => {
        const p = document.createElementNS(NS, 'path');
        const ex = x + kant * len * 0.95;
        const ey = y - len * (0.35 + t * 0.3);
        p.setAttribute('d', `M${x} ${y} Q ${x + kant * len * 0.55} ${y - len * 0.1}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
        p.setAttribute('stroke', i % 2 ? '#7FD8BE' : '#4FAE8F');
        p.setAttribute('stroke-width', (2.4 - t * 1.3).toFixed(2));
        g.appendChild(p);
        // kleine zijblaadjes
        const zb = document.createElementNS(NS, 'path');
        const mx = x + kant * len * 0.45, my = y - len * 0.12;
        zb.setAttribute('d', `M${mx.toFixed(1)} ${my.toFixed(1)} l ${(kant * len * 0.18).toFixed(1)} ${(-len * 0.28).toFixed(1)}`);
        zb.setAttribute('stroke', '#3E9578');
        zb.setAttribute('stroke-width', (1.6 - t * 0.9).toFixed(2));
        g.appendChild(zb);
      });
    }
    svg.appendChild(g);
  });
  // zachte wuif
  if (typeof gsap !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    gsap.utils.toArray('svg.varen').forEach((v, i) => {
      gsap.to(v, { rotation: 2.5, transformOrigin: '50% 100%', duration: 2.8 + i * 0.4,
        yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.3 });
    });
  }
})();

/* ============================================================
   Kopieerknoppen op codeblokken
   ============================================================ */
(function(){
  document.querySelectorAll('.codeblok').forEach(blok => {
    if (blok.classList.contains('terminal') || blok.querySelector('.pg-editor')) return;
    const titel = blok.querySelector('.titel');
    const pre = blok.querySelector('pre');
    if (!titel || !pre) return;
    const knop = document.createElement('button');
    knop.className = 'kopieer';
    const label = '<span class="nl">Kopieer</span><span class="en">Copy</span>';
    knop.innerHTML = label;
    knop.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.innerText).then(() => {
        knop.classList.add('ok');
        knop.textContent = '✓';
        setTimeout(() => { knop.classList.remove('ok'); knop.innerHTML = label; }, 1500);
      });
    });
    titel.appendChild(knop);
  });
})();

/* ============================================================
   Terminal-animatie in de hero
   ============================================================ */
(function(){
  const cmdEl = document.getElementById('term-tekst');
  const uitEl = document.getElementById('term-uit');
  if (!cmdEl || !uitEl) return;
  const cmd = 'wald plant my-forest';
  const regels = [
    '🌱  Planting forest in ./my-forest',
    '🌲  4 trees · 2 branches · 1 canopy',
    '✓   Done in 0.4s — happy growing!'
  ];
  let i = 0, r = 0;
  function tik(){
    cmdEl.textContent = '$ ' + cmd.slice(0, i);
    if (i <= cmd.length){ i++; setTimeout(tik, 50 + Math.random() * 75); }
    else setTimeout(toon, 500);
  }
  function toon(){
    if (r < regels.length){
      uitEl.textContent += regels[r] + '\n';
      r++; setTimeout(toon, 430);
    }
  }
  setTimeout(tik, 1400);
})();

/* ============================================================
   Playground — mini .wald-compiler
   ============================================================ */
(function(){
  const editor = document.getElementById('pg-editor');
  const preview = document.getElementById('pg-preview');
  if (!editor || !preview) return;
  editor.value = `---
const titel = "Mijn eerste boom"
const soorten = ["eik", "beuk", "den"]
---
<h1>{titel}</h1>
<p>Er groeien {soorten.length} soorten in dit bos:</p>
<ul>
  {soorten.map(s => '<li>' + s + '</li>').join('')}
</ul>`;
  function compileer(bron){
    let fm = '', tpl = bron;
    const delen = bron.split(/^---\s*$/m);
    if (delen.length >= 3){ fm = delen[1]; tpl = delen.slice(2).join('---'); }
    const vars = {};
    try {
      const code = fm.replace(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, 'vars.$1 =');
      new Function('vars', code)(vars);
    } catch(e){
      return '<p style="color:#FF3347;font-family:monospace">Frontmatter: ' + e.message + '</p>';
    }
    return tpl.replace(/\{([^{}]+)\}/g, (m, expr) => {
      try { return String(new Function('vars', 'with(vars){ return (' + expr + ') }')(vars)); }
      catch(e){ return '<code style="color:#FF3347">{' + expr + '}</code>'; }
    });
  }
  function ververs(){ preview.innerHTML = compileer(editor.value); }
  editor.addEventListener('input', ververs);
  ververs();
})();

/* ============================================================
   Groeibalk + scrim (scroll-voortgang & leesbaarheid)
   ============================================================ */
(function(){
  const balk = document.getElementById('groeibalk');
  const blad = document.getElementById('groeiblad');
  const scrim = document.getElementById('scrim');
  function update(){
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? h.scrollTop / max : 0;
    if (balk) balk.style.width = (p * 100) + '%';
    if (blad){
      blad.style.left = (p * 100) + 'vw';
      blad.style.opacity = p > 0.004 ? 1 : 0;
    }
    // overlay wordt zichtbaar zodra je voorbij de hero scrolt
    if (scrim){
      const heroH = window.innerHeight;
      scrim.style.opacity = Math.min(1, Math.max(0, (h.scrollTop - heroH * 0.35) / (heroH * 0.55)));
    }
  }
  document.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

/* ============================================================
   Cursor-vuurvliegje in de hero
   ============================================================ */
(function(){
  const vlieg = document.getElementById('cursorvlieg');
  const hero = document.querySelector('header');
  if (!vlieg || !hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my;
  window.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    const r = hero.getBoundingClientRect();
    vlieg.style.opacity = (e.clientY < r.bottom && r.bottom > 0) ? 1 : 0;
  });
  (function volg(){
    x += (mx - x) * 0.1;
    y += (my - y) * 0.1;
    const t = performance.now() / 1000;
    vlieg.style.transform = 'translate(' + (x + Math.sin(t * 3) * 7 - 6) + 'px,' + (y + Math.cos(t * 2.2) * 7 - 6) + 'px)';
    requestAnimationFrame(volg);
  })();
})();

/* ============================================================
   GitHub-stats (live uit de API, faalt stil)
   ============================================================ */
(function(){
  const el = document.getElementById('gh-stats');
  if (!el || !window.fetch) return;
  fetch('https://api.github.com/repos/Stefan-Espant/WaldJS')
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d) return;
      document.getElementById('gh-sterren').textContent = d.stargazers_count;
      document.getElementById('gh-forks').textContent = d.forks_count;
      el.classList.add('zichtbaar');
    })
    .catch(() => {});
})();

/* ============================================================
   Ambient bosgeluid — progressive enhancement
   Gesynthetiseerd met Web Audio: wind, krekels (nacht),
   vogels (dag) en af en toe een koekoek. Standaard uit.
   ============================================================ */
(function(){
  const knop = document.getElementById('btn-geluid');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!knop) return;
  if (!AC){ knop.style.display = 'none'; return; } // progressive enhancement
  let ctx = null, meester = null, aan = false;
  const dag = () => (window.WaldDag ? window.WaldDag.v : 0);

  function zorgVoorCtx(){
    if (ctx) return;
    ctx = new AC();
    meester = ctx.createGain();
    meester.gain.value = 0;
    meester.connect(ctx.destination);

    /* wind: geluste bruine ruis door een lowpass, met trage vlagen */
    const duurS = 3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duurS, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < data.length; i++){
      v = v * 0.985 + (Math.random() * 2 - 1) * 0.03;
      data[i] = v * 2.5;
    }
    const bron = ctx.createBufferSource();
    bron.buffer = buf; bron.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 320; filt.Q.value = 0.4;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.06;
    bron.connect(filt); filt.connect(windGain); windGain.connect(meester);
    bron.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain); lfoGain.connect(windGain.gain);
    lfo.start();

    krekelLus(); vogelLus(); koekoekLus();
  }

  /* hulpjes */
  function piep(t0, f0, f1, duur, vol, type){
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + duur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + duur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duur);
    o.connect(g); g.connect(meester);
    o.start(t0); o.stop(t0 + duur + 0.05);
  }

  /* krekels — alleen 's nachts */
  function krekelLus(){
    if (aan){
      const sterkte = (1 - dag());
      if (sterkte > 0.15){
        const n = 5 + Math.floor(Math.random() * 7);
        const basis = 4100 + Math.random() * 500;
        for (let i = 0; i < n; i++){
          piep(ctx.currentTime + i * 0.048, basis, basis * 0.97, 0.035, 0.028 * sterkte, 'triangle');
        }
      }
    }
    setTimeout(krekelLus, 600 + Math.random() * 1800);
  }

  /* vogels — alleen overdag */
  function vogelLus(){
    if (aan && dag() > 0.3){
      const n = 2 + Math.floor(Math.random() * 4);
      let t0 = ctx.currentTime;
      for (let i = 0; i < n; i++){
        const f = 2200 + Math.random() * 1400;
        piep(t0, f, f * (0.7 + Math.random() * 0.5), 0.09 + Math.random() * 0.08, 0.035 * dag(), 'sine');
        t0 += 0.12 + Math.random() * 0.1;
      }
    }
    setTimeout(vogelLus, 2500 + Math.random() * 5000);
  }

  /* de koekoek — af en toe, dag én nacht (maar zachter in het donker) */
  function koekoekLus(){
    if (aan){
      const vol = 0.05 * (0.4 + 0.6 * dag());
      const t0 = ctx.currentTime + 0.1;
      piep(t0, 740, 720, 0.28, vol, 'sine');          // "koe-"
      piep(t0 + 0.42, 590, 575, 0.34, vol, 'sine');    // "-koek"
      // soms twee keer
      if (Math.random() < 0.4){
        piep(t0 + 1.15, 740, 720, 0.28, vol * 0.8, 'sine');
        piep(t0 + 1.57, 590, 575, 0.34, vol * 0.8, 'sine');
      }
    }
    setTimeout(koekoekLus, 18000 + Math.random() * 30000);
  }

  window.zetGeluid = function(){
    zorgVoorCtx();
    if (ctx.state === 'suspended') ctx.resume();
    aan = !aan;
    knop.textContent = aan ? '🔊' : '🔇';
    const nu = ctx.currentTime;
    meester.gain.cancelScheduledValues(nu);
    meester.gain.setValueAtTime(meester.gain.value, nu);
    meester.gain.linearRampToValueAtTime(aan ? 0.5 : 0, nu + 1.2);
  };
})();
