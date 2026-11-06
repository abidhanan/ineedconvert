// Public analytics identifiers for the dedicated I Need Convert properties.
// Loading is deferred so analytics does not compete with the app's first paint.
const GA4_ID = 'G-SV5ZH2NNMF';
const CLARITY_ID = 'z16rn17wij';

const lang = document.documentElement.lang || 'id';

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
window.gtag('js', new Date());
window.gtag('config', GA4_ID, { send_page_view: true });
window.gtag('set', 'user_properties', { ui_language: lang });

window.clarity = window.clarity || function clarity() {
  (window.clarity.q = window.clarity.q || []).push(arguments);
};
window.clarity('set', 'ui_language', lang);

window.track = (name, params = {}) => {
  window.gtag('event', name, params);
  window.clarity('event', name);
};

const inject = (src) => {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.append(script);
};

// Keep third-party JavaScript out of the critical rendering path. GA4 still
// starts on the first intentional interaction, with a delayed fallback for
// visitors who only read the page.
const analyticsEvents = ['pointerdown', 'keydown', 'touchstart'];
let ga4Loaded = false;
const loadGa4 = () => {
  if (ga4Loaded) return;
  ga4Loaded = true;
  for (const event of analyticsEvents) window.removeEventListener(event, loadGa4, true);
  window.removeEventListener('scroll', loadGa4);
  inject(`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
};
for (const event of analyticsEvents) {
  window.addEventListener(event, loadGa4, { capture: true, passive: true });
}
window.addEventListener('scroll', loadGa4, { passive: true });
window.setTimeout(loadGa4, 8000);

// Clarity starts after the first intentional interaction. This preserves startup
// performance while still recording the part of the visit where users engage.
const loadClarity = () => {
  for (const event of analyticsEvents) window.removeEventListener(event, loadClarity, true);
  window.removeEventListener('scroll', loadClarity);
  inject(`https://www.clarity.ms/tag/${CLARITY_ID}`);
};
for (const event of analyticsEvents) {
  window.addEventListener(event, loadClarity, { capture: true, passive: true });
}
window.addEventListener('scroll', loadClarity, { passive: true });
