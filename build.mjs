// Legal Grounds Café — static site builder. `node build.mjs` renders dist/ from data/*.json.
// BASE env prefixes internal links (e.g. "/legalgroundscafe.com" for the GitHub preview URL); "" for production.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "dist");
const BASE = (process.env.BASE || "").replace(/\/$/, "");
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));
const site = read("site.json"), hours = read("hours.json"), menu = read("menu.json"), press = read("press.json");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => "$" + n.toFixed(2);
const u = (p) => BASE + p;
const addr1 = site.address.street;
const addr2 = `${site.address.city}, ${site.address.state} ${site.address.zip}`;
const DAY_LABEL = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const fmtT = (t) => { const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; const hh = h % 12 || 12; return m ? `${hh}:${String(m).padStart(2, "0")}\u00a0${ap}` : `${hh}\u00a0${ap}`; };

// Group identical consecutive days for the compact hours line ("Mon–Fri 6:30 am – 3 pm").
function hoursGroups() {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const groups = [];
  for (const d of order) {
    const r = hours.regular[d]; const key = r ? `${r.open}-${r.close}` : "closed";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.days.push(d); else groups.push({ key, days: [d], r });
  }
  return groups.map((g) => ({
    label: g.days.length > 1 ? `${DAY_LABEL[g.days[0]].slice(0, 3)}–${DAY_LABEL[g.days[g.days.length - 1]].slice(0, 3)}` : DAY_LABEL[g.days[0]].slice(0, 3),
    text: g.r ? `${fmtT(g.r.open)} – ${fmtT(g.r.close)}` : "Closed",
  }));
}
const hoursLine = hoursGroups().map((g) => `${g.label} ${g.text}`).join(" · ");
const hoursList = hoursGroups().map((g) => `<li><span>${g.label}</span><span>${g.text}</span></li>`).join("");

// ---------- JSON-LD ----------
const orgLd = {
  "@context": "https://schema.org",
  "@type": "CafeOrCoffeeShop",
  name: site.name,
  url: site.url,
  telephone: site.phoneTel,
  email: site.email,
  image: `${site.url}/assets/img/room.jpg`,
  logo: `${site.url}/assets/img/logo.png`,
  priceRange: "$",
  servesCuisine: ["Coffee", "Breakfast", "Sandwiches", "Salads"],
  address: { "@type": "PostalAddress", streetAddress: addr1, addressLocality: site.address.city, addressRegion: site.address.state, postalCode: site.address.zip, addressCountry: "US" },
  geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
  hasMap: site.mapsUrl,
  openingHoursSpecification: Object.entries(hours.regular).map(([d, r]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY_LABEL[d], opens: r.open, closes: r.close })),
  hasMenu: `${site.url}/menu/`,
  acceptsReservations: "False",
  amenityFeature: [
    { "@type": "LocationFeatureSpecification", name: "Free parking lot", value: true },
    { "@type": "LocationFeatureSpecification", name: "Free Wi-Fi", value: true },
    { "@type": "LocationFeatureSpecification", name: "Outdoor seating", value: true },
    { "@type": "LocationFeatureSpecification", name: "Private dining room", value: true },
  ],
  sameAs: [site.social.instagram, site.social.facebook, site.social.yelp, site.social.tripadvisor],
};
const menuLd = {
  "@context": "https://schema.org",
  "@type": "Menu",
  name: `${site.name} menu`,
  url: `${site.url}/menu/`,
  hasMenuSection: menu.sections.map((s) => ({
    "@type": "MenuSection",
    name: s.title,
    hasMenuItem: s.items.map((it) => {
      const price = it.price ?? (it.prices || []).find((p) => p != null);
      const o = { "@type": "MenuItem", name: it.name };
      if (it.desc) o.description = it.desc;
      if (price != null) o.offers = { "@type": "Offer", price: price.toFixed(2), priceCurrency: "USD" };
      const diets = (it.tags || []).map((t) => ({ V: "https://schema.org/VegetarianDiet", VG: "https://schema.org/VeganDiet", GF: "https://schema.org/GlutenFreeDiet" }[t])).filter(Boolean);
      if (diets.length) o.suitableForDiet = diets;
      return o;
    }),
  })),
};

