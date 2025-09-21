async function loadLocale(lang) {
    const res = await fetch(`/locales/${lang}.json`);
    const dict = await res.json();

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.textContent = dict[key];
    });
}

document.getElementById("lang-switcher").addEventListener("change", e => {
    loadLocale(e.target.value);
});

// 自动设置语言
const userLang = navigator.language || navigator.userLanguage;
const lang = userLang.startsWith('zh') ? 'zh' : userLang.startsWith('ja') ? 'ja' : 'en';
document.getElementById('lang-switcher').value = lang;
loadLocale(lang);
