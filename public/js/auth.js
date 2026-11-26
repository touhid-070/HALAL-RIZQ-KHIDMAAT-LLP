/* Login and registration forms */
(async () => {
  if (await ready) location.href = "/dashboard";
})();

const authForm = document.getElementById("auth-form");
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("auth-msg");
  msg.classList.add("hidden");
  const body = Object.fromEntries(new FormData(authForm));
  try {
    const res = await api(authForm.dataset.endpoint, { method: "POST", body });
    // Only follow "next" if it is a path on this same site
    const next = new URLSearchParams(location.search).get("next");
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    location.href = safe || (res.role === "admin" ? "/admin" : "/dashboard");
  } catch (err) {
    showMessage(msg, err.message);
  }
});
