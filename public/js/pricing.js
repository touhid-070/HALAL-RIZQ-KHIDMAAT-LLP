/* Pricing page: reads the fee table from the database and runs the fee estimator */
(async () => {
  const fees = await api("/api/fees");
  const f = (k) => fees[k].amount;
  document.getElementById("fee-cards").innerHTML = `
    <div class="card"><h3>Registration</h3>${formatMoney(f("registration_fee"))} per year<br>plus ${formatMoney(f("per_product_fee"))} per product</div>
    <div class="card"><h3>Audit</h3>${formatMoney(f("audit_fee_per_day"))} per auditor per day<br>plus travel and stay expenses</div>
    <div class="card"><h3>Halal logo licence</h3>${formatMoney(f("logo_fee"))} per year for any number of products (optional)</div>
    <div class="card"><h3>GST</h3>${f("gst_percent")}% on all fees</div>`;

  const out = document.getElementById("estimate");
  const calc = () => {
    const products = Math.max(1, Number(document.getElementById("products").value) || 1);
    const days = Math.max(1, Number(document.getElementById("days").value) || 1);
    const logo = document.getElementById("logo").checked;
    const subtotal = f("registration_fee") + f("per_product_fee") * products + f("audit_fee_per_day") * days + (logo ? f("logo_fee") : 0);
    const gst = subtotal * f("gst_percent") / 100;
    out.innerHTML = `Subtotal ${formatMoney(subtotal)} + GST ${formatMoney(gst)} = <strong>${formatMoney(subtotal + gst)}</strong><br><small>Travel and stay expenses for the auditors are extra.</small>`;
  };
  document.querySelectorAll("#estimator input").forEach((el) => el.addEventListener("input", calc));
  calc();
})();
