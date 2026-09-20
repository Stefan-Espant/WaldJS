# `wald grow`: public/ assets base-scoping — Design

**Issue:** #51 (follow-up van #41 → #45 → #47)

## Probleem

`wald grow` serveert `public/`-bestanden via `sirv(publicDir)` op het rauwe,
ongewijzigde `req.url`. Bij een geconfigureerde `config.base` (bijv.
`/my-forest/`) betekent dit dat een bestand als `public/robots.txt`
bereikbaar is op **zowel** `/robots.txt` als `/my-forest/robots.txt` — het
onprefixed pad hoort een 404 te zijn, net als bij pagina-routes (#45) en
`src/assets/*` (#47).

## Live-onderzochte aanname (belangrijk)

Voorafgaand aan dit ontwerp is met een live `wald grow`-server en `curl`
geverifieerd welke component het lek precies veroorzaakt, omdat de eerder
overwogen aanpak (leunen op Vite's eigen `vite.middlewares`-fallback om
onprefixed requests af te wijzen, zoals dat voor HMR-routes al correct werkt)
een aanname bevatte die nooit eerder getest was.

**Uitkomst:** die aanname klopt niet. `vite.middlewares` serveert bestanden
uit `publicDir` **ook zonder base-prefix**, vanaf de server-root — dit is
kennelijk bewust gedrag van Vite zelf, niet iets dat via onze `stripBase`
kan worden "meegepakt". Met andere woorden: zelfs als onze eigen `sirv`-call
volledig correct base-bewust wordt gemaakt, lekt het bestand alsnog via de
`vite.middlewares`-fallback verderop in de request-handler.

Dit is precies het soort aanname dat bij #45 ook fout bleek (zie memory:
"`/assets/*` valt al terug op Vite's eigen base-bewuste middleware" — ook
onwaar, leidde toen tot #47). Vandaar dat dit keer eerst live geprototyped is
vóór het ontwerp werd vastgelegd.

## Oplossing

Wanneer `routePath === null` (de request valt buiten `config.base`), wordt
er helemaal niet meer teruggevallen op `vite.middlewares` — direct een 404.
Voor `routePath !== null` blijft het bestaande patroon uit #47: `req.url`
tijdelijk herschrijven naar het van base ontdane `routePath` vóór de
`servePublic`-call, en daarna herstellen naar de originele `url` vóór verdere
afhandeling (matched page-route, of — nu dus alléén nog voor het
base-prefixed geval — de `vite.middlewares`-fallback).

Dit raakt alleen het pad waarin `routePath === null`. Bij de standaard
`base: '/'` retourneert `stripBase` altijd de ongewijzigde url (nooit
`null`), dus dit gedrag verandert niets voor projecten zonder `config.base`.

### Voor/na in `grow.ts`

**Nu (bug):**
```ts
servePublic(req, res, async () => {
  // ... matched op routePath, valt anders altijd terug op vite.middlewares
  // met het ORIGINELE (nooit herschreven) req.url — dus vite.middlewares
  // ziet altijd het onprefixed pad hier, en serveert het publicDir-bestand
  // alsnog.
})
```

**Straks (fix):**
```ts
const afterPublic = async () => {
  // ... ongewijzigd: page-route matching + vite.middlewares-fallback,
  // maar alleen bereikbaar wanneer routePath !== null.
}

if (routePath === null) {
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
} else {
  req.url = routePath
  servePublic(req, res, () => {
    req.url = url
    afterPublic()
  })
}
```

`handleRequest`, `stripBase`, de `/assets/*`-branch en de
component-styles-branch blijven ongewijzigd.

## Getest (live, met `base: '/my-forest/'` en `public/robots.txt`)

| Request | Verwacht | Resultaat |
|---|---|---|
| `GET /robots.txt` | 404 | ✅ 404 |
| `GET /my-forest/robots.txt` | 200, juiste inhoud | ✅ 200 |
| `GET /` | 404 (bestaand gedrag, #45) | ✅ 404 |
| `GET /my-forest/` | 200 | ✅ 200 |
| `GET /my-forest/@vite/client` (HMR) | 200 | ✅ 200 |
| `GET /my-forest/assets/<niet-bestaand>` (#47-pad) | 404, ongewijzigd gedrag | ✅ 404 |

## Testplan voor implementatie

- Unittests in `grow.test.ts` voor het nieuwe gedrag: een `routePath === null`
  request op een pad dat overeenkomt met een echt `public/`-bestand hoort
  nooit bij `servePublic` of `vite.middlewares` te belanden.
- Bestaande `stripBase`- en `handleRequest`-tests blijven ongewijzigd
  (geen wijziging aan die functies).
- Verplichte live-server-verificatie vóór mergen (vaste afspraak sinds #41):
  een draaiende `wald grow` met non-default `base` en een `public/`-bestand,
  curl tegen zowel het prefixed als onprefixed pad, plus een regressiecheck
  op de HMR-clientroute en het `#47`-`/assets/*`-pad.

## Niet in scope

- Geen wijziging aan `wald build`/de productie-adapter-serving — dit
  probleem is specifiek voor de dev-server in `wald grow`.
- Geen generieke oplossing voor "elke toekomstige Vite-middleware die base
  misschien negeert" — mocht een volgend gat opduiken, wordt dat (net als
  #41→#45→#47→#51) apart behandeld met dezelfde live-verificatie-aanpak.
