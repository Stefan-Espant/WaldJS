/* ============================================================
   3D BOSSCÈNE — Three.js
   Mistig nachtbos: maanlicht, rode gloed, vuurvliegjes
   ============================================================ */
(function(){
  const canvas = document.getElementById('bos3d');
  if (!canvas || typeof THREE === 'undefined') return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dagState = { v: 0 }; // 0 = nacht, 1 = dag
  window.WaldDag = dagState; // gedeeld met o.a. de geluidslaag

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x012019);
  scene.fog = new THREE.FogExp2(0x012A20, 0.052);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 3.2, 26);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  function maat(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  maat();
  window.addEventListener('resize', maat);

  /* --- licht --- */
  const hemi = new THREE.HemisphereLight(0x2E6B57, 0x01130E, 0.7);
  scene.add(hemi);
  const maan = new THREE.DirectionalLight(0xCFE8DE, 1.05);
  maan.position.set(-14, 22, -8);
  maan.castShadow = true;
  maan.shadow.mapSize.set(1024, 1024);
  maan.shadow.camera.left = -40; maan.shadow.camera.right = 40;
  maan.shadow.camera.top = 40;  maan.shadow.camera.bottom = -40;
  scene.add(maan);
  const gloed = new THREE.PointLight(0xFF3347, 1.4, 30, 2);
  gloed.position.set(0, 2.5, 12);
  scene.add(gloed);

  /* --- bodem --- */
  const bodemGeo = new THREE.PlaneGeometry(240, 240, 64, 64);
  {
    const pos = bodemGeo.attributes.position;
    for (let i = 0; i < pos.count; i++){
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x*0.15)*Math.cos(y*0.12)*0.8 + Math.sin(x*0.4+y*0.3)*0.25);
    }
    bodemGeo.computeVertexNormals();
  }
  const bodem = new THREE.Mesh(bodemGeo, new THREE.MeshStandardMaterial({ color:0x023124, roughness:1 }));
  bodem.rotation.x = -Math.PI/2;
  bodem.receiveShadow = true;
  scene.add(bodem);

  /* --- bomen (instanced conifeer: 3 kegels + stam) --- */
  const AANTAL = 160;
  const dummy = new THREE.Object3D();
  const naaldMat = new THREE.MeshStandardMaterial({ color:0x0A5240, roughness:.9, flatShading:true });
  const stamMat  = new THREE.MeshStandardMaterial({ color:0x1E2B1A, roughness:1 });
  const kegelGeo = new THREE.ConeGeometry(1, 2.2, 7);
  const stamGeo  = new THREE.CylinderGeometry(0.14, 0.2, 1.2, 6);
  const kegels = new THREE.InstancedMesh(kegelGeo, naaldMat, AANTAL*3);
  const stammen = new THREE.InstancedMesh(stamGeo, stamMat, AANTAL);
  kegels.castShadow = stammen.castShadow = true;
  const kleur = new THREE.Color();
  let ki = 0;
  for (let i = 0; i < AANTAL; i++){
    // laat het midden vrij voor de tekst
    let x, z;
    do {
      x = (Math.random()-0.5)*110;
      z = -Math.random()*80 + 18;
    } while (Math.abs(x) < 9 && z > 2);
    const s = 0.8 + Math.random()*2.4;
    dummy.position.set(x, s*0.6, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = Math.random()*Math.PI;
    dummy.updateMatrix();
    stammen.setMatrixAt(i, dummy.matrix);
    for (let l = 0; l < 3; l++){
      const ls = s * (1 - l*0.22);
      dummy.position.set(x, s*0.9 + l*s*0.75, z);
      dummy.scale.set(ls, s, ls);
      dummy.updateMatrix();
      kegels.setMatrixAt(ki, dummy.matrix);
      kleur.setHSL(0.42 + Math.random()*0.04, 0.55, 0.14 + Math.random()*0.10);
      kegels.setColorAt(ki, kleur);
      ki++;
    }
  }
  kegels.instanceMatrix.needsUpdate = true;
  if (kegels.instanceColor) kegels.instanceColor.needsUpdate = true;
  scene.add(kegels, stammen);

  /* --- vuurvliegjes --- */
  const VLIEG = 220;
  const vliegGeo = new THREE.BufferGeometry();
  const vliegPos = new Float32Array(VLIEG*3);
  const vliegFase = new Float32Array(VLIEG);
  for (let i = 0; i < VLIEG; i++){
    vliegPos[i*3]   = (Math.random()-0.5)*70;
    vliegPos[i*3+1] = 0.5 + Math.random()*7;
    vliegPos[i*3+2] = -Math.random()*55 + 20;
    vliegFase[i] = Math.random()*Math.PI*2;
  }
  vliegGeo.setAttribute('position', new THREE.BufferAttribute(vliegPos, 3));
  // zachte ronde gloed-textuur i.p.v. vierkante punten
  const gloedCanvas = document.createElement('canvas');
  gloedCanvas.width = gloedCanvas.height = 64;
  const gctx = gloedCanvas.getContext('2d');
  const ggrad = gctx.createRadialGradient(32,32,0,32,32,32);
  ggrad.addColorStop(0,'rgba(255,225,170,1)');
  ggrad.addColorStop(0.3,'rgba(255,200,130,.6)');
  ggrad.addColorStop(1,'rgba(255,200,130,0)');
  gctx.fillStyle = ggrad; gctx.fillRect(0,0,64,64);
  const vliegTex = new THREE.CanvasTexture(gloedCanvas);
  const vliegMat = new THREE.PointsMaterial({ map:vliegTex, color:0xFFD9A0, size:0.5, transparent:true, opacity:.85, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending });
  const vliegjes = new THREE.Points(vliegGeo, vliegMat);
  scene.add(vliegjes);

  /* --- mistflarden (grote zachte sprites) --- */
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = mistCanvas.height = 128;
  const mctx = mistCanvas.getContext('2d');
  const grad = mctx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'rgba(210,235,225,.35)');
  grad.addColorStop(1,'rgba(210,235,225,0)');
  mctx.fillStyle = grad; mctx.fillRect(0,0,128,128);
  const mistTex = new THREE.CanvasTexture(mistCanvas);
  const mistMat = new THREE.SpriteMaterial({ map:mistTex, transparent:true, opacity:.5, depthWrite:false });
  const flarden = [];
  for (let i = 0; i < 14; i++){
    const sp = new THREE.Sprite(mistMat.clone());
    sp.material.opacity = 0.18 + Math.random()*0.25;
    sp.position.set((Math.random()-0.5)*80, 1 + Math.random()*3, -Math.random()*50 + 18);
    const sc = 14 + Math.random()*22;
    sp.scale.set(sc, sc*0.45, 1);
    flarden.push(sp);
    scene.add(sp);
  }

  /* --- luchtkoepel (GLSL-shader: gradiënt, aurora, sterren) --- */
  const luchtMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { tijd: { value: 0 }, dag: { value: 0 } },
    vertexShader: `
      varying vec3 vP;
      void main(){
        vP = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float tijd;
      uniform float dag;
      varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruis(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main(){
        float h = clamp(vP.y, 0.0, 1.0);
        // nachtpalet
        vec3 horizonN = vec3(0.008, 0.165, 0.125);
        vec3 zenitN   = vec3(0.002, 0.050, 0.040);
        // gouden-ochtendpalet
        vec3 horizonD = vec3(1.00, 0.74, 0.44);
        vec3 zenitD   = vec3(0.42, 0.70, 0.62);
        vec3 horizon = mix(horizonN, horizonD, dag);
        vec3 zenit   = mix(zenitN, zenitD, dag);
        vec3 k = mix(horizon, zenit, pow(h, 0.6));
        // aurora-band (alleen 's nachts)
        float band = exp(-pow((vP.y - 0.30 - 0.06 * sin(vP.x * 4.0 + tijd * 0.15)) * 6.0, 2.0));
        float golf = ruis(vec2(vP.x * 6.0 + tijd * 0.08, vP.z * 6.0));
        k += vec3(0.05, 0.32, 0.20) * band * golf * 0.55 * (1.0 - dag);
        // sterren met twinkel (alleen 's nachts)
        vec2 sp = vP.xz / (vP.y + 0.35);
        float ster = step(0.9985, hash(floor(sp * 260.0)));
        float twinkel = 0.5 + 0.5 * sin(tijd * 2.0 + hash(floor(sp * 260.0) + 7.0) * 6.28);
        k += vec3(0.85, 0.92, 1.0) * ster * twinkel * smoothstep(0.05, 0.45, vP.y) * (1.0 - dag);
        // laagstaande ochtendzon
        float zon = pow(max(dot(vP, normalize(vec3(-0.5, 0.30, -0.65))), 0.0), 90.0);
        k += vec3(1.0, 0.85, 0.55) * zon * dag * 1.4;
        gl_FragColor = vec4(k, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(110, 32, 24), luchtMat));

  /* --- hoogte van de bodem op wereldpositie (zelfde formule als bodemGeo) --- */
  function grondHoogte(x, z){
    return Math.sin(x*0.15)*Math.cos(z*0.12)*0.8 + Math.sin(x*0.4 - z*0.3)*0.25;
  }

  /* --- dicht grasveld (instanced, GLSL: gelaagde wind, taps blad, AO) --- */
  const GRAS = 45000;
  const bladGeo = new THREE.PlaneGeometry(0.15, 1, 1, 4);
  bladGeo.translate(0, 0.5, 0);
  {
    const pos = bladGeo.attributes.position;
    for (let i = 0; i < pos.count; i++){
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) * Math.pow(1 - y, 0.75)); // taps toelopend naar de punt
      pos.setZ(i, y * y * 0.18);                        // natuurlijke kromming
    }
  }
  const fases   = new Float32Array(GRAS);
  const schalen = new Float32Array(GRAS);
  const tinten  = new Float32Array(GRAS);
  for (let i = 0; i < GRAS; i++){
    fases[i]   = Math.random() * Math.PI * 2;
    schalen[i] = 0.45 + Math.random() * 1.15;
    tinten[i]  = Math.random();
  }
  bladGeo.setAttribute('fase',   new THREE.InstancedBufferAttribute(fases, 1));
  bladGeo.setAttribute('schaal', new THREE.InstancedBufferAttribute(schalen, 1));
  bladGeo.setAttribute('tint',   new THREE.InstancedBufferAttribute(tinten, 1));
  const grasMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      tijd:      { value: 0 },
      kleurA:    { value: new THREE.Color(0x083A2B) },
      kleurB:    { value: new THREE.Color(0x14654A) },
      kleurTip:  { value: new THREE.Color(0x5FC493) },
      mistKleur: { value: new THREE.Color(0x012A20) },
      mistDicht: { value: 0.052 }
    },
    vertexShader: `
      uniform float tijd;
      attribute float fase;
      attribute float schaal;
      attribute float tint;
      varying float vH;
      varying float vDiep;
      varying float vTint;
      void main(){
        vH = position.y;
        vTint = tint;
        vec3 p = position;
        p.y *= schaal;
        #ifdef USE_INSTANCING
          vec4 wp = instanceMatrix * vec4(p, 1.0);
        #else
          vec4 wp = vec4(p, 1.0);
        #endif
        // gelaagde wind: brede vlagen over het veld + snelle lokale trilling
        float buig = vH * vH;
        float vlaag = sin(tijd * 1.25 + wp.x * 0.30 + wp.z * 0.22);
        float tril  = sin(tijd * 2.60 + wp.x * 0.90 + fase);
        float wind  = vlaag * 0.7 + tril * 0.3;
        wp.x += wind * 0.22 * buig;
        wp.z += cos(tijd * 0.85 + fase) * 0.07 * buig;
        vec4 mv = viewMatrix * wp;
        vDiep = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 kleurA;
      uniform vec3 kleurB;
      uniform vec3 kleurTip;
      uniform vec3 mistKleur;
      uniform float mistDicht;
      varying float vH;
      varying float vDiep;
      varying float vTint;
      void main(){
        vec3 basis = mix(kleurA, kleurB, vTint);
        // ambient occlusion onderin, lichte toppen (nep-doorschijnendheid)
        vec3 k = mix(basis * 0.30, basis, smoothstep(0.0, 0.5, vH));
        k = mix(k, kleurTip, pow(vH, 2.4) * 0.85);
        float f = 1.0 - exp(-mistDicht * mistDicht * vDiep * vDiep);
        k = mix(k, mistKleur, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(k, 1.0);
      }`
  });
  const gras = new THREE.InstancedMesh(bladGeo, grasMat, GRAS);
  for (let i = 0; i < GRAS; i++){
    // dichter bij de camera méér sprieten
    const r = Math.pow(Math.random(), 1.5);
    const z = 24 - 96 * r;
    const x = (Math.random() - 0.5) * (55 + (24 - z) * 1.3);
    dummy.position.set(x, grondHoogte(x, z) - 0.04, z);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
    dummy.updateMatrix();
    gras.setMatrixAt(i, dummy.matrix);
  }
  gras.instanceMatrix.needsUpdate = true;
  gras.frustumCulled = false;
  scene.add(gras);

  /* --- gloeiende rode bloemen tussen het gras --- */
  const BLOEM = 110;
  const bloemGeo = new THREE.SphereGeometry(0.085, 6, 5);
  const bloemMat = new THREE.MeshStandardMaterial({ color:0xFF3347, emissive:0xFF3347, emissiveIntensity:.5, roughness:.55 });
  const bloemen = new THREE.InstancedMesh(bloemGeo, bloemMat, BLOEM);
  for (let i = 0; i < BLOEM; i++){
    const z = 22 - Math.random() * 60;
    const x = (Math.random() - 0.5) * 70;
    dummy.position.set(x, grondHoogte(x, z) + 0.25 + Math.random() * 0.5, z);
    dummy.scale.setScalar(0.7 + Math.random() * 0.9);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    bloemen.setMatrixAt(i, dummy.matrix);
  }
  bloemen.instanceMatrix.needsUpdate = true;
  scene.add(bloemen);

  /* --- lichtstralen door het bladerdek (additive shader) --- */
  const straalMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      tijd:    { value: 0 },
      kleur:   { value: new THREE.Color(0xB8F2D9) },
      sterkte: { value: 0.22 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float tijd;
      uniform vec3 kleur;
      uniform float sterkte;
      varying vec2 vUv;
      void main(){
        float x = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
        float y = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float puls = 0.7 + 0.3 * sin(tijd * 0.6 + vUv.x * 3.0);
        gl_FragColor = vec4(kleur, x * y * sterkte * puls);
      }`
  });
  for (let i = 0; i < 6; i++){
    const straal = new THREE.Mesh(new THREE.PlaneGeometry(2.2 + Math.random() * 2.2, 26), straalMat);
    straal.position.set(-19 + i * 7 + Math.random() * 3, 11, -14 - Math.random() * 12);
    straal.rotation.z = -0.32;
    straal.rotation.y = (Math.random() - 0.5) * 0.4;
    scene.add(straal);
  }

  /* --- muis-parallax + animatielus --- */
  let muisX = 0, muisY = 0, scrollDiepte = 0;
  window.addEventListener('pointermove', e => {
    muisX = (e.clientX / window.innerWidth - 0.5);
    muisY = (e.clientY / window.innerHeight - 0.5);
  });
  if (typeof gsap !== 'undefined' && gsap.registerPlugin){
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      start: 0, end: 'max', scrub: true,
      onUpdate: st => { scrollDiepte = st.progress; }
    });
  }

  /* --- klik om te planten --- */
  const raycaster = new THREE.Raycaster();
  const muisV = new THREE.Vector2();
  const geplant = [];
  function plantBoom(clientX, clientY){
    muisV.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(muisV, camera);
    const hits = raycaster.intersectObject(bodem);
    if (!hits.length) return;
    const p = hits[0].point;
    if (p.z < -70) return; // te diep het bos in
    const s = 0.9 + Math.random() * 1.6;
    const groep = new THREE.Group();
    const stam = new THREE.Mesh(stamGeo, stamMat);
    stam.position.y = 0.6;
    stam.castShadow = true;
    groep.add(stam);
    const eigenNaald = naaldMat.clone();
    eigenNaald.color.setHSL(0.42 + Math.random() * 0.05, 0.5, 0.16 + Math.random() * 0.12);
    for (let l = 0; l < 3; l++){
      const kegel = new THREE.Mesh(kegelGeo, eigenNaald);
      kegel.position.y = 0.9 + l * 0.75;
      kegel.scale.set(1 - l * 0.22, 1, 1 - l * 0.22);
      kegel.castShadow = true;
      groep.add(kegel);
    }
    groep.position.copy(p);
    groep.rotation.y = Math.random() * Math.PI * 2;
    groep.scale.setScalar(0.001);
    scene.add(groep);
    geplant.push(groep);
    if (geplant.length > 40) scene.remove(geplant.shift());
    if (typeof gsap !== 'undefined'){
      gsap.to(groep.scale, { x: s, y: s, z: s, duration: 1.4, ease: 'elastic.out(1,0.45)' });
    } else {
      groep.scale.setScalar(s);
    }
  }
  const heroEl = document.querySelector('header');
  if (heroEl){
    heroEl.addEventListener('click', e => {
      if (e.target.closest('a,button,textarea,.terminal')) return;
      plantBoom(e.clientX, e.clientY);
    });
  }

  /* --- vallende sterren (alleen 's nachts) --- */
  const sterTex = (function(){
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cx = c.getContext('2d');
    const gr = cx.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(220,240,255,.7)');
    gr.addColorStop(1, 'rgba(220,240,255,0)');
    cx.fillStyle = gr; cx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
  })();
  function vallendeSter(){
    if (dagState.v < 0.4 && document.visibilityState === 'visible' && typeof gsap !== 'undefined' && !reducedMotion){
      const mat = new THREE.SpriteMaterial({ map: sterTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const ster = new THREE.Sprite(mat);
      const richting = Math.random() < 0.5 ? 1 : -1;
      const beginX = -45 + Math.random() * 90;
      const beginY = 30 + Math.random() * 14;
      const dx = (18 + Math.random() * 22) * richting;
      const dy = -(6 + Math.random() * 7);
      ster.position.set(beginX, beginY, -70 - Math.random() * 20);
      mat.rotation = Math.atan2(dy, dx);
      ster.scale.set(6.5, 0.35, 1);
      scene.add(ster);
      const duur = 0.9 + Math.random() * 0.7;
      gsap.to(ster.position, { x: beginX + dx, y: beginY + dy, duration: duur, ease: 'none' });
      gsap.to(mat, { opacity: .95, duration: duur * 0.25, ease: 'power1.in' });
      gsap.to(mat, { opacity: 0, duration: duur * 0.5, delay: duur * 0.5, ease: 'power1.out',
        onComplete(){ scene.remove(ster); mat.dispose(); } });
    }
    setTimeout(vallendeSter, 7000 + Math.random() * 14000);
  }
  setTimeout(vallendeSter, 4000);

  /* --- dag/nacht-wissel --- */
  const lerpKleur = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  function pasDagToe(){
    const d = dagState.v;
    scene.background.copy(lerpKleur(0x012019, 0x8FB08D, d));
    scene.fog.color.copy(lerpKleur(0x012A20, 0x7BA383, d));
    scene.fog.density = 0.052 - 0.018 * d;
    hemi.color.copy(lerpKleur(0x2E6B57, 0xFFE3B0, d));
    hemi.groundColor.copy(lerpKleur(0x01130E, 0x2E4A33, d));
    hemi.intensity = 0.7 + 0.35 * d;
    maan.color.copy(lerpKleur(0xCFE8DE, 0xFFD9A0, d));
    maan.intensity = 1.05 + 0.85 * d;
    naaldMat.color.copy(lerpKleur(0x0A5240, 0x1F7A52, d));
    bodem.material.color.copy(lerpKleur(0x023124, 0x1D5435, d));
    grasMat.uniforms.mistKleur.value.copy(lerpKleur(0x012A20, 0x7BA383, d));
    grasMat.uniforms.mistDicht.value = 0.052 - 0.018 * d;
    grasMat.uniforms.kleurA.value.copy(lerpKleur(0x083A2B, 0x1A5A32, d));
    grasMat.uniforms.kleurB.value.copy(lerpKleur(0x14654A, 0x2E8B57, d));
    grasMat.uniforms.kleurTip.value.copy(lerpKleur(0x5FC493, 0x9BD96A, d));
    luchtMat.uniforms.dag.value = d;
    straalMat.uniforms.kleur.value.copy(lerpKleur(0xB8F2D9, 0xFFDA8C, d));
    straalMat.uniforms.sterkte.value = 0.22 + 0.10 * d;
  }
  window.zetDagNacht = function(){
    const doel = dagState.v < 0.5 ? 1 : 0;
    const knop = document.getElementById('btn-dagnacht');
    if (knop) knop.textContent = doel ? '☀️' : '🌙';
    document.body.classList.toggle('dag', doel === 1);
    if (typeof gsap !== 'undefined'){
      gsap.to(dagState, { v: doel, duration: 2.6, ease: 'sine.inOut', onUpdate: pasDagToe });
    } else {
      dagState.v = doel; pasDagToe();
    }
  };

  const klok = new THREE.Clock();
  function lus(){
    const t = klok.getElapsedTime();
    if (!reducedMotion){
      camera.position.x += ((muisX*3) - camera.position.x) * 0.03;
      camera.position.y += ((3.2 - muisY*1.2 + scrollDiepte*4) - camera.position.y) * 0.03;
      camera.position.z = 26 - scrollDiepte*8 + Math.sin(t*0.15)*0.6;
      camera.lookAt(0, 2.2, -6);
      const p = vliegGeo.attributes.position;
      for (let i = 0; i < VLIEG; i++){
        p.array[i*3+1] += Math.sin(t*1.4 + vliegFase[i]) * 0.004;
        p.array[i*3]   += Math.cos(t*0.6 + vliegFase[i]) * 0.006;
      }
      p.needsUpdate = true;
      vliegMat.opacity = (0.55 + Math.sin(t*2)*0.3) * (1 - dagState.v);
      flarden.forEach((sp,i) => { sp.position.x += Math.sin(t*0.05 + i)*0.012; });
      gloed.intensity = (1.25 + Math.sin(t*1.8)*0.25) * (1 - dagState.v * 0.75);
      grasMat.uniforms.tijd.value = t;
      luchtMat.uniforms.tijd.value = t;
      straalMat.uniforms.tijd.value = t;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(lus);
  }
  lus();
})();
