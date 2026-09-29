/* Start altijd bovenaan bij een harde refresh en houd de URL dan vrij van
   #ankers — maar laat een binnenkomende hash van een echte cross-page
   navigatie (bv. vanaf /changelog naar /#quickstart) gewoon normaal scrollen,
   anders werkt de nav/footer-anker-fix niet. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash){
  const nav = performance.getEntriesByType('navigation')[0];
  const isHardRefresh = nav ? nav.type === 'reload' : true; // conservatieve fallback als de API ontbreekt
  if (isHardRefresh){
    const cleanUrl = location.pathname + location.search;
    const scrollToTop = () => window.scrollTo(0, 0);
    history.replaceState(null, '', cleanUrl);
    scrollToTop();
    // history.scrollRestoration='manual' voorkomt de restauratie niet altijd op tijd
    // bij een harde refresh — Chrome herstelt de oude scrollpositie soms nog een
    // paar frames later. Herhaal de reset daarom een tijdje via rAF om die late,
    // niet van ons komende scrollTo altijd te overschrijven.
    const end = performance.now() + 800;
    (function stayAtTop(){
      scrollToTop();
      if (performance.now() < end) requestAnimationFrame(stayAtTop);
    })();
    // { once: true }: dit mag alleen de late restauratie van DEZE harde
    // refresh opvangen — niet een latere pageshow (bv. bfcache-restore na
    // "terug" in de browser), anders resetten we dan onterecht ook.
    window.addEventListener('pageshow', scrollToTop, { once: true });
  }
}
/* Soepel scrollen naar secties zonder dat de anker in de URL komt */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (target){ e.preventDefault(); target.scrollIntoView({ behavior:'smooth' }); }
});

function setLanguage(t){
  document.documentElement.dataset.lang = t;
  document.documentElement.lang = t;
  document.getElementById('btn-nl').classList.toggle('active', t==='nl');
  document.getElementById('btn-en').classList.toggle('active', t==='en');
  try { localStorage.setItem('wald-taal', t); } catch(e){}
}
try {
  // Pagina's met een vaste taal (de blog) negeren de bewaarde voorkeur en
  // onthouden juist hun eigen taal, zodat de rest van de site daarna meegaat.
  const fixedLang = document.documentElement.dataset.langFixed;
  if (fixedLang === 'nl' || fixedLang === 'en') localStorage.setItem('wald-taal', fixedLang);
  else {
    const savedLang = localStorage.getItem('wald-taal');
    if (savedLang === 'nl' || savedLang === 'en') setLanguage(savedLang);
  }
} catch(e){}

let previousFocusBeforeMenu = null;

function toggleMenu(open){
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  // inert voorkomt dat links/knoppen in het gesloten menu nog met Tab
  // bereikbaar zijn — anders staat aria-hidden op een element met
  // focusbare kinderen, wat screenreaders inconsistent afhandelen.
  menu.toggleAttribute('inert', !open);
  if (open){
    previousFocusBeforeMenu = document.activeElement;
    const closeButton = menu.querySelector('.close');
    if (closeButton) closeButton.focus();
    document.addEventListener('keydown', trapFocusInMenu);
  } else {
    document.removeEventListener('keydown', trapFocusInMenu);
    if (previousFocusBeforeMenu && typeof previousFocusBeforeMenu.focus === 'function') previousFocusBeforeMenu.focus();
  }
}

function trapFocusInMenu(e){
  if (e.key === 'Escape'){
    toggleMenu(false);
    return;
  }
  if (e.key !== 'Tab') return;
  const menu = document.getElementById('mobile-menu');
  const focusable = Array.from(menu.querySelectorAll('a, button'));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first){
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last){
    e.preventDefault();
    first.focus();
  }
}

/* ============================================================
   Procedural ferns — botanical decoration
   ============================================================ */
