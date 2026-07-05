/* ============================================================
   GSAP — entrance & scroll-animaties
   ============================================================ */
(function(){
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  /* hero entrance */
  gsap.from('header h1', { y:40, autoAlpha:0, duration:.9, ease:'power3.out', delay:.3 });
  gsap.from('header p.sub', { y:30, autoAlpha:0, duration:.9, ease:'power3.out', delay:.7 });
  gsap.from('header .cta .btn', { y:24, autoAlpha:0, duration:.7, stagger:.12, ease:'power3.out', delay:.85 });

  /* sectiekoppen */
  gsap.utils.toArray('.sectiekop').forEach(el => {
    gsap.from(el, { y:50, autoAlpha:0, duration:.8, ease:'power3.out',
      scrollTrigger:{ trigger:el, start:'top 85%' } });
  });

  /* kaarten & codeblokken */
  gsap.utils.toArray('.kaarten').forEach(grid => {
    gsap.from(grid.children, { y:44, autoAlpha:0, duration:.7, stagger:.09, ease:'power3.out',
      scrollTrigger:{ trigger:grid, start:'top 85%' } });
  });
  gsap.utils.toArray('.split').forEach(sp => {
    gsap.from(sp.children, { y:50, autoAlpha:0, duration:.8, stagger:.15, ease:'power3.out',
      scrollTrigger:{ trigger:sp, start:'top 82%' } });
  });
  gsap.utils.toArray('.qs-grid .codeblok, .cli-grid .cli-kaart, .pkg span').forEach(el => {
    gsap.from(el, { y:34, autoAlpha:0, duration:.6, ease:'power3.out',
      scrollTrigger:{ trigger:el, start:'top 90%' } });
  });

  /* benchmark-balken groeien */
  gsap.utils.toArray('.balk i').forEach(b => {
    gsap.from(b, { scaleX:0, transformOrigin:'left center', duration:1.2, ease:'power4.out',
      scrollTrigger:{ trigger:b, start:'top 88%' } });
  });

  /* roadmap */
  gsap.from('.roadmap li', { x:-40, autoAlpha:0, duration:.6, stagger:.1, ease:'power3.out',
    scrollTrigger:{ trigger:'.roadmap', start:'top 82%' } });
})();

/* ============================================================
   Scroll-reveals voor nieuwe secties
   ============================================================ */
(function(){
  if (typeof gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.vergelijk tr', { y: 24, autoAlpha: 0, duration: .5, stagger: .06, ease: 'power3.out',
    scrollTrigger: { trigger: '.vergelijk', start: 'top 85%' } });
  gsap.from('.log-kaart', { y: 40, autoAlpha: 0, duration: .6, stagger: .1, ease: 'power3.out',
    scrollTrigger: { trigger: '.changelog', start: 'top 85%' } });
  gsap.from('.pg-grid > *', { y: 44, autoAlpha: 0, duration: .7, stagger: .15, ease: 'power3.out',
    scrollTrigger: { trigger: '.pg-grid', start: 'top 85%' } });
})();