// ---------- Layout ----------
const NAV = [["/menu/", "Menu"], ["/private-room/", "Private Room"], ["/visit/", "Visit"], ["/story/", "Our Story"], ["/press/", "Press"]];
function layout({ path, title, desc, body, ld, current }) {
  const fullTitle = path === "/" ? `${site.name} · Elsmere, Delaware` : `${title} · ${site.name}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${site.url}${path}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${site.url}${path}">
<meta property="og:image" content="${site.url}/assets/img/room.jpg">
<meta name="theme-color" content="#5d7b62">
<link rel="icon" href="${u("/assets/img/figure.png")}" type="image/png">
<link rel="apple-touch-icon" href="${u("/assets/img/figure.png")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap">
<link rel="stylesheet" href="${u("/assets/site.css")}">
<script type="application/ld+json">${JSON.stringify(orgLd)}</script>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="banner" id="closure-banner" hidden></div>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${u("/")}" aria-label="${esc(site.name)} home"><img src="${u("/assets/img/figure.png")}" alt="" width="640" height="900"><span>Legal Grounds<br>Café</span></a>
    <nav class="nav" aria-label="Main">
      ${NAV.map(([p, l]) => `<a href="${u(p)}"${current === p ? ' aria-current="page"' : ""}>${l}</a>`).join("\n      ")}
    </nav>
    <span class="open-badge">${esc(hoursLine)}</span>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <img src="${u("/assets/img/figure.png")}" alt="" width="640" height="900">
        <div><span class="wordmark">Legal Grounds Café</span><span class="foot-sub">Elsmere, Delaware · since 2017</span><p class="credit">Presented by <a href="${site.lawFirm.url}" rel="noopener">${esc(site.lawFirm.name)}</a> and <a href="https://othde.com" rel="noopener">Old Town Hall Associates</a></p><p class="credit">From the same family: <a href="${site.sister.url}" rel="noopener">${site.sister.name}</a></p></div>
      </div>
      <div>
        <h2 class="foot-h">Find us</h2>
        <p>${esc(addr1)}<br>${esc(addr2)}</p>
        <p><a href="${site.directionsUrl}" rel="noopener">Directions</a> · free parking in back</p>
      </div>
      <div>
        <h2 class="foot-h">Hours</h2>
        <ul class="hours-list">${hoursList}</ul>
      </div>
      <div>
        <h2 class="foot-h">Reach us</h2>
        <p><a href="tel:${site.phoneTel}">${esc(site.phone)}</a><br><a href="mailto:${site.email}">${site.email}</a></p>
        <p class="foot-links"><a href="${site.social.instagram}" rel="noopener">Instagram</a><a href="${site.social.facebook}" rel="noopener">Facebook</a><a href="${site.social.yelp}" rel="noopener">Yelp</a><a href="${site.social.tripadvisor}" rel="noopener">TripAdvisor</a></p>
      </div>
    </div>
    <div class="fine">
      <span>© ${new Date().getFullYear()} Legal Grounds Café · ${esc(addr1)}, ${esc(addr2)}</span>
      <span><a href="${site.giftCardUrl}" rel="noopener">Gift cards</a></span>
    </div>
  </div>
</footer>
<script type="application/json" id="hours-data">${JSON.stringify({ timezone: hours.timezone, regular: hours.regular, closures: hours.closures, overrides: hours.overrides })}</script>
<script src="${u("/assets/site.js")}" defer></script>
</body>
</html>
`;
}

const SPEC = `<div class="spec"><div><b>${site.privateRoom.min}–${site.privateRoom.max}</b><span>seats at one long table</span></div><div><b>$0</b><span>reservation fee</span></div><div><b>Free lot</b><span>parking behind the building</span></div></div>`;
const ph = (label, ratio = "r43") => `<div class="ph ${ratio}" aria-hidden="true">Photo coming:<br>${esc(label)}</div>`;

