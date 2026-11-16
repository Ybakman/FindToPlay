const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

toggle?.addEventListener("click", () => {
  const open = nav?.classList.toggle("open") ?? false;
  toggle.setAttribute("aria-expanded", String(open));
});

nav?.addEventListener("click", () => {
  nav.classList.remove("open");
  toggle?.setAttribute("aria-expanded", "false");
});
