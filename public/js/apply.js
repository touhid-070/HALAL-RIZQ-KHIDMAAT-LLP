/* Application form (login required) */
(async () => {
  const user = await requireLogin();
  if (!user) return;
  const form = document.getElementById("apply-form");
  form.owner_name.value = user.name;
  form.email.value = user.email;
  form.phone.value = user.phone || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("apply-msg");
    msg.classList.add("hidden");
    try {
      await api("/api/applications", { method: "POST", body: Object.fromEntries(new FormData(form)) });
      location.href = "/dashboard?applied=1";
    } catch (err) {
      showMessage(msg, err.message);
      msg.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
})();