// ---------- Pages ----------
const home = () => `
<section class="hero">
  <div class="wrap">
    <div class="hero-img"><img src="${u("/assets/img/hero-latte.jpg")}" alt="A cappuccino with latte art held up at the counter, with the café's tables and a wall of paintings behind." width="1016" height="1225" fetchpriority="high"></div>
    <div class="hero-text">
      <h1>Coffee, breakfast and lunch in Elsmere.</h1>
      <p class="lede">A small European-style café on Kirkwood Highway, minutes from downtown Wilmington. Everything made to order, seven days a week.</p>
      <ul class="facts">
        <li><span class="label">Hours</span><span>${esc(hoursLine)}</span></li>
        <li><span class="label">Where</span><span><a href="${site.directionsUrl}" rel="noopener">${esc(addr1)}, ${esc(site.address.city)}</a> · free parking in the back</span></li>
        <li><span class="label">Call</span><span><a href="tel:${site.phoneTel}">${esc(site.phone)}</a></span></li>
      </ul>
      <div class="btn-row"><a class="btn primary" href="${u("/menu/")}">See the menu</a><a class="btn" href="${u("/private-room/")}">Book the private room</a></div>
      <p class="presented">Presented by <a href="${site.lawFirm.url}" rel="noopener">${esc(site.lawFirm.name)}</a> &nbsp;·&nbsp; <a href="https://othde.com" rel="noopener">Old Town Hall Associates</a></p>
    </div>
  </div>
</section>

<div class="press-line"><div class="wrap creds"><a href="${press.headline.url}" rel="noopener"><span class="serif">“${esc(press.headline.text)}”</span><small>${esc(press.headline.outlet)}, ${press.headline.year}</small></a><a href="${site.social.tripadvisor}" rel="noopener"><span class="serif">#1 of 29 coffee &amp; tea spots in Wilmington</span><small>TripAdvisor travelers, 5.0 rating</small></a></div></div>

<section class="section">
  <div class="wrap">
    <div class="section-head"><span class="label">What people come back for</span><h2>Three things to order first.</h2></div>
    <div class="three">
      <div class="card"><img src="${u("/assets/img/breakfast-sandwich.jpg")}" alt="A bacon, egg and cheese on an everything bagel, cut in half, with sliced strawberries." width="1000" height="1000" loading="lazy"><h3>Breakfast sandwich</h3><p>Egg and cheese on a bagel, croissant or toast, with bacon, sausage or ham if you like. Made when you order it.</p><p class="price">from $6</p></div>
      <div class="card"><img src="${u("/assets/img/specialty-latte.jpg")}" alt="A pumpkin spice latte with a fern poured in the foam, in front of a tray of small pumpkins." width="1000" height="1000" loading="lazy"><h3>The specialty latte</h3><p>A rotating house latte. The s'mores latte has a following. Ask what's on this week.</p><p class="price">from $4.75</p></div>
      <div class="card">${ph("Quiche of the day", "r11")}<h3>Quiche of the day</h3><p>Baked in-house, different every day. Ask what's in the case, and get there before lunch.</p><p class="price">$8.50</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><span class="label">Good to know</span><h2>The practical questions, answered.</h2></div>
    <ul class="know">
      <li><b>Parking</b><span>Free, in our lot behind the building.</span></li>
      <li><b>Wi-Fi</b><span>Free. Laptops are welcome.</span></li>
      <li><b>Outdoor seating</b><span>A patio with heaters, so it stays useful into the cooler months.</span></li>
      <li><b>The private room</b><span>Free for a meeting of up to ${site.conferenceRoomMinutes} minutes, or book it for a group of ${site.privateRoom.min} to ${site.privateRoom.max} at no fee. <a href="${u("/private-room/")}">Details and booking</a>.</span></li>
      <li><b>Kids</b><span>Welcome, and we have high chairs.</span></li>
      <li><b>Gift cards</b><span>By email in a minute, or a physical card at the register.</span></li>
    </ul>
  </div>
</section>

<section class="section room">
  <div class="wrap two">
    <div><img src="${u("/assets/img/private-room.jpg")}" alt="The private dining room: a long reclaimed-wood table with bentwood chairs, leather armchairs, and a wall-mounted screen under the copper ceiling." width="1800" height="1800" loading="lazy"></div>
    <div>
      <span class="label">The private room</span>
      <h2>Your own room, no fee.</h2>
      <p>A long table for ${site.privateRoom.min} to ${site.privateRoom.max}, a screen on the wall, and a door that closes. Book clubs, firm lunches, birthdays, depositions that need coffee. Smaller meeting? Use it free for up to ${site.conferenceRoomMinutes} minutes.</p>
      ${SPEC}
      <a class="btn" href="${u("/private-room/")}">Request a date</a>
    </div>
  </div>
</section>

<section class="section affiliates">
  <div class="wrap">
    <div class="section-head centered"><span class="label">Ownership</span><h2>The two companies behind Legal Grounds.</h2><p>The café was opened by the law firm upstairs and is owned with the family's real estate company. Both are a few steps away.</p></div>
    <div class="owners">
      <a class="owner" href="${site.lawFirm.url}" rel="noopener"><span class="owner-img"><img src="${u("/assets/img/dplaw.jpg")}" alt="The four named partners of Doroshow, Pasquale, Krawitz & Bhaya in front of the firm's sign." width="940" height="1000" loading="lazy"></span><span class="owner-body"><span class="label">Law firm · Est. 1978</span><h3>${esc(site.lawFirm.name)}</h3><p>Delaware's personal injury and workers' compensation firm, with its main office upstairs from the café and offices across the state. They opened Legal Grounds in 2017 so their people and their neighbors would have somewhere good to go.</p><span class="more">Visit dplaw.com</span></span></a>
      <a class="owner" href="https://othde.com" rel="noopener"><span class="owner-img"><img src="${u("/assets/img/oth.jpg")}" alt="The stone façade of Old Town Hall in Wilmington." width="1400" height="612" loading="lazy"></span><span class="owner-body"><span class="label">Commercial real estate · Wilmington</span><h3>Old Town Hall Associates</h3><p>The family's commercial real estate company, with office and retail buildings across northern Delaware, including the one you're sitting in.</p><span class="more">Visit othde.com</span></span></a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap pair">
    <div class="panel">
      <img src="${u("/assets/img/giftcards.jpg")}" alt="Legal Grounds gift cards fanned around a latte with a heart poured in the foam." width="1000" height="1256" loading="lazy" class="panel-img">
      <h3>Gift cards</h3>
      <p>Sent by email in about a minute, for any amount. Physical cards at the register.</p>
      <a class="btn" href="${site.giftCardUrl}" rel="noopener">Buy a gift card</a>
    </div>
    <div class="panel" id="newsletter">
      <h3>Hear from us occasionally</h3>
      <p>Seasonal drinks, holiday hours, the odd special.</p>
      <form action="${site.formEndpoint}" method="POST">
        <input type="hidden" name="_subject" value="Newsletter signup from legalgroundscafe.com">
        <input type="hidden" name="_next" value="${site.url}/thanks/">
        <input type="hidden" name="_captcha" value="false">
        <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="row"><label class="hp" for="nl-email">Email</label><input id="nl-email" type="email" name="email" placeholder="you@example.com" required style="flex:1;min-width:200px"><button class="btn" type="submit">Sign up</button></div>
      </form>
    </div>
  </div>
</section>
`;

