import { SafeHtml } from '@waldjs/runtime'

// Every bilingual string on the marketing site, grouped per component or page.
// The site serves both languages on one URL: ui.<group>.<key> renders a
// <span class="nl"> + <span class="en"> pair and 02-taal.css hides the
// inactive one. Values are trusted HTML (they may contain <b>, <code>, …).
// The blog is the exception: it has per-locale URLs and uses t() in lib/blog.ts.

export type Bilingual = { nl: string; en: string }

export const STRINGS = {
  benchmarks: {
    title: {
      nl: 'Snel als een sprintende hertenbok',
      en: 'Fast as a sprinting deer',
    },
    intro: {
      nl: "Interne metingen op een blog met 1.000 Markdown-pagina's, vergeleken met Astro en Eleventy.",
      en: 'Internal measurements on a blog with 1,000 Markdown pages, compared to Astro and Eleventy.',
    },
    buildTime: {
      nl: 'Buildtijd',
      en: 'Build time',
    },
    buildTimeNote: {
      nl: "1.000 pagina's · lager is beter",
      en: '1,000 pages · lower is better',
    },
    devStart: {
      nl: 'Dev-server start',
      en: 'Dev server startup',
    },
    devStartNote: {
      nl: 'koude start · lager is beter',
      en: 'cold start · lower is better',
    },
    js: {
      nl: 'JavaScript voor 10 counters',
      en: 'JavaScript for 10 counters',
    },
    jsNote: {
      nl: 'built output · lager is beter',
      en: 'built output · lower is better',
    },
  },
  common: {
    growthLog: {
      nl: 'Groeidagboek',
      en: 'Growth log',
    },
    why: {
      nl: 'Waarom WaldJS',
      en: 'Why WaldJS',
    },
    format: {
      nl: 'Het .wald-formaat',
      en: 'The .wald format',
    },
  },
  changelog: {
    intro: {
      nl: 'Elke release een jaarring. Dit is er tot nu toe gegroeid.',
      en: "Every release a growth ring. Here's what has grown so far.",
    },
    npmNote: {
      nl: 'huidige npm-versie — de fasenamen hieronder zijn mijlpalen, geen versienummers',
      en: 'current npm version — the phase names below are milestones, not version numbers',
    },
    seeAll: {
      nl: 'Bekijk alle updates',
      en: 'See all updates',
    },
  },
  cli: {
    title: {
      nl: "Vier commando's, één bos",
      en: 'Four commands, one forest',
    },
    create: {
      nl: 'Maak een nieuw project aan.',
      en: 'Create a new project.',
    },
    dev: {
      nl: 'Start de dev-server op <b>localhost:7233</b>.',
      en: 'Start the dev server at <b>localhost:7233</b>.',
    },
    build: {
      nl: 'Bouw naar <b>dist/</b> (Vite SSR + statische pre-render).',
      en: 'Build to <b>dist/</b> (Vite SSR + static pre-render).',
    },
    preview: {
      nl: 'Bekijk de build op <b>localhost:4321</b>.',
      en: 'Preview the build at <b>localhost:4321</b>.',
    },
  },
  faq: {
    title: {
      nl: 'Veelgestelde vragen',
      en: 'Frequently asked questions',
    },
    whyQ: {
      nl: 'Waarom nóg een framework?',
      en: 'Why yet another framework?',
    },
    whyA: {
      nl: 'WaldJS is compromisloos content-first: één .wald-bestandsformaat, nul kilobyte JavaScript standaard, en een terminologie die je kunt onthouden. Geen configuratie-oerwoud — gewoon planten en groeien.',
      en: 'WaldJS is uncompromisingly content-first: one .wald file format, zero kilobytes of JavaScript by default, and terminology you can actually remember. No configuration jungle — just plant and grow.',
    },
    productionQ: {
      nl: 'Is WaldJS klaar voor productie?',
      en: 'Is WaldJS production-ready?',
    },
    productionA: {
      nl: 'Nog niet helemaal — het framework is in actieve ontwikkeling. Fase 0 t/m 2b en 4a/4b zijn af; client-side hydration (fase 3) is onderweg. Voor statische sites zonder interactiviteit kun je vandaag al bouwen.',
      en: 'Not quite yet — the framework is in active development. Phases 0 through 2b and 4a/4b are complete; client-side hydration (phase 3) is on its way. For static sites without interactivity you can build today.',
    },
    migrateQ: {
      nl: 'Kan ik migreren vanaf Astro?',
      en: 'Can I migrate from Astro?',
    },
    migrateA: {
      nl: 'De concepten lijken sterk op elkaar: frontmatter + template, file-based routing, content collections en getStaticPaths() werken vrijwel hetzelfde. Meestal is het hernoemen van .astro naar .wald en het aanpassen van imports naar wald:content het grootste werk.',
      en: 'The concepts are very similar: frontmatter + template, file-based routing, content collections and getStaticPaths() work almost identically. Usually renaming .astro to .wald and updating imports to wald:content is the bulk of the work.',
    },
    viteQ: {
      nl: 'Werken mijn Vite-plugins?',
      en: 'Do my Vite plugins work?',
    },
    viteA: {
      nl: 'Ja — via het vite-blok in wald.config.ts gaat alles rechtstreeks naar Vite door, inclusief plugins en resolve-opties.',
      en: 'Yes — the vite block in wald.config.ts passes everything straight through to Vite, including plugins and resolve options.',
    },
  },
  features: {
    title: {
      nl: 'Alles wat een bos nodig heeft',
      en: 'Everything a forest needs',
    },
    pagesTag: {
      nl: "Pagina's",
      en: 'Pages',
    },
    pagesTitle: {
      nl: 'Bestanden worden vanzelf routes',
      en: 'Files become routes automatically',
    },
    pagesBody: {
      nl: 'Elk bestand in <b>src/pages/</b> wordt automatisch een route. Geen router-configuratie, geen gedoe.',
      en: 'Every file in <b>src/pages/</b> automatically becomes a route. No router configuration, no fuss.',
    },
    contentTag: {
      nl: 'Bestand',
      en: 'File',
    },
    contentTitle: {
      nl: 'Markdown als voedingsbodem',
      en: 'Markdown as fertile soil',
    },
    contentBody: {
      nl: 'Zet Markdown-bestanden in <b>content/&lt;collectie&gt;/</b> en importeer <b>getCollection</b> en <b>getEntry</b> uit <b>wald:content</b>. Elk item heeft een <b>slug</b>, <b>data</b> (frontmatter) en <b>body</b> (gerenderde HTML).',
      en: 'Put Markdown files in <b>content/&lt;collection&gt;/</b> and import <b>getCollection</b> and <b>getEntry</b> from <b>wald:content</b>. Each entry has a <b>slug</b>, <b>data</b> (frontmatter) and <b>body</b> (rendered HTML).',
    },
    dynamicTag: {
      nl: 'Dynamische routes',
      en: 'Dynamic routes',
    },
    dynamicTitle: {
      nl: 'getStaticPaths() bepaalt wat er groeit',
      en: 'getStaticPaths() decides what grows',
    },
    dynamicBody: {
      nl: "Exporteer <b>getStaticPaths()</b> vanuit de frontmatter van een dynamische route zoals <b>[slug].wald</b>. Bij <b>wald build</b> wordt die aangeroepen om te bepalen welke pagina's gegenereerd worden. <b>$$props</b> bevat de route-parameters tijdens het renderen.",
      en: 'Export <b>getStaticPaths()</b> from the frontmatter of a dynamic route like <b>[slug].wald</b>. <b>wald build</b> calls it to know which pages to generate. <b>$$props</b> contains the route params during rendering.',
    },
  },
  footer: {
    privacy: {
      nl: 'Privacy',
      en: 'Privacy',
    },
    terms: {
      nl: 'Voorwaarden',
      en: 'Terms',
    },
    tagline: {
      nl: 'Een content-first webframework voor razendsnelle, statische websites. Plant je site en laat hem groeien.',
      en: 'A content-first web framework for blazing-fast, static websites. Plant your site and watch it grow.',
    },
    explore: {
      nl: 'Verken',
      en: 'Explore',
    },
    resources: {
      nl: 'Bronnen',
      en: 'Resources',
    },
    structure: {
      nl: 'Projectstructuur',
      en: 'Project structure',
    },
    plantedWithLove: {
      nl: 'Geplant met liefde',
      en: 'Planted with love',
    },
  },
  format: {
    tag: {
      nl: 'Het bestandsformaat',
      en: 'The file format',
    },
    title: {
      nl: 'Eén <span style="color:var(--rood)">.wald</span>-bestand, twee delen',
      en: 'One <span style="color:var(--rood)">.wald</span> file, two parts',
    },
    frontmatter: {
      nl: 'Boven de <b>---</b> schrijf je gewone JavaScript of TypeScript (frontmatter). Daaronder een HTML-template waarin <b>&#123;expressies&#125;</b> waarden interpoleren.',
      en: 'Above the <b>---</b> you write plain JavaScript or TypeScript (frontmatter). Below it an HTML template where <b>&#123;expressions&#125;</b> interpolate values.',
    },
    escaping: {
      nl: 'Alle geïnterpoleerde waarden worden standaard HTML-escaped. Veilig vanaf de wortel.',
      en: 'All interpolated values are HTML-escaped by default. Safe from the roots up.',
    },
    welcome: {
      nl: 'Welkom in je bos.',
      en: 'Welcome to your forest.',
    },
  },
  hero: {
    title: {
      nl: 'Plant je site.<br><em>Laat hem groeien.</em>',
      en: 'Plant your site.<br><em>Watch it grow.</em>',
    },
    lead: {
      nl: 'WaldJS is een content-first webframework voor razendsnelle, statische websites. Schrijf <code style="font-family:var(--mono);font-size:.9em">.wald</code>-bestanden — deels frontmatter, deels HTML-template — en WaldJS compileert ze tot een statische site.',
      en: 'WaldJS is a content-first web framework for blazing-fast, static-first websites. Write <code style="font-family:var(--mono);font-size:.9em">.wald</code> files — part frontmatter, part HTML template — and WaldJS compiles them into a static site.',
    },
    cta: {
      nl: 'Plant je eerste bos 🌱',
      en: 'Plant your first forest 🌱',
    },
    github: {
      nl: 'Bekijk op GitHub',
      en: 'View on GitHub',
    },
    openSource: {
      nl: 'Open source',
      en: 'Open source',
    },
    tip: {
      nl: '🌱 Tip: klik ergens in het bos om een boom te planten',
      en: '🌱 Tip: click anywhere in the forest to plant a tree',
    },
  },
  metaphor: {
    tag: {
      nl: 'De bos-metafoor',
      en: 'The forest metaphor',
    },
    title: {
      nl: 'Denk in bomen, niet in buzzwords',
      en: 'Think in trees, not buzzwords',
    },
    intro: {
      nl: 'WaldJS gebruikt overal een bos-metafoor. Eén terminologie, van CLI tot compiler.',
      en: 'WaldJS uses a forest metaphor throughout. One terminology, from CLI to compiler.',
    },
    forest: {
      nl: 'Het bos — je hele website.',
      en: 'The forest — your whole website.',
    },
    roots: {
      nl: 'De compiler die <code style="font-family:var(--mono)">.wald</code>-bestanden transformeert.',
      en: 'The compiler that transforms <code style="font-family:var(--mono)">.wald</code> files.',
    },
    trees: {
      nl: "Pagina's — <code style=\"font-family:var(--mono)\">.wald</code>-bestanden in <code style=\"font-family:var(--mono)\">src/pages/</code>.",
      en: 'Pages — <code style="font-family:var(--mono)">.wald</code> files in <code style="font-family:var(--mono)">src/pages/</code>.',
    },
    branches: {
      nl: 'Componenten — herbruikbare <code style="font-family:var(--mono)">.wald</code>-bestanden.',
      en: 'Components — reusable <code style="font-family:var(--mono)">.wald</code> files.',
    },
    canopy: {
      nl: 'Client-side hydration <i>(komt in Fase 3)</i>.',
      en: 'Client-side hydration <i>(coming in Phase 3)</i>.',
    },
  },
  packages: {
    title: {
      nl: 'Het ecosysteem',
      en: 'The ecosystem',
    },
    compiler: {
      nl: '.wald → JS-modules',
      en: '.wald → JS modules',
    },
  },
  playground: {
    title: {
      nl: 'Probeer het zelf',
      en: 'Try it yourself',
    },
    intro: {
      nl: 'Bewerk het .wald-bestand links en zie de pagina rechts direct meegroeien.',
      en: 'Edit the .wald file on the left and watch the page grow on the right.',
    },
  },
  quickstart: {
    title: {
      nl: 'Van zaadje tot site in 30 seconden',
      en: 'From seed to site in 30 seconds',
    },
    intro: {
      nl: 'Eén commando en je bos staat. Kies npm of pnpm.',
      en: 'One command and your forest is planted. Choose npm or pnpm.',
    },
    npm: {
      nl: 'Nieuw project planten',
      en: 'Plant a new project',
    },
    pnpm: {
      nl: 'Of met pnpm',
      en: 'Or with pnpm',
    },
  },
  roadmap: {
    title: {
      nl: 'Van wortel tot kruinlaag',
      en: 'From roots to canopy',
    },
    compiler: {
      nl: 'Compiler (parser + transform)',
      en: 'Compiler (parser + transform)',
    },
    components: {
      nl: 'Componenten + layouts',
      en: 'Components + layouts',
    },
    adapters: {
      nl: 'Deployment-adapters',
      en: 'Deployment adapters',
    },
    apiRoutes: {
      nl: "API routes: server-endpoints naast statische pagina's",
      en: 'API routes: server endpoints alongside static pages',
    },
    viewTransitions: {
      nl: 'View Transitions: ingebouwde paginaovergangen',
      en: 'View Transitions: built-in page transitions',
    },
    i18n: {
      nl: 'i18n-routing: locale-prefixed routes in de router',
      en: 'i18n routing: locale-prefixed routes in the router',
    },
    sitemapRss: {
      nl: 'Sitemap & RSS als officiële CLI-integratie',
      en: 'Sitemap & RSS as an official CLI integration',
    },
    middleware: {
      nl: 'Middleware: request-hooks vóór routing',
      en: 'Middleware: request hooks before routing',
    },
    phase5Note: {
      nl: 'Fase 5 is een ideeënlijst, nog niet uitgewerkt als GitHub issue — een richting, geen belofte.',
      en: 'Phase 5 is a list of ideas, not yet written up as a GitHub issue — a direction, not a promise.',
    },
  },
  structure: {
    caption: {
      nl: 'projectstructuur',
      en: 'project structure',
    },
    publicNote: {
      nl: '1-op-1 naar dist/',
      en: 'copied to dist/ as-is',
    },
    optional: {
      nl: 'optioneel',
      en: 'optional',
    },
    tag: {
      nl: 'Structuur &amp; config',
      en: 'Structure &amp; config',
    },
    title: {
      nl: 'Overzichtelijk als een aangeplant bos',
      en: 'As orderly as a planted forest',
    },
    config: {
      nl: 'Configureren kan met een optionele <b>wald.config.ts</b> in de projectroot — <b>adapter</b>, <b>outDir</b>, <b>base</b> voor sub-directory-deploys, en een <b>vite</b>-blok dat rechtstreeks naar Vite gaat (plugins, resolve, etc.). Zonder config gebruikt WaldJS verstandige standaardwaarden.',
      en: 'Configure via an optional <b>wald.config.ts</b> in your project root — <b>adapter</b>, <b>outDir</b>, <b>base</b> for sub-directory deploys, and a <b>vite</b> block passed straight to Vite (plugins, resolve, etc.). Without a config file WaldJS uses sensible defaults.',
    },
  },
  comparison: {
    tag: {
      nl: 'Vergelijking',
      en: 'Comparison',
    },
    title: {
      nl: 'Hoe verhoudt Wald zich?',
      en: 'How does Wald compare?',
    },
    singleFile: {
      nl: 'Single-file formaat (frontmatter + template)',
      en: 'Single-file format (frontmatter + template)',
    },
    partly: {
      nl: 'deels',
      en: 'partial',
    },
    zeroJs: {
      nl: '0 KB JavaScript standaard',
      en: '0 KB JavaScript by default',
    },
    vite: {
      nl: 'Vite-integratie',
      en: 'Vite integration',
    },
    canopies: {
      nl: "canopy's",
      en: 'canopies',
    },
    terminology: {
      nl: 'Bos-terminologie',
      en: 'Forest terminology',
    },
  },
  layout: {
    skipLink: {
      nl: 'Ga naar inhoud',
      en: 'Skip to content',
    },
  },
  changelogPost: {
    back: {
      nl: 'Terug naar alle updates',
      en: 'Back to all updates',
    },
  },
  vs: {
    tag: {
      nl: 'Vergelijking',
      en: 'Comparison',
    },
    whenWhich: {
      nl: 'Wanneer kies je wat?',
      en: 'When to choose which?',
    },
    chooseWald: {
      nl: 'Kies WaldJS als je...',
      en: 'Choose WaldJS if you...',
    },
    readStory: {
      nl: 'Lees het hele verhaal van WaldJS →',
      en: "Read WaldJS's full story →",
    },
  },
  vsAstro: {
    intro: {
      nl: "Beide gebruiken single-file componenten, content collections en 0 KB JavaScript standaard. Het verschil zit 'm in scope en ecosysteem.",
      en: 'Both use single-file components, content collections, and 0 KB JavaScript by default. The difference is in scope and ecosystem.',
    },
    wald1: {
      nl: 'bouwsnelheid zwaar laat wegen — 1,62s versus 138,92s voor dezelfde 50-posts-blogsite in onze eigen benchmarks',
      en: 'weigh build speed heavily — 1.62s vs. 138.92s for the same 50-post blog site in our own benchmarks',
    },
    wald2: {
      nl: "geen framework-adapter wilt kiezen voor interactiviteit — canopy's zijn gewone JS/TS, geen React/Vue/Svelte-laag erbovenop",
      en: "don't want to choose a framework adapter for interactivity — canopies are plain JS/TS, no React/Vue/Svelte layer on top",
    },
    chooseAstro: {
      nl: 'Kies Astro als je...',
      en: 'Choose Astro if you...',
    },
    astro1: {
      nl: 'een volwassen ecosysteem met veel officiële integraties nodig hebt (React, Vue, Svelte als islands)',
      en: 'need a mature ecosystem with many official integrations (React, Vue, Svelte as islands)',
    },
    astro2: {
      nl: 'een grotere community en meer bestaande plugins/templates wilt',
      en: 'want a larger community and more existing plugins/templates',
    },
  },
  vsEleventy: {
    intro: {
      nl: 'Eleventy is een extreem volwassen, templating-taal-onafhankelijke generator. WaldJS kiest bewust voor één formaat en Vite-integratie.',
      en: 'Eleventy is an extremely mature, templating-language-agnostic generator. WaldJS deliberately picks one format and Vite integration.',
    },
    wald1: {
      nl: 'Vite-gedreven dev-ervaring en TypeScript-first single-file componenten wilt',
      en: 'want a Vite-powered dev experience and TypeScript-first single-file components',
    },
    wald2: {
      nl: 'ingebouwde partial hydration wilt zonder losse plugins te hoeven zoeken',
      en: 'want built-in partial hydration without hunting for separate plugins',
    },
    chooseEleventy: {
      nl: 'Kies Eleventy als je...',
      en: 'Choose Eleventy if you...',
    },
    eleventy1: {
      nl: 'maximale flexibiliteit in templating-talen wilt (Nunjucks, Liquid, en meer)',
      en: 'want maximum flexibility in templating languages (Nunjucks, Liquid, and more)',
    },
    eleventy2: {
      nl: 'een extreem stabiele, al jarenlang bewezen tool met een groot plugin-ecosysteem zoekt',
      en: 'want an extremely stable, long-proven tool with a large plugin ecosystem',
    },
  },
  why: {
    tag: {
      nl: 'Filosofie',
      en: 'Philosophy',
    },
    title: {
      nl: 'Waarom WaldJS?',
      en: 'Why WaldJS?',
    },
    intro: {
      nl: 'Nog een framework. We snappen het — er zijn er al genoeg. Maar WaldJS vraagt weinig: één bestandsformaat, geen losse tooling, en je bent binnen een paar minuten weer weg als het niks voor je is.',
      en: "Yet another framework. We get it — there are plenty already. But WaldJS asks little of you: one file format, no separate tooling, and you can walk away in minutes if it's not for you.",
    },
    buildTitle: {
      nl: 'Bouwt in seconden, niet minuten',
      en: 'Builds in seconds, not minutes',
    },
    buildBody: {
      nl: 'Voor dezelfde 50-berichten-blogsite bouwt WaldJS in 1,62 seconden. Dat zijn onze eigen, gemeten <a href="/#benchmarks">benchmarks</a> — geen marketingclaim.',
      en: "For the same 50-post blog site, WaldJS builds in 1.62 seconds. That's our own, measured <a href=\"/#benchmarks\">benchmark data</a> — not a marketing claim.",
    },
    frameworkTitle: {
      nl: 'Geen framework-keuze om te maken',
      en: 'No framework choice to make',
    },
    frameworkBody: {
      nl: "Canopy's — de stukjes die interactief worden — zijn gewone JS/TS-modules. Geen adapter om te kiezen, geen extra dependency om te installeren. Je schrijft de code die je toch al zou schrijven, en WaldJS laadt 'm op het juiste moment.",
      en: "Canopies — the bits that become interactive — are plain JS/TS modules. No adapter to choose, no extra dependency to install. You write the code you'd write anyway, and WaldJS loads it at the right moment.",
    },
    formatTitle: {
      nl: 'Eén formaat, verder niets te installeren',
      en: 'One format, nothing else to install',
    },
    formatBody: {
      nl: "Een <code style=\"font-family:var(--mono);font-size:.85em\">.wald</code>-bestand is frontmatter en template in één geheel. De formatter (<code style=\"font-family:var(--mono);font-size:.85em\">wald format</code>) en leesbare foutpagina's in de dev-server zitten er al in — geen Prettier-config, geen losse plugin te zoeken.",
      en: 'A <code style="font-family:var(--mono);font-size:.85em">.wald</code> file is frontmatter and template as one whole. The formatter (<code style="font-family:var(--mono);font-size:.85em">wald format</code>) and readable dev-server error pages are already built in — no Prettier config, no separate plugin to hunt down.',
    },
    namesTitle: {
      nl: 'Namen die iets betekenen',
      en: 'Names that mean something',
    },
    namesBody: {
      nl: "Roots is de compiler, trees zijn je pagina's, branches je componenten, canopies de interactieve laag. Zodra je het bos-verhaal snapt, kun je <code style=\"font-family:var(--mono);font-size:.85em\">wald grow</code> raden zonder de docs te openen.",
      en: 'Roots is the compiler, trees are your pages, branches your components, canopies the interactive layer. Once you get the forest story, you can guess what <code style="font-family:var(--mono);font-size:.85em">wald grow</code> does without opening the docs.',
    },
    cta: {
      nl: 'Probeer het — 2 minuten',
      en: 'Try it — 2 minutes',
    },
  },
  terms: {
    tag: {
      nl: 'Juridisch',
      en: 'Legal',
    },
    title: {
      nl: 'Algemene voorwaarden &amp; disclaimer',
      en: 'Terms &amp; disclaimer',
    },
    updated: {
      nl: 'Laatst bijgewerkt: 3 oktober 2026',
      en: 'Last updated: 3 October 2026',
    },
    intro: {
      nl: 'WaldJS is een gratis open-sourceproject van Stefan van der Kort, onderhouden als privépersoon en zonder winstoogmerk. Deze voorwaarden gelden voor het gebruik van deze website (waldjs.eu) en van de WaldJS-software. Door de website te bezoeken of de software te gebruiken, ga je met deze voorwaarden akkoord.',
      en: 'WaldJS is a free open-source project by Stefan van der Kort, maintained as a private individual and not for profit. These terms apply to the use of this website (waldjs.eu) and of the WaldJS software. By visiting the website or using the software, you agree to these terms.',
    },
    softwareTitle: {
      nl: 'De software: zoals hij is',
      en: 'The software: as is',
    },
    softwareBody: {
      nl: 'WaldJS wordt verspreid onder de <a href="https://github.com/Stefan-Espant/WaldJS/blob/main/LICENSE" target="_blank" rel="noopener">MIT-licentie</a>. De software wordt geleverd zoals hij is (<i>as is</i>), zonder enige garantie, uitdrukkelijk of stilzwijgend, op werking, geschiktheid voor een bepaald doel of het ontbreken van fouten. Je gebruikt WaldJS op eigen risico en bent zelf verantwoordelijk voor het testen, beveiligen en onderhouden van wat je ermee bouwt.',
      en: 'WaldJS is distributed under the <a href="https://github.com/Stefan-Espant/WaldJS/blob/main/LICENSE" target="_blank" rel="noopener">MIT license</a>. The software is provided as is, without warranty of any kind, express or implied, as to its operation, fitness for a particular purpose or freedom from errors. You use WaldJS at your own risk and are responsible for testing, securing and maintaining whatever you build with it.',
    },
    othersTitle: {
      nl: 'Niet verantwoordelijk voor anderen',
      en: 'Not responsible for others',
    },
    othersIntro: {
      nl: 'Ik ben niet verantwoordelijk of aansprakelijk voor de daden, nalatigheden, inhoud of uitspraken van anderen. Dat geldt in het bijzonder voor:',
      en: 'I am not responsible or liable for the actions, omissions, content or statements of others. This applies in particular to:',
    },
    othersSites: {
      nl: 'websites, apps en andere projecten die derden met WaldJS bouwen, inclusief hun inhoud, beveiliging en naleving van wet- en regelgeving;',
      en: 'websites, apps and other projects that third parties build with WaldJS, including their content, security and legal compliance;',
    },
    othersPlugins: {
      nl: 'plugins, packages, templates en integraties van derden, ook als die met WaldJS samenwerken of ernaar verwijzen;',
      en: 'third-party plugins, packages, templates and integrations, even when they work with or refer to WaldJS;',
    },
    othersContributions: {
      nl: 'bijdragen van anderen aan het project, zoals pull requests, issues, discussies en reacties;',
      en: 'contributions to the project by others, such as pull requests, issues, discussions and comments;',
    },
    othersLinks: {
      nl: 'externe websites waarnaar deze site linkt, zoals GitHub en npm.',
      en: 'external websites this site links to, such as GitHub and npm.',
    },
    othersOutro: {
      nl: 'Wie WaldJS gebruikt of eraan bijdraagt, blijft zelf verantwoordelijk voor het eigen handelen en voor wat er gepubliceerd wordt.',
      en: 'Anyone who uses or contributes to WaldJS remains responsible for their own actions and for what they publish.',
    },
    liabilityTitle: {
      nl: 'Beperking van aansprakelijkheid',
      en: 'Limitation of liability',
    },
    liabilityBody: {
      nl: 'Voor zover de wet dat toestaat, ben ik niet aansprakelijk voor directe of indirecte schade door het gebruik van deze website of de software, of doordat je die niet kunt gebruiken. Denk aan gegevensverlies, gederfde inkomsten, bedrijfsstilstand of schade aan derden. Deze beperking geldt niet bij opzet of bewuste roekeloosheid.',
      en: 'To the extent permitted by law, I am not liable for any direct or indirect damage arising from the use of, or inability to use, this website or the software, such as data loss, lost revenue, business interruption or damage to third parties. This limitation does not apply in cases of intent or deliberate recklessness.',
    },
    infoTitle: {
      nl: 'Informatie op deze website',
      en: 'Information on this website',
    },
    infoBody: {
      nl: 'Ik stel de informatie op deze website, waaronder benchmarks, vergelijkingen en de roadmap, zo zorgvuldig mogelijk samen, maar kan niet garanderen dat die altijd juist, volledig of actueel is. Benchmarks zijn interne metingen en zeggen niets zeker over de resultaten in jouw situatie. Aan de inhoud van deze website kunnen geen rechten worden ontleend.',
      en: 'I put the information on this website, including benchmarks, comparisons and the roadmap, together as carefully as possible, but cannot guarantee that it is always accurate, complete or up to date. Benchmarks are internal measurements and do not guarantee results in your situation. No rights can be derived from the content of this website.',
    },
    nameTitle: {
      nl: 'Naam en logo',
      en: 'Name and logo',
    },
    nameBody: {
      nl: 'De MIT-licentie geldt voor de broncode. De naam WaldJS, het logo en de vormgeving van deze website vallen daar niet onder. Gebruik ze niet op een manier die suggereert dat jouw project officieel bij WaldJS hoort of erdoor wordt aanbevolen.',
      en: 'The MIT license covers the source code. The WaldJS name, the logo and the design of this website are not covered by it. Do not use them in a way that suggests your project is officially part of or endorsed by WaldJS.',
    },
    changesTitle: {
      nl: 'Wijzigingen',
      en: 'Changes',
    },
    changesBody: {
      nl: 'Ik kan deze voorwaarden op elk moment aanpassen. De datum bovenaan laat zien wanneer dat voor het laatst is gebeurd. Blijf je de website of de software na een wijziging gebruiken, dan ga je akkoord met de nieuwe versie.',
      en: 'I may change these terms at any time. The date at the top shows when that last happened. If you keep using the website or the software after a change, you agree to the new version.',
    },
    lawTitle: {
      nl: 'Toepasselijk recht en contact',
      en: 'Governing law and contact',
    },
    lawBody: {
      nl: 'Op deze voorwaarden is Nederlands recht van toepassing. Bij verschillen tussen de Nederlandse en de Engelse tekst geldt de Nederlandse. Blijkt een bepaling ongeldig, dan blijven de overige bepalingen gewoon van kracht. Vragen? Open een <a href="https://github.com/Stefan-Espant/WaldJS/issues" target="_blank" rel="noopener">issue op GitHub</a>.',
      en: 'These terms are governed by Dutch law. If the Dutch and English texts differ, the Dutch text prevails. If any provision turns out to be invalid, the remaining provisions stay in full force. Questions? Open an <a href="https://github.com/Stefan-Espant/WaldJS/issues" target="_blank" rel="noopener">issue on GitHub</a>.',
    },
  },
  privacy: {
    tag: {
      nl: 'Juridisch',
      en: 'Legal',
    },
    title: {
      nl: 'Privacyverklaring',
      en: 'Privacy statement',
    },
    updated: {
      nl: 'Laatst bijgewerkt: 4 oktober 2026',
      en: 'Last updated: 4 October 2026',
    },
    intro: {
      nl: 'Deze website (waldjs.eu) wordt beheerd door Stefan van der Kort als privépersoon. Hier lees je welke gegevens er worden verwerkt als je de site bezoekt. Kort gezegd: geen cookies, geen tracking over websites heen en geen persoonsgegevens die ik zelf bewaar.',
      en: 'This website (waldjs.eu) is run by Stefan van der Kort as a private individual. This page explains which data is processed when you visit the site. In short: no cookies, no cross-site tracking and no personal data stored by me.',
    },
    analyticsTitle: {
      nl: 'Bezoekersstatistieken',
      en: 'Visitor statistics',
    },
    analyticsBody: {
      nl: 'Om te zien hoe de site gebruikt wordt, gebruik ik <a href="https://umami.is" target="_blank" rel="noopener">Umami</a>, een privacyvriendelijke analysedienst. Umami plaatst geen cookies en slaat geen IP-adressen op. Er wordt alleen geanonimiseerd bijgehouden welke pagina’s bezocht worden, via welke website je binnenkwam, welk type browser, besturingssysteem en apparaat je gebruikt, en uit welk land je komt. Die gegevens zijn niet naar jou als persoon te herleiden. Ze staan op servers in de EU (Duitsland) van Umami Software, Inc., een Amerikaans bedrijf.',
      en: 'To see how the site is used, I use <a href="https://umami.is" target="_blank" rel="noopener">Umami</a>, a privacy-friendly analytics service. Umami sets no cookies and does not store IP addresses. It only records, anonymously, which pages are visited, which website referred you, what type of browser, operating system and device you use, and which country you are in. This data cannot be traced back to you as a person. It is stored on servers in the EU (Germany) operated by Umami Software, Inc., a US company.',
    },
    thirdTitle: {
      nl: 'Externe diensten',
      en: 'Third-party services',
    },
    thirdIntro: {
      nl: 'Voor lettertypen, animaties en GitHub-gegevens laadt de site bestanden van andere partijen. Zoals bij elk verzoek op internet krijgt die partij daarbij je IP-adres te zien:',
      en: 'For fonts, animations and GitHub data, the site loads files from other parties. As with any request on the internet, that party sees your IP address:',
    },
    thirdFonts: {
      nl: 'Google Fonts en Adobe Fonts (Typekit), voor de lettertypen;',
      en: 'Google Fonts and Adobe Fonts (Typekit), for the fonts;',
    },
    thirdCdn: {
      nl: 'cdnjs (Cloudflare), voor de animatiebibliotheken three.js en GSAP;',
      en: 'cdnjs (Cloudflare), for the three.js and GSAP animation libraries;',
    },
    thirdGithub: {
      nl: 'GitHub en shields.io, voor het aantal sterren en de actuele versie;',
      en: 'GitHub and shields.io, for the star count and the current version;',
    },
    thirdLinks: {
      nl: 'GitHub en npm, als je op een link naar die sites klikt.',
      en: 'GitHub and npm, when you click a link to those sites.',
    },
    thirdOutro: {
      nl: 'Wat die partijen met deze gegevens doen, valt buiten mijn invloed. Daarvoor gelden hun eigen privacyverklaringen.',
      en: 'What those parties do with this data is outside my control; their own privacy policies apply.',
    },
    storageTitle: {
      nl: 'Opslag in je browser',
      en: 'Storage in your browser',
    },
    storageBody: {
      nl: 'De site onthoudt je gekozen taal in de lokale opslag (localStorage) van je browser. Dat gegeven blijft op je eigen apparaat, wordt niet naar mij verstuurd en kun je altijd wissen via je browserinstellingen.',
      en: 'The site remembers your chosen language in your browser’s local storage (localStorage). That value stays on your own device, is never sent to me, and you can clear it at any time in your browser settings.',
    },
    rightsTitle: {
      nl: 'Je rechten',
      en: 'Your rights',
    },
    rightsBody: {
      nl: 'Omdat ik zelf geen persoonsgegevens bewaar, is er meestal niets in te zien of te verwijderen. Heb je toch een vraag over je gegevens, open dan een <a href="https://github.com/Stefan-Espant/WaldJS/issues" target="_blank" rel="noopener">issue op GitHub</a> (zet daar geen persoonsgegevens in). Ben je het niet eens met hoe er met je gegevens wordt omgegaan, dan kun je een klacht indienen bij de <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener">Autoriteit Persoonsgegevens</a>.',
      en: 'Since I store no personal data myself, there is usually nothing to access or delete. If you still have a question about your data, open an <a href="https://github.com/Stefan-Espant/WaldJS/issues" target="_blank" rel="noopener">issue on GitHub</a> (without including personal data). If you disagree with how your data is handled, you can file a complaint with the Dutch Data Protection Authority, the <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener">Autoriteit Persoonsgegevens</a>.',
    },
    changesTitle: {
      nl: 'Wijzigingen',
      en: 'Changes',
    },
    changesBody: {
      nl: 'Als er iets verandert, bijvoorbeeld omdat er een dienst bij komt, pas ik deze verklaring aan. De datum bovenaan laat zien wanneer dat voor het laatst is gebeurd.',
      en: 'If anything changes, for example because a service is added, I will update this statement. The date at the top shows when that last happened.',
    },
  },
} satisfies Record<string, Record<string, Bilingual>>

export function bilingualHtml({ nl, en }: Bilingual): string {
  return `<span class="nl">${nl}</span><span class="en">${en}</span>`
}

type Strings = typeof STRINGS
export const ui = Object.fromEntries(
  Object.entries(STRINGS).map(([group, entries]) => [
    group,
    Object.fromEntries(Object.entries(entries).map(([key, pair]) => [key, new SafeHtml(bilingualHtml(pair))])),
  ]),
) as { [G in keyof Strings]: { [K in keyof Strings[G]]: SafeHtml } }