(function(){
  const NS = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('svg.fern').forEach(svg => {
    svg.setAttribute('viewBox', '0 0 200 300');
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke-linecap', 'round');
    // hoofdstam
    const stem = document.createElementNS(NS, 'path');
    stem.setAttribute('d', 'M100 300 C 96 220, 110 140, 94 24');
    stem.setAttribute('stroke', '#7FD8BE');
    stem.setAttribute('stroke-width', '3');
    g.appendChild(stem);
    // bladveren langs de stam
    const N = 16;
    for (let i = 0; i < N; i++){
      const t = i / (N - 1);
      const y = 292 - t * 258;
      const x = 100 + Math.sin(t * 3.1) * 7 - t * 4;
      const len = 54 * (1 - t * 0.82) + 6;
      [-1, 1].forEach(side => {
        const p = document.createElementNS(NS, 'path');
        const ex = x + side * len * 0.95;
        const ey = y - len * (0.35 + t * 0.3);
        p.setAttribute('d', `M${x} ${y} Q ${x + side * len * 0.55} ${y - len * 0.1}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
        p.setAttribute('stroke', i % 2 ? '#7FD8BE' : '#4FAE8F');
        p.setAttribute('stroke-width', (2.4 - t * 1.3).toFixed(2));
        g.appendChild(p);
        // kleine zijblaadjes
        const leaflet = document.createElementNS(NS, 'path');
        const mx = x + side * len * 0.45, my = y - len * 0.12;
        leaflet.setAttribute('d', `M${mx.toFixed(1)} ${my.toFixed(1)} l ${(side * len * 0.18).toFixed(1)} ${(-len * 0.28).toFixed(1)}`);
        leaflet.setAttribute('stroke', '#3E9578');
        leaflet.setAttribute('stroke-width', (1.6 - t * 0.9).toFixed(2));
        g.appendChild(leaflet);
      });
    }
    svg.appendChild(g);
  });
  // zachte wuif
  if (typeof gsap !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    gsap.utils.toArray('svg.fern').forEach((v, i) => {
      gsap.to(v, { rotation: 2.5, transformOrigin: '50% 100%', duration: 2.8 + i * 0.4,
        yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.3 });
    });
  }
})();

/* ============================================================
   Copy buttons on code blocks
   ============================================================ */
(function(){
  document.querySelectorAll('.code-block').forEach(block => {
    if (block.classList.contains('terminal') || block.querySelector('.pg-editor')) return;
    const titleEl = block.querySelector('.title');
    const pre = block.querySelector('pre');
    if (!titleEl || !pre) return;
    const button = document.createElement('button');
    button.className = 'copy';
    const label = '<span class="nl">Kopieer</span><span class="en">Copy</span>';
    button.innerHTML = label;
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.innerText).then(() => {
        button.classList.add('ok');
        button.textContent = '✓';
        setTimeout(() => { button.classList.remove('ok'); button.innerHTML = label; }, 1500);
      });
    });
    titleEl.appendChild(button);
  });
})();

/* ============================================================
   Terminal-animatie in de hero
   ============================================================ */
(function(){
  const cmdEl = document.getElementById('term-text');
  const outputEl = document.getElementById('term-output');
  if (!cmdEl || !outputEl) return;
  const cmd = 'wald plant my-forest';
  const lines = [
    '🌱  Planting forest in ./my-forest',
    '🌲  4 trees · 2 branches · 1 canopy',
    '✓   Done in 0.4s — happy growing!'
  ];
  let i = 0, r = 0;
  function tick(){
    cmdEl.textContent = '$ ' + cmd.slice(0, i);
    if (i <= cmd.length){ i++; setTimeout(tick, 50 + Math.random() * 75); }
    else setTimeout(show, 500);
  }
  function show(){
    if (r < lines.length){
      outputEl.textContent += lines[r] + '\n';
      r++; setTimeout(show, 430);
    }
  }
  setTimeout(tick, 1400);
})();

/* ============================================================
   Playground — mini .wald-compiler
   ============================================================ */
(function(){
  const editor = document.getElementById('pg-editor');
  const preview = document.getElementById('pg-preview');
  if (!editor || !preview) return;
  editor.value = `---
const title = "My first tree"
const species = ["oak", "beech", "pine"]
---
<h1>{title}</h1>
<p>{species.length} species grow in this forest:</p>
<ul>
  {species.map(s => '<li>' + s + '</li>').join('')}
</ul>`;
  function compile(source){
    let fm = '', tpl = source;
    const parts = source.split(/^---\s*$/m);
    if (parts.length >= 3){ fm = parts[1]; tpl = parts.slice(2).join('---'); }
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
  function refresh(){ preview.innerHTML = compile(editor.value); }
  editor.addEventListener('input', refresh);
  refresh();
})();

/* ============================================================
   Growth bar + scrim (scroll progress & readability)
   ============================================================ */
(function(){
  const bar = document.getElementById('growth-bar');
  const leaf = document.getElementById('growth-leaf');
  const scrim = document.getElementById('scrim');
  function update(){
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? h.scrollTop / max : 0;
    if (bar) bar.style.width = (p * 100) + '%';
    if (leaf){
      leaf.style.left = (p * 100) + 'vw';
      leaf.style.opacity = p > 0.004 ? 1 : 0;
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
   Cursor firefly in the hero
   ============================================================ */
(function(){
  const firefly = document.getElementById('cursor-firefly');
  const hero = document.querySelector('header');
  if (!firefly || !hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my;
  window.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    const r = hero.getBoundingClientRect();
    firefly.style.opacity = (e.clientY < r.bottom && r.bottom > 0) ? 1 : 0;
  });
  (function follow(){
    x += (mx - x) * 0.1;
    y += (my - y) * 0.1;
    const t = performance.now() / 1000;
    firefly.style.transform = 'translate(' + (x + Math.sin(t * 3) * 7 - 6) + 'px,' + (y + Math.cos(t * 2.2) * 7 - 6) + 'px)';
    requestAnimationFrame(follow);
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
      document.getElementById('gh-stars').textContent = d.stargazers_count;
      document.getElementById('gh-forks').textContent = d.forks_count;
      el.classList.add('visible');
    })
    .catch(() => {});
})();

/* ============================================================
   Ambient bosgeluid — progressive enhancement
   Gesynthetiseerd met Web Audio: wind, krekels (nacht),
   vogels (dag) en af en toe een koekoek. Standaard uit.
   ============================================================ */
(function(){
  const button = document.getElementById('btn-sound');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!button) return;
  if (!AC){ button.style.display = 'none'; return; } // progressive enhancement
  let ctx = null, masterGain = null, isOn = false;
  const day = () => (window.WaldDay ? window.WaldDay.v : 0);

  function ensureContext(){
    if (ctx) return;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    /* wind: geluste bruine ruis door een lowpass, met trage vlagen */
    const durationSec = 3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * durationSec, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < data.length; i++){
      v = v * 0.985 + (Math.random() * 2 - 1) * 0.03;
      data[i] = v * 2.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buf; source.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 320; filt.Q.value = 0.4;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.06;
    source.connect(filt); filt.connect(windGain); windGain.connect(masterGain);
    source.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain); lfoGain.connect(windGain.gain);
    lfo.start();

    cricketLoop(); birdLoop(); cuckooLoop();
  }

  /* hulpjes */
  function chirp(t0, f0, f1, duration, volume, type){
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(volume, t0 + duration * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    o.connect(g); g.connect(masterGain);
    o.start(t0); o.stop(t0 + duration + 0.05);
  }

  /* krekels — alleen 's nachts */
  function cricketLoop(){
    if (isOn){
      const strength = (1 - day());
      if (strength > 0.15){
        const n = 5 + Math.floor(Math.random() * 7);
        const basis = 4100 + Math.random() * 500;
        for (let i = 0; i < n; i++){
          chirp(ctx.currentTime + i * 0.048, basis, basis * 0.97, 0.035, 0.028 * strength, 'triangle');
        }
      }
    }
    setTimeout(cricketLoop, 600 + Math.random() * 1800);
  }

  /* vogels — alleen overdag */
  function birdLoop(){
    if (isOn && day() > 0.3){
      const n = 2 + Math.floor(Math.random() * 4);
      let t0 = ctx.currentTime;
      for (let i = 0; i < n; i++){
        const f = 2200 + Math.random() * 1400;
        chirp(t0, f, f * (0.7 + Math.random() * 0.5), 0.09 + Math.random() * 0.08, 0.035 * day(), 'sine');
        t0 += 0.12 + Math.random() * 0.1;
      }
    }
    setTimeout(birdLoop, 2500 + Math.random() * 5000);
  }

  /* de koekoek — af en toe, dag én nacht (maar zachter in het donker) */
  function cuckooLoop(){
    if (isOn){
      const volume = 0.05 * (0.4 + 0.6 * day());
      const t0 = ctx.currentTime + 0.1;
      chirp(t0, 740, 720, 0.28, volume, 'sine');          // "koe-"
      chirp(t0 + 0.42, 590, 575, 0.34, volume, 'sine');    // "-koek"
      // soms twee keer
      if (Math.random() < 0.4){
        chirp(t0 + 1.15, 740, 720, 0.28, volume * 0.8, 'sine');
        chirp(t0 + 1.57, 590, 575, 0.34, volume * 0.8, 'sine');
      }
    }
    setTimeout(cuckooLoop, 18000 + Math.random() * 30000);
  }

  window.setSound = function(){
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    isOn = !isOn;
    button.textContent = isOn ? '🔊' : '🔇';
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(isOn ? 0.5 : 0, now + 1.2);
  };
})();