function menuPage() {
  const sec = menu.sections.map((s) => {
    let body;
    if (s.sizes) {
      body = `<div class="sized"><div class="h"></div>${s.sizes.map((z) => `<div class="h p">${z}</div>`).join("")}` +
        s.items.map((it) => `<div class="n">${esc(it.name)}${it.desc ? `<small>${esc(it.desc)}</small>` : ""}</div>` + it.prices.map((p) => `<div class="p${p == null ? " none" : ""}">${p == null ? '<span aria-hidden="true">–</span><span class="sr-only">not offered</span>' : money(p)}</div>`).join("")).join("") + `</div>`;
    } else {
      body = `<ul class="menu-list">` + s.items.map((it) => `<li class="menu-item"><span class="name">${esc(it.name)}${(it.tags || []).map((t) => `<span class="tag" title="${esc(menu.legend[t] || t)}" aria-label="${esc(menu.legend[t] || t)}">${t}</span>`).join("")}</span><span class="price">${money(it.price)}</span>${it.desc ? `<span class="desc">${esc(it.desc)}</span>` : ""}</li>`).join("") + `</ul>`;
    }
    const extras = s.extras ? `<ul class="extras">${s.extras.map((e) => `<li><span>${esc(e.name)}</span><span class="price">${money(e.price)}</span></li>`).join("")}</ul>` : "";
    return `<section class="menu-section" id="${s.id}"><h2>${esc(s.title)}</h2>${s.intro ? `<p class="intro">${esc(s.intro)}</p>` : ""}${body}${extras}</section>`;
  }).join("\n");
  const seasonal = menu.seasonal && menu.seasonal.items.length ? `<div class="seasonal"><span class="label">Right now</span><h2>${esc(menu.seasonal.title)}</h2><ul class="menu-list">${menu.seasonal.items.map((it) => `<li class="menu-item"><span class="name">${esc(it.name)}</span><span class="price">${money(it.price)}</span>${it.desc ? `<span class="desc">${esc(it.desc)}</span>` : ""}</li>`).join("")}</ul></div>` : "";
  return `
<div class="wrap narrow page-head">
  <span class="label">Menu</span>
  <h1>Made to order, from 6:30.</h1>
  <p>${menu.notes.map(esc).join(" ")}</p>
  <div class="menu-meta"><span>Prices as of ${esc(menu.asOf)}</span><span class="legend">${Object.entries(menu.legend).map(([k, v]) => `<span><span class="tag" style="margin-left:0">${k}</span> ${esc(v)}</span>`).join("")}</span></div>
  <ul class="menu-jump">${menu.sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join("")}</ul>
</div>
<div class="wrap narrow page-body">
  <img src="${u("/assets/img/latte-togo.jpg")}" alt="A latte in a compostable paper cup on the marble counter, next to a green glass bottle of eucalyptus." width="1000" height="1000" fetchpriority="high" class="banner-photo">
  ${seasonal}
  ${sec}
  <p class="notice" style="margin-top:30px">We are not a gluten-free or nut-free kitchen. Tell us about an allergy and we'll tell you honestly what we can do.</p>
</div>
`;
}

