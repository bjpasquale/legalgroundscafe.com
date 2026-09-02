# Legal Grounds Café — legalgroundscafe.com

Static brochure site for Legal Grounds Café, 1208 Kirkwood Highway, Elsmere, DE 19805. Replaced the
Squarespace site in September 2026. Ben manages it; the café is presented by the family law firm
(Doroshow, Pasquale, Krawitz & Bhaya) and is an OTHA-adjacent family business, not an OTHA property.

## How it works
- **No framework.** `node build.mjs` renders `dist/` from `data/*.json` plus hand-written page
  templates inside `build.mjs`. Shared styles in `assets/site.css`; the open-now badge and closure
  banner are `assets/site.js` (client-side, from hours embedded in each page).
- **Data is the source of truth.** `data/menu.json` (items, prices, dietary tags, seasonal block),
  `data/hours.json` (regular hours, holiday closures, one-off overrides), `data/site.json` (address,
  phone, links, form endpoint), `data/press.json` (press, review sites, guest quotes). Edit the JSON,
  never the generated HTML. The menu page, footer hours, open-now badge, and JSON-LD all derive
  from these files, so a fact lives in exactly one place.
- **Deploy:** push to `main` → `.github/workflows/deploy.yml` builds and publishes to GitHub Pages.
  `dist/` is git-ignored. Until a `CNAME` file exists the workflow builds with
  `BASE=/<repo>` for the preview URL; adding `CNAME` (containing `legalgroundscafe.com`) switches
  it to the domain root.
- **Newsletter signup** links to Square's free hosted sign-up page (`site.json → signupUrl`); those emails land in Square's Collected Emails as the café's own data and export normally.
- **Forms** (private room request) post to FormSubmit at `site.json → formEndpoint`
  (info@legalgroundscafe.com). FormSubmit needs a one-time activation click from that inbox after
  the first submission. No account, no server.

- **Photos:** `assets/img/`. Placeholders (`.ph` blocks in `build.mjs`) mark where real photos go;
  swap each for an `<img>` when Ben supplies them. Keep images ≤ 1800px, JPEG ~82.
- **Money never changes hands on this site.** Gift cards and any ordering link out to Square.
  That keeps the site inside GitHub Pages' terms.

## Domain / DNS
- Registrar: Squarespace (Tucows) until transferred to Porkbun. Cutover order: stage the Porkbun
  zone → switch nameservers at Squarespace → transfer registrar → cancel the Squarespace site.
  Never transfer first; Squarespace blocks nameserver edits while a transfer is pending.
- GitHub Pages records: four apex A records (185.199.108–111.153) + `www` CNAME →
  `bjpasquale.github.io`. Enforce HTTPS in repo settings once the cert issues.
- Email: the domain has never had mail. Porkbun email forwarding sends info@ → lucretiatoth@dplaw.com.

## Verification
- `node build.mjs && python3 -m http.server -d dist 8000` and load `http://localhost:8000/`.
- After a deploy, curl the live page and grep for the changed string; a 200 alone proves nothing.
- Facts that still need Ben's confirmation are listed in `README.md`.
