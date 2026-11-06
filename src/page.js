// Bits shared by every page: toast, navbar marker, smooth in-page links.

let toastTimer;
export function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

export function initPage() {
  // Navbar marker: highlights the link of the section on screen (home page only).
  const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  if (!navLinks.length) return;
  const sections = navLinks.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  const update = () => {
    const line = document.querySelector('.header').offsetHeight + innerHeight * 0.3;
    let current = 0;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= line) current = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = sections.length - 1;
    navLinks.forEach((a, i) => (i === current ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);

  // In-page links scroll to their section without leaving "#..." in the address bar.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (a.classList.contains('skip')) target.focus({ preventScroll: true });
  });
}