const privateRoom = () => `
<div class="wrap narrow page-head">
  <span class="label">Private room</span>
  <h1>A room of your own, no reservation fee.</h1>
  <p>Groups of ${site.privateRoom.min} to ${site.privateRoom.max}. Book clubs, firm lunches, birthdays, study groups, a deposition that needs good coffee.</p>
</div>
<div class="wrap narrow page-body">
  <img src="${u("/assets/img/private-room.jpg")}" alt="Three views of the private room: leather armchairs by the door, the long reclaimed-wood table with bentwood chairs, and the wall screen." width="1800" height="1800" class="photo photo-full" fetchpriority="high">
  ${SPEC}
  <div class="prose">
    <h2>How it works</h2>
    <p>Send the form below or call <a href="tel:${site.phoneTel}">${esc(site.phone)}</a> with a date, a time, and a headcount. We confirm by email, usually within a business day. Order from the regular menu when you arrive.</p>
    <p>Need it for a smaller meeting? The same room is free for up to ${site.conferenceRoomMinutes} minutes. Same form, or just call.</p>
    <h2 id="request">Request a date</h2>
  </div>
  <form action="${site.formEndpoint}" method="POST" aria-labelledby="request">
    <input type="hidden" name="_subject" value="Private room request from legalgroundscafe.com">
    <input type="hidden" name="_next" value="${site.url}/thanks/">
    <input type="hidden" name="_captcha" value="false">
    <input type="hidden" name="_template" value="table">
    <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="grid2">
      <div class="field"><label for="f-date">Date</label><input id="f-date" type="date" name="date" required></div>
      <div class="field"><label for="f-time">Time</label><input id="f-time" type="time" name="time" required></div>
      <div class="field"><label for="f-count">How many people</label><input id="f-count" type="number" name="headcount" min="1" max="${site.privateRoom.max}" inputmode="numeric" required></div>
      <div class="field"><label for="f-len">How long</label><select id="f-len" name="length"><option>Up to 90 minutes</option><option>Two to three hours</option><option>Longer, let's talk</option></select></div>
      <div class="field"><label for="f-occ">Occasion</label><input id="f-occ" name="occasion" placeholder="Book club, lunch meeting, birthday…"></div>
      <div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" required autocomplete="name"></div>
      <div class="field"><label for="f-email">Email</label><input id="f-email" type="email" name="email" required autocomplete="email"></div>
      <div class="field"><label for="f-phone">Phone</label><input id="f-phone" type="tel" name="phone" autocomplete="tel"></div>
    </div>
    <div class="field"><label for="f-notes">Anything else</label><textarea id="f-notes" name="notes" rows="4" placeholder="Anything we should know"></textarea></div>
    <button class="btn primary" type="submit">Send request</button>
  </form>
</div>
`;

