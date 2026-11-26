/* Certificate tracking form (home page and Track page): number or Sr. No. -> verification page */
const trackForm = document.getElementById("track-form");
trackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("track-msg");
  msg.classList.add("hidden");
  const q = document.getElementById("track-q").value.trim();
  try {
    const found = await api("/api/track?q=" + encodeURIComponent(q));
    location.href = "/verify/" + found.cert_no;
  } catch (err) {
    showMessage(msg, err.message);
  }
});
