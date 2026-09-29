/* ============================================================
   3D BOSSCÈNE — Three.js
   Mistig nachtbos: maanlicht, rode gloed, vuurvliegjes
   ============================================================ */
(function(){
  const canvas = document.getElementById('forest3d');
  if (!canvas || typeof THREE === 'undefined') return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dayState = { v: 0 }; // 0 = nacht, 1 = dag
  window.WaldDay = dayState; // gedeeld met o.a. de geluidslaag

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x012019);
  scene.fog = new THREE.FogExp2(0x012A20, 0.052);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 3.2, 26);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  function resize(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* --- licht --- */
  const hemi = new THREE.HemisphereLight(0x2E6B57, 0x01130E, 0.7);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xCFE8DE, 1.05);
  moon.position.set(-14, 22, -8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -40; moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40;  moon.shadow.camera.bottom = -40;
  scene.add(moon);
  const glow = new THREE.PointLight(0xFF3347, 1.4, 30, 2);
  glow.position.set(0, 2.5, 12);
  scene.add(glow);

  /* --- bodem --- */
  const groundGeo = new THREE.PlaneGeometry(240, 240, 64, 64);
  {
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++){
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x*0.15)*Math.cos(y*0.12)*0.8 + Math.sin(x*0.4+y*0.3)*0.25);
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color:0x023124, roughness:1 }));
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* --- bomen (instanced conifeer: 3 kegels + stam) --- */
  const TREE_COUNT = 160;
  const dummy = new THREE.Object3D();
  const needleMat = new THREE.MeshStandardMaterial({ color:0x0A5240, roughness:.9, flatShading:true });
  const trunkMat  = new THREE.MeshStandardMaterial({ color:0x1E2B1A, roughness:1 });
  const coneGeo = new THREE.ConeGeometry(1, 2.2, 7);
  const trunkGeo  = new THREE.CylinderGeometry(0.14, 0.2, 1.2, 6);
  const cones = new THREE.InstancedMesh(coneGeo, needleMat, TREE_COUNT*3);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
  cones.castShadow = trunks.castShadow = true;
  const color = new THREE.Color();
  let ki = 0;
  for (let i = 0; i < TREE_COUNT; i++){
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
    trunks.setMatrixAt(i, dummy.matrix);
    for (let l = 0; l < 3; l++){
      const ls = s * (1 - l*0.22);
      dummy.position.set(x, s*0.9 + l*s*0.75, z);
      dummy.scale.set(ls, s, ls);
      dummy.updateMatrix();
      cones.setMatrixAt(ki, dummy.matrix);
      color.setHSL(0.42 + Math.random()*0.04, 0.55, 0.14 + Math.random()*0.10);
      cones.setColorAt(ki, color);
      ki++;
    }
  }
  cones.instanceMatrix.needsUpdate = true;
  if (cones.instanceColor) cones.instanceColor.needsUpdate = true;
  scene.add(cones, trunks);

  /* --- vuurvliegjes --- */
  const FIREFLY_COUNT = 220;
  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyPos = new Float32Array(FIREFLY_COUNT*3);
  const fireflyPhase = new Float32Array(FIREFLY_COUNT);
  for (let i = 0; i < FIREFLY_COUNT; i++){
    fireflyPos[i*3]   = (Math.random()-0.5)*70;
    fireflyPos[i*3+1] = 0.5 + Math.random()*7;
    fireflyPos[i*3+2] = -Math.random()*55 + 20;
    fireflyPhase[i] = Math.random()*Math.PI*2;
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
  // zachte ronde gloed-textuur i.p.v. vierkante punten
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const gctx = glowCanvas.getContext('2d');
  const ggrad = gctx.createRadialGradient(32,32,0,32,32,32);
  ggrad.addColorStop(0,'rgba(255,225,170,1)');
  ggrad.addColorStop(0.3,'rgba(255,200,130,.6)');
  ggrad.addColorStop(1,'rgba(255,200,130,0)');
  gctx.fillStyle = ggrad; gctx.fillRect(0,0,64,64);
  const fireflyTex = new THREE.CanvasTexture(glowCanvas);
  const fireflyMat = new THREE.PointsMaterial({ map:fireflyTex, color:0xFFD9A0, size:0.5, transparent:true, opacity:.85, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  scene.add(fireflies);

  /* --- mistflarden (grote zachte sprites) --- */
  const fogCanvas = document.createElement('canvas');
  fogCanvas.width = fogCanvas.height = 128;
  const mctx = fogCanvas.getContext('2d');
  const grad = mctx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'rgba(210,235,225,.35)');
  grad.addColorStop(1,'rgba(210,235,225,0)');
  mctx.fillStyle = grad; mctx.fillRect(0,0,128,128);
  const fogTex = new THREE.CanvasTexture(fogCanvas);
  const fogMat = new THREE.SpriteMaterial({ map:fogTex, transparent:true, opacity:.5, depthWrite:false });
  const wisps = [];
  for (let i = 0; i < 14; i++){
    const sp = new THREE.Sprite(fogMat.clone());
    sp.material.opacity = 0.18 + Math.random()*0.25;
    sp.position.set((Math.random()-0.5)*80, 1 + Math.random()*3, -Math.random()*50 + 18);
    const sc = 14 + Math.random()*22;
    sp.scale.set(sc, sc*0.45, 1);
    wisps.push(sp);
    scene.add(sp);
  }

  /* --- luchtkoepel (GLSL-shader: gradiënt, aurora, sterren) --- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { time: { value: 0 }, day: { value: 0 } },
    vertexShader: `
      varying vec3 vP;
      void main(){
        vP = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float time;
      uniform float day;
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
        vec3 horizon = mix(horizonN, horizonD, day);
        vec3 zenit   = mix(zenitN, zenitD, day);
        vec3 k = mix(horizon, zenit, pow(h, 0.6));
        // aurora-band (alleen 's nachts)
        float band = exp(-pow((vP.y - 0.30 - 0.06 * sin(vP.x * 4.0 + time * 0.15)) * 6.0, 2.0));
        float golf = ruis(vec2(vP.x * 6.0 + time * 0.08, vP.z * 6.0));
        k += vec3(0.05, 0.32, 0.20) * band * golf * 0.55 * (1.0 - day);
        // sterren met twinkel (alleen 's nachts)
        vec2 sp = vP.xz / (vP.y + 0.35);
        float star = step(0.9985, hash(floor(sp * 260.0)));
        float twinkel = 0.5 + 0.5 * sin(time * 2.0 + hash(floor(sp * 260.0) + 7.0) * 6.28);
        k += vec3(0.85, 0.92, 1.0) * star * twinkel * smoothstep(0.05, 0.45, vP.y) * (1.0 - day);
        // laagstaande ochtendzon
        float zon = pow(max(dot(vP, normalize(vec3(-0.5, 0.30, -0.65))), 0.0), 90.0);
        k += vec3(1.0, 0.85, 0.55) * zon * day * 1.4;
        gl_FragColor = vec4(k, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(110, 32, 24), skyMat));

  /* --- hoogte van de bodem op wereldpositie (zelfde formule als bodemGeo) --- */
  function groundHeight(x, z){
    return Math.sin(x*0.15)*Math.cos(z*0.12)*0.8 + Math.sin(x*0.4 - z*0.3)*0.25;
  }

  /* --- dicht grasveld (instanced, GLSL: gelaagde wind, taps blad, AO) --- */
  const GRASS_COUNT = 45000;
  const bladeGeo = new THREE.PlaneGeometry(0.15, 1, 1, 4);
  bladeGeo.translate(0, 0.5, 0);
  {
    const pos = bladeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++){
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) * Math.pow(1 - y, 0.75)); // taps toelopend naar de punt
      pos.setZ(i, y * y * 0.18);                        // natuurlijke kromming
    }
  }
  const phases   = new Float32Array(GRASS_COUNT);
  const scales = new Float32Array(GRASS_COUNT);
  const tints  = new Float32Array(GRASS_COUNT);
  for (let i = 0; i < GRASS_COUNT; i++){
    phases[i]   = Math.random() * Math.PI * 2;
    scales[i] = 0.45 + Math.random() * 1.15;
    tints[i]  = Math.random();
  }
  bladeGeo.setAttribute('fase',   new THREE.InstancedBufferAttribute(phases, 1));
  bladeGeo.setAttribute('schaal', new THREE.InstancedBufferAttribute(scales, 1));
  bladeGeo.setAttribute('tint',   new THREE.InstancedBufferAttribute(tints, 1));
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      time:       { value: 0 },
      colorA:     { value: new THREE.Color(0x083A2B) },
      colorB:     { value: new THREE.Color(0x14654A) },
      colorTip:   { value: new THREE.Color(0x5FC493) },
      fogColor:   { value: new THREE.Color(0x012A20) },
      fogDensity: { value: 0.052 }
    },
    vertexShader: `
      uniform float time;
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
        float vlaag = sin(time * 1.25 + wp.x * 0.30 + wp.z * 0.22);
        float tril  = sin(time * 2.60 + wp.x * 0.90 + fase);
        float wind  = vlaag * 0.7 + tril * 0.3;
        wp.x += wind * 0.22 * buig;
        wp.z += cos(time * 0.85 + fase) * 0.07 * buig;
        vec4 mv = viewMatrix * wp;
        vDiep = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 colorTip;
      uniform vec3 fogColor;
      uniform float fogDensity;
      varying float vH;
      varying float vDiep;
      varying float vTint;
      void main(){
        vec3 basis = mix(colorA, colorB, vTint);
        // ambient occlusion onderin, lichte toppen (nep-doorschijnendheid)
        vec3 k = mix(basis * 0.30, basis, smoothstep(0.0, 0.5, vH));
        k = mix(k, colorTip, pow(vH, 2.4) * 0.85);
        float f = 1.0 - exp(-fogDensity * fogDensity * vDiep * vDiep);
        k = mix(k, fogColor, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(k, 1.0);
      }`
  });
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS_COUNT);
  for (let i = 0; i < GRASS_COUNT; i++){
    // dichter bij de camera méér sprieten
    const r = Math.pow(Math.random(), 1.5);
    const z = 24 - 96 * r;
    const x = (Math.random() - 0.5) * (55 + (24 - z) * 1.3);
    dummy.position.set(x, groundHeight(x, z) - 0.04, z);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.frustumCulled = false;
  scene.add(grass);

  /* --- gloeiende rode bloemen tussen het gras --- */
  const FLOWER_COUNT = 110;
  const flowerGeo = new THREE.SphereGeometry(0.085, 6, 5);
  const flowerMat = new THREE.MeshStandardMaterial({ color:0xFF3347, emissive:0xFF3347, emissiveIntensity:.5, roughness:.55 });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, FLOWER_COUNT);
  for (let i = 0; i < FLOWER_COUNT; i++){
    const z = 22 - Math.random() * 60;
    const x = (Math.random() - 0.5) * 70;
    dummy.position.set(x, groundHeight(x, z) + 0.25 + Math.random() * 0.5, z);
    dummy.scale.setScalar(0.7 + Math.random() * 0.9);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
  }
  flowers.instanceMatrix.needsUpdate = true;
  scene.add(flowers);

  /* --- lichtstralen door het bladerdek (additive shader) --- */
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      time:     { value: 0 },
      color:    { value: new THREE.Color(0xB8F2D9) },
      strength: { value: 0.22 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      uniform float strength;
      varying vec2 vUv;
      void main(){
        float x = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
        float y = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float puls = 0.7 + 0.3 * sin(time * 0.6 + vUv.x * 3.0);
        gl_FragColor = vec4(color, x * y * strength * puls);
      }`
  });
  for (let i = 0; i < 6; i++){
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.2 + Math.random() * 2.2, 26), beamMat);
    beam.position.set(-19 + i * 7 + Math.random() * 3, 11, -14 - Math.random() * 12);
    beam.rotation.z = -0.32;
    beam.rotation.y = (Math.random() - 0.5) * 0.4;
    scene.add(beam);
  }

  /* --- muis-parallax + animatielus --- */
  let mouseX = 0, mouseY = 0, scrollDepth = 0;
  window.addEventListener('pointermove', e => {
    mouseX = (e.clientX / window.innerWidth - 0.5);
    mouseY = (e.clientY / window.innerHeight - 0.5);
  });
  if (typeof gsap !== 'undefined' && gsap.registerPlugin){
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      start: 0, end: 'max', scrub: true,
      onUpdate: st => { scrollDepth = st.progress; }
    });
  }

  /* --- klik om te planten --- */
  const raycaster = new THREE.Raycaster();
  const mouseVector = new THREE.Vector2();
  const planted = [];
  function plantTree(clientX, clientY){
    mouseVector.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouseVector, camera);
    const hits = raycaster.intersectObject(ground);
    if (!hits.length) return;
    const p = hits[0].point;
    if (p.z < -70) return; // te diep het bos in
    const s = 0.9 + Math.random() * 1.6;
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    group.add(trunk);
    const ownNeedleMat = needleMat.clone();
    ownNeedleMat.color.setHSL(0.42 + Math.random() * 0.05, 0.5, 0.16 + Math.random() * 0.12);
    for (let l = 0; l < 3; l++){
      const cone = new THREE.Mesh(coneGeo, ownNeedleMat);
      cone.position.y = 0.9 + l * 0.75;
      cone.scale.set(1 - l * 0.22, 1, 1 - l * 0.22);
      cone.castShadow = true;
      group.add(cone);
    }
    group.position.copy(p);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.scale.setScalar(0.001);
    scene.add(group);
    planted.push(group);
    if (planted.length > 40) scene.remove(planted.shift());
    if (typeof gsap !== 'undefined'){
      gsap.to(group.scale, { x: s, y: s, z: s, duration: 1.4, ease: 'elastic.out(1,0.45)' });
    } else {
      group.scale.setScalar(s);
    }
  }
  const heroEl = document.querySelector('header');
  if (heroEl){
    heroEl.addEventListener('click', e => {
      if (e.target.closest('a,button,textarea,.terminal')) return;
      plantTree(e.clientX, e.clientY);
    });
  }

  /* --- vallende sterren (alleen 's nachts) --- */
  const starTex = (function(){
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
  function fallingStar(){
    if (dayState.v < 0.4 && document.visibilityState === 'visible' && typeof gsap !== 'undefined' && !reducedMotion){
      const mat = new THREE.SpriteMaterial({ map: starTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const star = new THREE.Sprite(mat);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const beginX = -45 + Math.random() * 90;
      const beginY = 30 + Math.random() * 14;
      const dx = (18 + Math.random() * 22) * direction;
      const dy = -(6 + Math.random() * 7);
      star.position.set(beginX, beginY, -70 - Math.random() * 20);
      mat.rotation = Math.atan2(dy, dx);
      star.scale.set(6.5, 0.35, 1);
      scene.add(star);
      const duration = 0.9 + Math.random() * 0.7;
      gsap.to(star.position, { x: beginX + dx, y: beginY + dy, duration: duration, ease: 'none' });
      gsap.to(mat, { opacity: .95, duration: duration * 0.25, ease: 'power1.in' });
      gsap.to(mat, { opacity: 0, duration: duration * 0.5, delay: duration * 0.5, ease: 'power1.out',
        onComplete(){ scene.remove(star); mat.dispose(); } });
    }
    setTimeout(fallingStar, 7000 + Math.random() * 14000);
  }
  setTimeout(fallingStar, 4000);

  /* --- dag/nacht-wissel --- */
  const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  function applyDayNight(){
    const d = dayState.v;
    scene.background.copy(lerpColor(0x012019, 0x8FB08D, d));
    scene.fog.color.copy(lerpColor(0x012A20, 0x7BA383, d));
    scene.fog.density = 0.052 - 0.018 * d;
    hemi.color.copy(lerpColor(0x2E6B57, 0xFFE3B0, d));
    hemi.groundColor.copy(lerpColor(0x01130E, 0x2E4A33, d));
    hemi.intensity = 0.7 + 0.35 * d;
    moon.color.copy(lerpColor(0xCFE8DE, 0xFFD9A0, d));
    moon.intensity = 1.05 + 0.85 * d;
    needleMat.color.copy(lerpColor(0x0A5240, 0x1F7A52, d));
    ground.material.color.copy(lerpColor(0x023124, 0x1D5435, d));
    grassMat.uniforms.fogColor.value.copy(lerpColor(0x012A20, 0x7BA383, d));
    grassMat.uniforms.fogDensity.value = 0.052 - 0.018 * d;
    grassMat.uniforms.colorA.value.copy(lerpColor(0x083A2B, 0x1A5A32, d));
    grassMat.uniforms.colorB.value.copy(lerpColor(0x14654A, 0x2E8B57, d));
    grassMat.uniforms.colorTip.value.copy(lerpColor(0x5FC493, 0x9BD96A, d));
    skyMat.uniforms.day.value = d;
    beamMat.uniforms.color.value.copy(lerpColor(0xB8F2D9, 0xFFDA8C, d));
    beamMat.uniforms.strength.value = 0.22 + 0.10 * d;
  }
  window.setDayNight = function(){
    const target = dayState.v < 0.5 ? 1 : 0;
    const button = document.getElementById('btn-day-night');
    if (button) button.textContent = target ? '☀️' : '🌙';
    document.body.classList.toggle('day', target === 1);
    if (typeof gsap !== 'undefined'){
      gsap.to(dayState, { v: target, duration: 2.6, ease: 'sine.inOut', onUpdate: applyDayNight });
    } else {
      dayState.v = target; applyDayNight();
    }
  };

  const clock = new THREE.Clock();
  function loop(){
    const t = clock.getElapsedTime();
    if (!reducedMotion){
      camera.position.x += ((mouseX*3) - camera.position.x) * 0.03;
      camera.position.y += ((3.2 - mouseY*1.2 + scrollDepth*4) - camera.position.y) * 0.03;
      camera.position.z = 26 - scrollDepth*8 + Math.sin(t*0.15)*0.6;
      camera.lookAt(0, 2.2, -6);
      const p = fireflyGeo.attributes.position;
      for (let i = 0; i < FIREFLY_COUNT; i++){
        p.array[i*3+1] += Math.sin(t*1.4 + fireflyPhase[i]) * 0.004;
        p.array[i*3]   += Math.cos(t*0.6 + fireflyPhase[i]) * 0.006;
      }
      p.needsUpdate = true;
      fireflyMat.opacity = (0.55 + Math.sin(t*2)*0.3) * (1 - dayState.v);
      wisps.forEach((sp,i) => { sp.position.x += Math.sin(t*0.05 + i)*0.012; });
      glow.intensity = (1.25 + Math.sin(t*1.8)*0.25) * (1 - dayState.v * 0.75);
      grassMat.uniforms.time.value = t;
      skyMat.uniforms.time.value = t;
      beamMat.uniforms.time.value = t;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
})();