const visit = () => `
<div class="wrap narrow page-head">
  <span class="label">Visit</span>
  <h1>On Kirkwood Highway in Elsmere.</h1>
  <p>${esc(addr1)}, ${esc(addr2)}. Ground floor of the law offices' building, with free parking in the lot behind it.</p>
  <div class="btn-row"><a class="btn primary" href="${site.directionsUrl}" rel="noopener">Get directions</a><a class="btn" href="tel:${site.phoneTel}">Call ${esc(site.phone)}</a></div>
</div>
<div class="wrap narrow page-body prose">
  <img src="${u("/assets/img/exterior.jpg")}" alt="The café's front on Kirkwood Highway: black awning lettered Legal Grounds Café, blue double doors, planters full of flowers, and a mosaic bistro table." width="1010" height="1300" fetchpriority="high" class="figure-wide">
  <h2>Hours</h2>
  <ul class="hours-list">${hoursList}</ul>
  <p>We close the kitchen and the doors at 3. Holiday hours show up at the top of every page the day before.</p>
  <h2>Getting here</h2>
  <p>We're on Kirkwood Highway (Route 2) in Elsmere, about ten minutes west of downtown Wilmington and a few minutes from I-95. Park free in the lot behind the building and walk around to the blue doors under the awning.</p>
  <h2>Sitting down</h2>
  <ul>
    <li><b>Inside:</b> a European-style room with a marble counter, small tables, and a copper ceiling. Laptops welcome, and the Wi-Fi is free.</li>
    <li><b>Outside:</b> a patio with heaters for the shoulder seasons, and flowers all summer.</li>
    <li><b>The private room:</b> free for a meeting of up to ${site.conferenceRoomMinutes} minutes, or booked for ${site.privateRoom.min} to ${site.privateRoom.max} people at no fee. <a href="${u("/private-room/")}">Book it here</a>.</li>
  </ul>
  <img src="${u("/assets/img/patio.jpg")}" alt="The patio under a canopy: a mosaic table, planters of red canna lilies and sweet-potato vine, and the parking lot beyond." width="1010" height="1300" loading="lazy" class="photo">
  <h2>Bringing kids</h2>
  <p>Kids are welcome. We have high chairs, and a PB&amp;J on sourdough is on the menu for them. Weekend mornings are the calmest time to come with little ones.</p>
  <div class="tw">
    <h3>Planning the rest of the weekend?</h3>
    <p>The family that runs the café also writes <a href="${site.sister.url}" rel="noopener">${site.sister.name}</a>, ${site.sister.blurb}: what's on this weekend around Wilmington, sorted by age, with the honest details about parking, cost, and crowds.</p>
  </div>
</div>
`;

