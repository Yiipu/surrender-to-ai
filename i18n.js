async function loadLocale(lang) {
  const res = await fetch(`/locales/${lang}.json`);
  const dict = await res.json();

  // Keep current locale + dictionary globally available for runtime messages.
  document.documentElement.lang = lang;
  window.__I18N_DICT__ = dict;
  window.t = (key, fallback = key) => (window.__I18N_DICT__?.[key] ?? fallback);

  // Text nodes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && (key in dict)) el.textContent = dict[key];
  });

  // Runtime text nodes (set by JS, but should re-render on locale switch)
  document.querySelectorAll('[data-i18n-runtime]').forEach(el => {
    const key = el.getAttribute('data-i18n-runtime');
    if (key && (key in dict)) el.textContent = dict[key];
  });

  // Attribute translations (safe: no HTML)
  const attrSpecs = [
    { data: 'data-i18n-placeholder', attr: 'placeholder' },
    { data: 'data-i18n-aria-label', attr: 'aria-label' },
    { data: 'data-i18n-title', attr: 'title' },
  ];

  for (const { data, attr } of attrSpecs) {
    document.querySelectorAll(`[${data}]`).forEach(el => {
      const key = el.getAttribute(data);
      if (key && (key in dict)) el.setAttribute(attr, dict[key]);
    });
  }
}

document.getElementById('lang-switcher').addEventListener('change', e => {
  loadLocale(e.target.value);
});

// 自动设置语言
const userLang = navigator.language || navigator.userLanguage;
const lang = userLang.startsWith('zh') ? 'zh' : userLang.startsWith('ja') ? 'ja' : 'en';
document.getElementById('lang-switcher').value = lang;
loadLocale(lang);
