/* Shared code: API helper, text escaping, header/footer, login state.
   Every page loads this first. Page scripts wait for `ready` to know who is logged in. */

/* Company details shown in the header and footer. Edit them here, once. */
const COMPANY = {
  name: "HALAL RIZQ KHIDMAAT LLP",
  tagline: "Halal Certification Services",
  type: "Limited Liability Partnership",
  udyam: "UDYAM-MH-19-0481724",
  enterprise: "Micro Enterprise (Services)",
  incorporated: "16 November 2026",
  address: ["4, Floor-GR, Plot 92, Aminabai Building", "Barkat Ali Virani Path", "Mumbai, Maharashtra - 400008"],
  mobile: "9833100116",
  mobileShow: "+91 98331 00116",
  email: "halalrizqkhidmaat@gmail.com",
};

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* not JSON */ }
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

// Escape text before putting it into HTML (stops injected scripts)
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const formatDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
const formatMoney = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const STATUS_LABEL = { pending: "Received", under_review: "Under review", approved: "Approved", rejected: "Rejected", valid: "Valid", expired: "Expired", revoked: "Revoked", active: "Active" };

function showMessage(el, text, type = "error") {
  el.className = "alert " + type;
  el.textContent = text;
  el.classList.remove("hidden");
}

async function currentUser() {
  try { return (await api("/api/auth/me")).user; } catch (e) { return null; }
}

function renderChrome(user) {
  const here = location.pathname.replace(/\/$/, "") || "/";
  const link = (href, text) => `<a href="${href}" class="${here === href ? "active" : ""}">${text}</a>`;
  const items = [link("/", "Home"), link("/about", "About"), link("/pricing", "Pricing"), link("/track", "Track certificate"), link("/apply", "Apply online")];
  if (user) {
    items.push(link("/dashboard", "My applications"));
    if (user.role === "admin") items.push(link("/admin", "Admin")); // only the company ever sees this link
    items.push('<button type="button" id="logout-btn">Log out</button>');
  } else {
    items.push(link("/login", "Member login"), '<a class="btn small" href="/register">Register</a>');
  }
  const header = document.getElementById("site-header");
  if (header) {
    header.className = "site-header";
    header.innerHTML = `
      <div class="topbar"><div class="container">
        <span>${esc(COMPANY.tagline)}</span>
        <span><a href="tel:+91${COMPANY.mobile}">${esc(COMPANY.mobileShow)}</a><span class="sep">|</span><a href="mailto:${COMPANY.email}">${esc(COMPANY.email)}</a></span>
      </div></div>
      <div class="container header-main">
        <a href="/" class="brand"><img src="/images/logo.jpeg" alt="${esc(COMPANY.name)} logo">
          <span class="brand-text"><strong>${esc(COMPANY.name)}</strong><small>${esc(COMPANY.tagline)}</small></span></a>
        <button class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <nav class="site-nav" id="site-nav" aria-label="Main">${items.join("")}</nav>
      </div>`;
    document.getElementById("menu-toggle").onclick = (e) => {
      const open = document.getElementById("site-nav").classList.toggle("open");
      e.currentTarget.setAttribute("aria-expanded", open);
    };
    const out = document.getElementById("logout-btn");
    if (out) out.onclick = async () => { await api("/api/auth/logout", { method: "POST" }); location.href = "/"; };
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="container footer-grid">
        <div>
          <h3>${esc(COMPANY.name)}</h3>
          <p>${esc(COMPANY.tagline)}. Apply online, track and verify Halal certificates.</p>
          <p>${esc(COMPANY.type)}<br>Udyam Registration No.: ${esc(COMPANY.udyam)}<br>${esc(COMPANY.enterprise)}<br>Date of incorporation: ${esc(COMPANY.incorporated)}</p>
        </div>
        <div>
          <h3>Registered office</h3>
          <address>${COMPANY.address.map(esc).join("<br>")}</address>
        </div>
        <div>
          <h3>Contact us</h3>
          <p>Mobile: <a href="tel:+91${COMPANY.mobile}">${esc(COMPANY.mobileShow)}</a><br>
          Email: <a href="mailto:${COMPANY.email}">${esc(COMPANY.email)}</a></p>
        </div>
        <div>
          <h3>Quick links</h3>
          <p><a href="/about">About us</a><br><a href="/pricing">Pricing</a><br><a href="/track">Track certificate</a><br><a href="/apply">Apply online</a></p>
        </div>
      </div>
      <div class="container footer-bottom">&copy; ${new Date().getFullYear()} ${esc(COMPANY.name)}. All rights reserved.</div>`;
  }
}

// Pages call `const user = await ready;`
const ready = currentUser().then((user) => { renderChrome(user); return user; });

// For pages that need a login: send visitors to the login page, then bring them back
async function requireLogin() {
  const user = await ready;
  if (!user) location.href = "/login?next=" + encodeURIComponent(location.pathname);
  return user;
}