const story = () => `
<div class="wrap narrow page-head">
  <span class="label">Our story</span>
  <h1>A café opened by the law firm next door.</h1>
  <p>Hence the name, and the lady with the scales on our sign.</p>
</div>
<div class="wrap narrow page-body prose">
  <p class="story-lede">Legal Grounds opened in 2017 on the ground floor of 1208 Kirkwood Highway, the building that houses the law offices of <a href="${site.lawFirm.url}" rel="noopener">${esc(site.lawFirm.name)}</a>. The firm opened it for two groups of people: its own employees, who wanted somewhere good to get coffee and lunch without leaving the building, and the neighborhood of Elsmere, which didn't have a café of its own.</p>
  <p>The room was built to feel like the cafés the family loves in Europe. A pressed-copper ceiling, a marble counter, black bistro chairs, framed prints on sage-green walls. It photographs well, but it's better in person at seven in the morning with the light coming in.</p>
  <img src="${u("/assets/img/artwall.jpg")}" alt="A wall of abstract paintings by a local artist above a butcher-block table with a vase of flowers, under the copper ceiling." width="1010" height="1346" loading="lazy" class="figure-wide">
  <p>The coffee comes from <a href="${site.roaster.url}" rel="noopener">${esc(site.roaster.name)}</a>, a small roaster in Philadelphia. The quiche is baked here, and it changes every day. The sandwiches are made when you order them, which is why we ask for a little patience at the lunch rush.</p>
  <blockquote class="quote"><p>“Best coffee shop in Delaware.”</p><cite>USA Today, 2019</cite></blockquote>
  <p>The people who come in every morning have kept us on the lists since. Most of them we know by name and by order. We'd like to know yours.</p>
  <div class="story-row"><img src="${u("/assets/img/rivalbros.jpg")}" alt="Proudly serving Rival Bros Coffee Roasters, established 2011." width="400" height="500" loading="lazy"><div><p class="label">Our coffee</p><p>Roasted by <a href="${site.roaster.url}" rel="noopener">${esc(site.roaster.name)}</a> in Philadelphia, delivered fresh every week.</p></div></div>
  <p class="label" style="margin-top:32px">Also from the family</p>
  <p><a href="${site.sister.url}" rel="noopener">${site.sister.name}</a>, ${site.sister.blurb}.</p>
</div>
`;

const pressPage = () => `
<div class="wrap narrow page-head">
  <span class="label">Press &amp; reviews</span>
  <h1>What people have said about us.</h1>
</div>
<div class="wrap narrow page-body">
  <div class="press-grid">
    <div class="press-card"><span class="label">${esc(press.headline.outlet)} · ${press.headline.year}</span><h2>${esc(press.headline.text)}</h2><p>${esc(press.headline.detail)}</p><a href="${press.headline.url}" rel="noopener">Read the list</a></div>
    ${press.items.map((p) => `<div class="press-card"><span class="label">${esc(p.outlet)}${p.year ? ` · ${p.year}` : ""}</span><h2>${esc(p.title)}</h2>${p.detail ? `<p>${esc(p.detail)}</p>` : ""}${p.url ? `<a href="${p.url}" rel="noopener">Read it</a>` : ""}</div>`).join("")}
  </div>
  <div class="prose"><h2>From guests</h2></div>
  ${press.quotes.map((q) => `<blockquote class="quote"><p>“${esc(q.text)}”</p><cite>${esc(q.who)}, on ${esc(q.source)}, ${q.year}</cite></blockquote>`).join("")}
  <ul class="review-links">
    ${press.reviewSites.map((r) => `<li><b>${esc(r.name)}</b><span>${esc(r.note)}</span><a href="${site.social[r.key]}" rel="noopener">Read reviews on ${esc(r.name)}</a></li>`).join("")}
  </ul>
</div>
`;

const thanks = () => `
<div class="wrap narrow page-head">
  <span class="label">Thank you</span>
  <h1>Got it.</h1>
  <p>We'll be in touch, usually within a business day. If it's urgent, call <a href="tel:${site.phoneTel}">${esc(site.phone)}</a>.</p>
  <a class="btn" href="${u("/")}">Back to the café</a>
</div>
`;

