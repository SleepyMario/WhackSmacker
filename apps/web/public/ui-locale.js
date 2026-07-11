/* Browser UI language is intentionally separate from the authenticated source-content locale.
 * /app maps this preference to its existing en-US/zh-Hant-TW setting after authentication. */
(() => {
  const storageKey = "whacksmacker.ui-locale";
  const locales = ["en", "zh-TW"];
  const copy = {
    en: {
      "page.landing.title": "WhackSmacker — Learn for the long term",
      "page.landing.description": "WhackSmacker is a local-first language learning system for modules, review decks, and long-term mastery.",
      "landing.eyebrow": "Local-first language learning", "landing.heading": "Build knowledge that sticks.",
      "landing.intro": "A calm, focused study system for modules, review decks, and long-term mastery. Install language packs, review cards, track progress, and switch source languages from one clean interface.",
      "landing.login": "Log in", "landing.notes": "Developer notes", "landing.features": "WhackSmacker features",
      "landing.modules.title": "Modules", "landing.modules.text": "Keep installed and available language packs organized in one place.",
      "landing.decks.title": "Review decks", "landing.decks.text": "Move through focused card sessions with clear scheduling and ratings.",
      "landing.progress.title": "Progress", "landing.progress.text": "Preserve your learning history locally and see what is ready to review.",
      "landing.source.title": "Source language", "landing.source.text": "Study with English or 中文（臺灣）, with dependable localized fallback.",
      "page.app.title": "WhackSmacker", "app.sourceLanguage": "Source language", "app.menu": "Toggle navigation", "app.theme": "Toggle theme",
      "app.nav.dashboard": "Dashboard", "app.nav.packages": "Packages", "app.nav.review": "Review", "app.nav.content": "Content", "app.nav.progress": "Progress", "app.nav.settings": "Settings",
      "landing.language": "Language", "login.title": "Log in — WhackSmacker", "login.back": "← Back to WhackSmacker",
      "login.eyebrow": "Private local study space", "login.heading": "Log in", "login.text": "Enter the password configured by the person running this WhackSmacker server. There is no public registration or default account.",
      "login.password": "Password", "login.submit": "Log in", "login.error": "Unable to log in.", "login.incorrect": "Incorrect password."
    },
    "zh-TW": {
      "page.landing.title": "WhackSmacker — 長期學習", "page.landing.description": "WhackSmacker 是一套以本機優先為核心的語言學習系統，支援模組、複習牌組與長期精熟。",
      "landing.eyebrow": "本機優先的語言學習", "landing.heading": "讓知識真正留下來。",
      "landing.intro": "專為模組、複習牌組與長期精熟打造，平靜而專注的學習系統。可安裝語言套件、複習牌卡、追蹤進度，並在一個簡潔介面中切換來源語言。",
      "landing.login": "登入", "landing.notes": "開發者筆記", "landing.features": "WhackSmacker 功能",
      "landing.modules.title": "模組", "landing.modules.text": "在同一處整理已安裝與可取得的語言套件。",
      "landing.decks.title": "複習牌組", "landing.decks.text": "以清楚的排程與評分，進行專注的牌卡複習。",
      "landing.progress.title": "進度", "landing.progress.text": "在本機保留學習歷程，隨時查看待複習的內容。",
      "landing.source.title": "來源語言", "landing.source.text": "以英文或中文（臺灣）學習，並享有可靠的在地化備援。",
      "page.app.title": "WhackSmacker", "app.sourceLanguage": "來源語言", "app.menu": "切換導覽選單", "app.theme": "切換佈景主題",
      "app.nav.dashboard": "儀表板", "app.nav.packages": "套件", "app.nav.review": "複習", "app.nav.content": "內容", "app.nav.progress": "進度", "app.nav.settings": "設定",
      "landing.language": "介面語言", "login.title": "登入 — WhackSmacker", "login.back": "← 回到 WhackSmacker",
      "login.eyebrow": "私人的本機學習空間", "login.heading": "登入", "login.text": "請輸入此 WhackSmacker 伺服器管理者設定的密碼。沒有公開註冊，也沒有預設帳號。",
      "login.password": "密碼", "login.submit": "登入", "login.error": "無法登入。", "login.incorrect": "密碼不正確。"
    }
  };

  function normalize(value) { return value === "zh-TW" || value === "zh-Hant-TW" ? "zh-TW" : "en"; }
  function preferredLocale() {
    try { const stored = localStorage.getItem(storageKey); if (locales.includes(stored)) return stored; } catch { /* Storage can be unavailable in privacy modes. */ }
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    return languages.some(language => /^zh(?:[-_]TW|[-_]Hant)(?:[-_]|$)/iu.test(language ?? "")) ? "zh-TW" : "en";
  }
  function setLocale(locale) { const resolved = normalize(locale); try { localStorage.setItem(storageKey, resolved); } catch { /* Keep the current page usable without storage. */ } return resolved; }
  function translate(locale, key) { return copy[normalize(locale)][key] ?? copy.en[key] ?? key; }
  function apply(locale) {
    const resolved = normalize(locale); document.documentElement.lang = resolved === "zh-TW" ? "zh-Hant-TW" : "en";
    document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = translate(resolved, node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-attr]").forEach(node => { const [attribute, key] = node.dataset.i18nAttr.split(":"); node.setAttribute(attribute, translate(resolved, key)); });
    document.title = translate(resolved, document.body.dataset.titleKey || "page.landing.title");
    return resolved;
  }
  function installSelector(selector, onChange) { const locale = apply(preferredLocale()); selector.value = locale; selector.addEventListener("change", () => { const next = setLocale(selector.value); selector.value = apply(next); onChange?.(next); }); return locale; }
  window.WhackSmackerUiLocale = { storageKey, appLocale: locale => normalize(locale) === "zh-TW" ? "zh-Hant-TW" : "en-US", apply, installSelector, preferredLocale, setLocale, translate };
})();