const notFound = () => `
<div class="wrap narrow page-head">
  <span class="label">Not found</span>
  <h1>That page isn't here.</h1>
  <p>Try the <a href="${u("/menu/")}">menu</a>, the <a href="${u("/private-room/")}">private room</a>, or <a href="${u("/visit/")}">how to find us</a>.</p>
</div>
`;

// ---------- Write ----------
const pages = [
  { path: "/", current: "/", title: site.name, desc: `${site.tagline} Open ${hoursLine}. Free parking, free Wi-Fi, a private room for groups.`, body: home() },
  { path: "/menu/", current: "/menu/", title: "Menu", desc: `Coffee by ${site.roaster.name}, breakfast sandwiches, salmon avocado toast, quiche of the day, salads and paninis. Prices as of ${menu.asOf}.`, body: menuPage(), ld: menuLd },
  { path: "/private-room/", current: "/private-room/", title: "Private Room", desc: `A private dining room for ${site.privateRoom.min} to ${site.privateRoom.max} in Elsmere, Delaware, with no reservation fee. Request a date online.`, body: privateRoom() },
  { path: "/visit/", current: "/visit/", title: "Visit", desc: `${addr1}, ${addr2}. Hours, parking, patio, Wi-Fi, and bringing kids.`, body: visit() },
  { path: "/story/", current: "/story/", title: "Our Story", desc: "Why a Wilmington law firm opened a European-style café in Elsmere in 2017.", body: story() },
  { path: "/press/", current: "/press/", title: "Press & Reviews", desc: "USA Today's best coffee shop in Delaware, and what guests say on Google, Yelp and TripAdvisor.", body: pressPage() },
  { path: "/thanks/", title: "Thank you", desc: "We got your message.", body: thanks(), noindex: true },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
for (const p of pages) {
  const dir = join(OUT, p.path);
  mkdirSync(dir, { recursive: true });
  let html = layout(p);
  if (p.noindex) html = html.replace("<meta name=\"viewport\"", "<meta name=\"robots\" content=\"noindex\">\n<meta name=\"viewport\"");
  writeFileSync(join(dir, "index.html"), html);
}
writeFileSync(join(OUT, "404.html"), layout({ path: "/404", title: "Not found", desc: "Page not found.", body: notFound() }));

// Old Squarespace URLs → new pages. GitHub Pages has no server redirects; these stubs do the job.
const redirects = { "/location": "/visit/", "/reviews": "/press/", "/private-room-events": "/private-room/", "/newsletter-signup": "/#newsletter", "/gallery": "/", "/social": "/", "/home-blend": "/", "/story-blend": "/story/", "/careers-blend": "/" };
for (const [from, to] of Object.entries(redirects)) {
  mkdirSync(join(OUT, from), { recursive: true });
  writeFileSync(join(OUT, from, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title><link rel="canonical" href="${site.url}${to}"><meta http-equiv="refresh" content="0; url=${u(to)}"></head><body><p>Moved to <a href="${u(to)}">${site.url}${to}</a>.</p></body></html>`);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => !p.noindex).map((p) => `  <url><loc>${site.url}${p.path}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /_h/\nSitemap: ${site.url}/sitemap.xml\n`);
// Dev harness: real pages inside a 390px iframe, for phone-width screenshots from headless Chrome (500px minimum window).
mkdirSync(join(OUT, "_h"), { recursive: true });
for (const p of pages) {
  const n = p.path === "/" ? "home" : p.path.replace(/\//g, "");
  writeFileSync(join(OUT, "_h", `${n}.html`), `<!doctype html><html><head><meta name="robots" content="noindex"></head><body style="margin:0;background:#888"><iframe src="${u(p.path)}" style="border:0;width:390px;height:3200px;display:block"></iframe></body></html>`);
}
if (existsSync(join(ROOT, "CNAME"))) cpSync(join(ROOT, "CNAME"), join(OUT, "CNAME"));
console.log(`Built ${pages.length} pages + ${Object.keys(redirects).length} redirects → dist/ (BASE="${BASE}")`);
