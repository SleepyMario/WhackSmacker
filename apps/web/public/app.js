(() => {
  "use strict";

  const byId = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const elements = {
    status: byId("status"), controls: byId("controls"), curriculum: byId("curriculum"), version: byId("version"),
    source: byId("source-locale"), theme: byId("theme-toggle"), username: byId("username"), logout: byId("logout"),
    menu: byId("menu-toggle"), sidebar: byId("sidebar"), backdrop: byId("sidebar-backdrop"), overlay: byId("overlay"),
    panel: byId("chapters-panel"), chapters: byId("chapters"), reader: byId("reader"), title: byId("chapter-title"),
    position: byId("chapter-position"), content: byId("chapter-content"), previous: byId("previous"), next: byId("next"),
    translation: byId("translation-toggle"), characters: byId("characters-toggle"), breakdown: byId("breakdown-toggle"),
    readerView: byId("view-reader"), reviewView: byId("view-review"), navReader: byId("nav-reader"), navReview: byId("nav-review"),
    skip: byId("skip-link"), headerEyebrow: document.querySelector(".header-context span"), headerTitle: document.querySelector(".header-context strong"),
    reviewPackages: byId("review-packages"), reviewPackage: byId("review-package"), reviewVersion: byId("review-version"),
    decks: byId("deck-list"), reviewSession: byId("review-session")
  };
  const preferenceKey = "whacksmacker.web.reader.v1";
  const state = {
    curricula: [], curriculum: null, chapter: null, locale: "en", mode: "normal", translation: false,
    characters: false, breakdown: false, busy: false, generation: 0, unavailable: [], view: "reader",
    review: { packages: [], package: null, source: null, card: null, revealed: false, submitting: false, completedCount: 0 }
  };

  class ApiError extends Error {
    constructor(status, message, requestId) { super(message); this.status = status; this.requestId = requestId; }
  }

  const csrf = () => decodeURIComponent(document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("wsm_csrf="))?.slice(9) ?? "");
  const t = (key, fallback) => window.WhackSmackerUiLocale?.translate(window.WhackSmackerUiLocale.preferredLocale(), key) ?? fallback;

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json", "X-CSRF-Token": csrf() } : {}),
          ...options.headers
        }
      });
    } catch {
      throw new ApiError(0, t("app.error.network", "The network connection was lost. Check your connection and try again."));
    }
    if (response.status === 401) {
      const returnTo = `${location.pathname}${location.search}${location.hash}`;
      location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      throw new ApiError(401, t("app.error.session", "Your session expired. Returning to login."));
    }
    let body;
    try { body = await response.json(); }
    catch { throw new ApiError(response.status, t("app.error.invalidResponse", "The server returned an invalid response.")); }
    if (!response.ok) throw new ApiError(response.status, messageFor(response.status, body.error), body.requestId);
    return body;
  }

  function messageFor(status, message) {
    if (status === 400) return `${t("app.error.invalid", "The request was invalid.")} ${message || ""}`.trim();
    if (status === 403) return t("app.error.unauthorized", "You are not authorized to use that exact package version.");
    if (status === 404) return t("app.error.notFound", "That exact content selection is no longer available.");
    if (status === 409) return `${t("app.error.conflict", "The Review state changed. Refresh and try again.")} ${message || ""}`.trim();
    if (status === 429) return t("app.error.rate", "Too many requests. Wait a moment and try again.");
    if (status >= 500) return t("app.error.server", "The server could not read the curriculum. Try again later.");
    return message || t("app.error.generic", "The request failed.");
  }

  function canonicalLocale(value) {
    if (value === "zh-Hant-TW" || value === "zh-TW") return "zh-TW";
    if (value === "en-US" || value === "en") return "en";
    return null;
  }

  function booleanValue(value, fallback = false) {
    if (value === null || value === undefined || value === "") return fallback;
    return value === true || value === "true" || value === "1" || value === "on";
  }

  function readRoute() {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#\??/u, ""));
    const value = (...names) => names.map(name => query.get(name) ?? hash.get(name)).find(item => item !== null) ?? null;
    const mode = value("mode");
    const view = value("view") === "review" ? "review" : "reader";
    return {
      view,
      packageId: value("package", "packageId"), version: value("version"), chapter: value("chapter"), locale: canonicalLocale(value("locale")),
      reviewPackage: value("reviewPackage"), reviewVersion: value("reviewVersion"), reviewSource: value("source"),
      mode: ["normal", "expert", "developer"].includes(mode) ? mode : null,
      translation: booleanValue(value("translation", "translations")), characters: booleanValue(value("characters")), breakdown: booleanValue(value("breakdown"))
    };
  }

  function routeState(overrides = {}) {
    const next = {
      view: state.view,
      packageId: state.curriculum?.packageId ?? null,
      version: state.curriculum?.packageVersion ?? null,
      chapter: state.chapter?.id ?? null,
      locale: state.locale,
      mode: state.mode,
      translation: state.translation,
      characters: state.characters,
      breakdown: state.breakdown,
      reviewPackage: state.review.package?.packageId ?? null,
      reviewVersion: state.review.package?.packageVersion ?? null,
      reviewSource: state.review.source?.sourcePath ?? null,
      ...overrides
    };
    const params = new URLSearchParams();
    if (next.view === "review") {
      params.set("view", "review");
      if (next.reviewPackage) params.set("reviewPackage", next.reviewPackage);
      if (next.reviewVersion) params.set("reviewVersion", next.reviewVersion);
      if (next.reviewSource) params.set("source", next.reviewSource);
      return `/app?${params}`;
    }
    if (next.view === "reader") params.set("view", "reader");
    if (next.packageId) params.set("package", next.packageId);
    if (next.version) params.set("version", next.version);
    if (next.locale) params.set("locale", next.locale);
    if (next.chapter) params.set("chapter", next.chapter);
    if (next.mode && next.mode !== "normal") params.set("mode", next.mode);
    if (next.translation) params.set("translation", "true");
    if (next.characters) params.set("characters", "true");
    if (next.breakdown) params.set("breakdown", "true");
    return `/app${params.size ? `?${params}` : ""}`;
  }

  function writeRoute(overrides = {}, replace = false) {
    history[replace ? "replaceState" : "pushState"](null, "", routeState(overrides));
  }

  function setStatus(kind, message) {
    elements.status.hidden = false;
    elements.status.className = `status ${kind}`;
    elements.status.textContent = message;
  }

  function showError(error) {
    setStatus("error", `${error.message}${error.requestId ? ` ${t("app.error.reference", "Reference:")} ${error.requestId}` : ""}`);
  }

  function setBusy(value) {
    state.busy = value;
    document.body.classList.toggle("busy", value);
    elements.reader.setAttribute("aria-busy", String(value));
    elements.reviewSession.setAttribute("aria-busy", String(value));
    all("[data-busy-control]").forEach(control => { control.disabled = value; });
    if (!value) syncControlAvailability();
  }

  function syncControlAvailability() {
    const hasCurricula = state.curricula.length > 0;
    elements.curriculum.disabled = !hasCurricula;
    elements.version.disabled = !hasCurricula;
    const chapters = visibleChapters(state.curriculum);
    const index = chapters.findIndex(chapter => chapter.id === state.chapter?.id);
    elements.previous.disabled = index <= 0;
    elements.next.disabled = index < 0 || index >= chapters.length - 1;
    elements.previous.dataset.chapter = index > 0 ? chapters[index - 1].id : "";
    elements.next.dataset.chapter = index >= 0 && index < chapters.length - 1 ? chapters[index + 1].id : "";
  }

  function readPreferences() {
    try { return JSON.parse(localStorage.getItem(preferenceKey) || "{}"); }
    catch { return {}; }
  }

  function savePreferences() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify({
        mode: state.mode, translation: state.translation, characters: state.characters, breakdown: state.breakdown,
        theme: document.documentElement.dataset.theme || "dark"
      }));
    } catch { /* The reader remains usable when storage is unavailable. */ }
  }

  function applyTheme(value) {
    const theme = value === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    elements.theme.textContent = theme === "dark" ? "☀" : "◐";
    elements.theme.setAttribute("aria-pressed", String(theme === "light"));
  }

  function applyDisplayState(route, dashboard) {
    const saved = readPreferences();
    state.mode = route.mode ?? (["normal", "expert", "developer"].includes(saved.mode) ? saved.mode : "normal");
    state.translation = route.translation || (route.mode === null && saved.translation === true);
    state.characters = route.characters || (route.mode === null && saved.characters === true);
    state.breakdown = route.breakdown || (route.mode === null && saved.breakdown === true);
    applyTheme(dashboard?.theme ?? saved.theme ?? "dark");
    syncDisplayControls();
  }

  function syncDisplayControls() {
    elements.translation.checked = state.translation;
    elements.characters.checked = state.characters;
    elements.breakdown.checked = state.breakdown;
    all("[data-mode]").forEach(button => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    savePreferences();
  }

  async function start() {
    const generation = ++state.generation;
    setBusy(true);
    setStatus("loading", t("app.loading.curricula", "Loading your curricula…"));
    try {
      window.WhackSmackerUiLocale?.apply(window.WhackSmackerUiLocale.preferredLocale());
      const route = readRoute();
      state.view = route.view;
      showView(route.view);
      const dashboard = await api("/api/state");
      if (generation !== state.generation) return;
      elements.username.textContent = dashboard.user?.username || "";
      state.locale = canonicalLocale(dashboard.locale) || "en";
      applyDisplayState(route, dashboard);
      if (route.locale && route.locale !== state.locale) {
        await api("/api/settings", { method: "PUT", body: JSON.stringify({ locale: route.locale, theme: document.documentElement.dataset.theme }) });
        state.locale = route.locale;
      }
      elements.source.value = state.locale;
      if (route.view === "review") {
        await loadReview(route);
        return;
      }
      const data = await api("/api/curricula");
      if (generation !== state.generation) return;
      state.curricula = data.curricula || [];
      state.unavailable = data.unavailable || [];
      elements.controls.hidden = false;
      if (!state.curricula.length) {
        showNoCurricula();
        writeRoute({ packageId: null, version: null, chapter: null }, true);
        return;
      }
      if ((route.packageId && !route.version) || (!route.packageId && route.version)) {
        showUnavailableExactVersion(t("app.error.exactPair", "A curriculum deep link must include both package and exact version."));
        return;
      }
      if (route.packageId && route.version && !findCurriculum(route.packageId, route.version)) {
        showUnavailableExactVersion(t("app.error.unavailableVersion", "The curriculum version in this link is unavailable or not authorized for your account."));
        return;
      }
      const chosen = findCurriculum(route.packageId, route.version) || state.curricula[0];
      await selectCurriculum(chosen, route.chapter, true, route.packageId !== null);
      if (!route.chapter) setStatus("success", t("app.ready", "Reader ready. Choose a chapter."));
    } catch (error) {
      if (generation === state.generation) showError(error);
    } finally {
      if (generation === state.generation) setBusy(false);
    }
  }

  function fill(select, items) {
    select.replaceChildren(...items.map(item => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      return option;
    }));
  }

  function findCurriculum(packageId, version) {
    return state.curricula.find(item => item.packageId === packageId && item.packageVersion === version);
  }

  function populateCurriculumControls(chosen) {
    const ids = [...new Set(state.curricula.map(item => item.packageId))];
    fill(elements.curriculum, ids.map(packageId => ({ value: packageId, label: state.curricula.find(item => item.packageId === packageId)?.name || packageId })));
    elements.curriculum.value = chosen.packageId;
    const versions = state.curricula.filter(item => item.packageId === chosen.packageId);
    fill(elements.version, versions.map(item => ({ value: item.packageVersion, label: item.packageVersion })));
    elements.version.value = chosen.packageVersion;
  }

  function grammarRole(path) {
    if (/-grammar-easy\/(?:chapter|README)\.md$/u.test(path)) return "easy";
    if (/-grammar-hard\/(?:chapter|README)\.md$/u.test(path)) return "hard";
    return null;
  }

  function visibleChapters(curriculum = state.curriculum) {
    return (curriculum?.chapters || []).filter(chapter => {
      const role = grammarRole(chapter.path);
      return role === null || (state.mode === "expert" ? role === "hard" : role === "easy");
    });
  }

  function chapterForMode(chapterId) {
    if (!chapterId) return chapterId;
    if (state.mode === "expert") return chapterId.replace(/-grammar-easy\//u, "-grammar-hard/");
    return chapterId.replace(/-grammar-hard\//u, "-grammar-easy/");
  }

  function chapterLabel(chapter) {
    return grammarRole(chapter.path) ? t("app.grammar", "Grammar") : chapter.title;
  }

  async function selectCurriculum(curriculum, requestedChapter = null, replace = false, preserveInvalidChapter = false, focusTarget = null) {
    state.curriculum = curriculum;
    state.chapter = null;
    populateCurriculumControls(curriculum);
    renderOverlay(curriculum);
    const chapters = visibleChapters(curriculum);
    elements.chapters.replaceChildren(...chapters.map(chapter => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = chapterLabel(chapter);
      button.dataset.chapter = chapter.id;
      button.addEventListener("click", () => openChapter(chapter.id, true, false, elements.reader));
      item.append(button);
      return item;
    }));
    elements.panel.hidden = false;
    elements.reader.hidden = false;
    showChooseChapter(chapters.length ? t("app.chooseChapterPrompt", "Select a curriculum and chapter to begin.") : t("app.emptyChapters", "This curriculum has no learner-facing chapters."));
    const selectedChapter = chapterForMode(requestedChapter);
    const valid = chapters.some(chapter => chapter.id === selectedChapter);
    if (requestedChapter && !valid && preserveInvalidChapter) {
      setStatus("error", t("app.error.chapterUnavailable", "The chapter in this link is unavailable in the selected curriculum version."));
      writeRoute({ chapter: requestedChapter }, true);
      return;
    }
    writeRoute({ chapter: valid ? selectedChapter : null }, replace);
    if (valid) await openChapter(selectedChapter, false, true, focusTarget);
    else if (!chapters.length) setStatus("empty", t("app.emptyChapters", "This curriculum has no learner-facing chapters."));
  }

  function showChooseChapter(message) {
    state.chapter = null;
    elements.title.textContent = t("app.chooseChapter", "Choose a chapter");
    elements.position.textContent = "";
    elements.content.className = "chapter-content empty-state";
    elements.content.textContent = message;
    all("#chapters button").forEach(button => button.removeAttribute("aria-current"));
    syncControlAvailability();
  }

  function showNoCurricula() {
    state.curriculum = null;
    state.chapter = null;
    fill(elements.curriculum, []);
    fill(elements.version, []);
    elements.overlay.hidden = true;
    elements.panel.hidden = false;
    elements.reader.hidden = false;
    elements.chapters.replaceChildren();
    const unavailable = state.unavailable.length > 0;
    const message = unavailable
      ? t("app.unavailableSelection", "A selected curriculum version is installed but unavailable or unreadable. Ask an administrator to repair or reselect it.")
      : t("app.noCurricula", "No language curricula are selected. Ask an administrator to select an installed curriculum version for your account.");
    showChooseChapter(message);
    setStatus("empty", message);
  }

  function showUnavailableExactVersion(message) {
    state.curriculum = null;
    state.chapter = null;
    elements.controls.hidden = true;
    elements.overlay.hidden = true;
    elements.panel.hidden = true;
    elements.reader.hidden = false;
    showChooseChapter(message);
    setStatus("error", message);
  }

  function renderOverlay(curriculum) {
    const requested = localeLabel(curriculum.requestedSourceLocale);
    const effective = localeLabel(curriculum.effectiveSourceLocale);
    const messages = {
      active: `${effective} ${t("app.overlay.active", "source overlay is active.")}`,
      fallback: `${t("app.overlay.requested", "The requested")} ${requested} ${t("app.overlay.fallbackPrefix", "overlay is unavailable. Showing")} ${effective} ${t("app.overlay.fallbackSuffix", "fallback content.")}`,
      missing: `${t("app.overlay.missing", "No compatible")} ${requested} ${t("app.overlay.missingSuffix", "overlay is installed. Base content may be shown.")}`,
      incompatible: `${t("app.overlay.incompatible", "An installed source overlay is incompatible with version")} ${curriculum.packageVersion}; ${t("app.overlay.notUsed", "it was not used.")}`
    };
    elements.overlay.hidden = false;
    elements.overlay.textContent = messages[curriculum.overlayStatus] || "";
  }

  function localeLabel(locale) {
    if (locale === "zh-TW" || locale === "zh-Hant-TW") return t("app.locale.zh", "Traditional Chinese");
    if (locale === "en" || locale === "en-US") return t("app.locale.en", "English");
    return t("app.locale.base", "Base");
  }

  async function openChapter(chapterId, push = true, force = false, focusTarget = null) {
    if (!state.curriculum || (state.busy && !force)) return;
    const generation = ++state.generation;
    setBusy(true);
    setStatus("loading", t("app.loading.chapter", "Loading chapter…"));
    try {
      const curriculum = state.curriculum;
      const query = new URLSearchParams({
        packageId: curriculum.packageId, version: curriculum.packageVersion, chapter: chapterId, mode: state.mode,
        translations: String(state.translation), characters: String(state.characters), breakdown: String(state.breakdown)
      });
      const result = await api(`/api/curriculum/chapter?${query}`);
      if (generation !== state.generation) return;
      state.curriculum = result.curriculum;
      state.chapter = result.chapter;
      renderChapter(result);
      if (push) writeRoute({ chapter: result.chapter.id });
      if (String(result.text || "").trim()) setStatus("success", `${result.chapter.title} ${t("app.loaded", "loaded.")}`);
    } catch (error) {
      if (generation === state.generation) showError(error);
    } finally {
      if (generation === state.generation) {
        setBusy(false);
        focusTarget?.focus();
      }
    }
  }

  function renderChapter(result) {
    const chapters = visibleChapters(result.curriculum);
    const index = chapters.findIndex(chapter => chapter.id === result.chapter.id);
    renderOverlay(result.curriculum);
    elements.reader.hidden = false;
    elements.title.textContent = result.chapter.title;
    elements.position.textContent = `${t("app.entry", "Entry")} ${index + 1} ${t("app.of", "of")} ${chapters.length} · ${t("app.version.short", "version")} ${result.curriculum.packageVersion} · ${modeLabel()}`;
    if (String(result.text || "").trim()) {
      elements.content.className = "chapter-content";
      renderMarkdown(elements.content, result.text);
    } else {
      elements.content.className = "chapter-content empty-state";
      elements.content.textContent = t("app.emptyChapter", "This chapter has no readable content.");
      setStatus("empty", t("app.emptyChapter", "This chapter has no readable content."));
    }
    all("#chapters button").forEach(button => {
      if (button.dataset.chapter === result.chapter.id) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    syncControlAvailability();
  }

  function modeLabel() {
    return state.mode === "expert" ? t("app.mode.expert", "Expert") : state.mode === "developer" ? t("app.mode.developer", "Developer") : t("app.mode.normal", "Normal");
  }

  function renderMarkdown(container, text) {
    container.replaceChildren();
    const lines = String(text).replace(/\r\n?/gu, "\n").split("\n");
    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      const heading = /^(#{1,4})\s+(.+)$/u.exec(line);
      if (heading) {
        const node = document.createElement(`h${heading[1].length}`);
        renderInline(node, heading[2]);
        container.append(node);
        index += 1;
        continue;
      }
      if (/^\|.*\|$/u.test(line) && index + 1 < lines.length && /^\|?[\s:|-]+\|?$/u.test(lines[index + 1])) {
        const wrap = document.createElement("div");
        const table = document.createElement("table");
        const rows = [];
        while (index < lines.length && /^\|.*\|$/u.test(lines[index])) rows.push(lines[index++].slice(1, -1).split("|").map(value => value.trim()));
        rows.splice(1, 1);
        rows.forEach((cells, rowIndex) => {
          const row = document.createElement("tr");
          cells.forEach(cell => {
            const node = document.createElement(rowIndex ? "td" : "th");
            renderInline(node, cell);
            row.append(node);
          });
          table.append(row);
        });
        wrap.className = "table-wrap";
        wrap.append(table);
        container.append(wrap);
        continue;
      }
      if (/^[-*]\s+/u.test(line)) {
        const list = document.createElement("ul");
        while (index < lines.length && /^[-*]\s+/u.test(lines[index])) {
          const item = document.createElement("li");
          renderInline(item, lines[index++].replace(/^[-*]\s+/u, ""));
          list.append(item);
        }
        container.append(list);
        continue;
      }
      if (/^```/u.test(line)) {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        const body = [];
        index += 1;
        while (index < lines.length && !/^```/u.test(lines[index])) body.push(lines[index++]);
        if (index < lines.length) index += 1;
        code.textContent = body.join("\n");
        pre.append(code);
        container.append(pre);
        continue;
      }
      if (/^>\s?/u.test(line)) {
        const quote = document.createElement("blockquote");
        const body = [];
        while (index < lines.length && /^>\s?/u.test(lines[index])) body.push(lines[index++].replace(/^>\s?/u, ""));
        renderInline(quote, body.join(" "));
        container.append(quote);
        continue;
      }
      const paragraph = document.createElement("p");
      const body = [];
      while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+|^[-*]\s+|^```|^\|.*\|$|^>\s?/u.test(lines[index])) body.push(lines[index++]);
      renderInline(paragraph, body.join(" "));
      container.append(paragraph);
    }
  }

  function showView(view) {
    const review = view === "review";
    state.view = review ? "review" : "reader";
    elements.readerView.hidden = review;
    elements.readerView.classList.toggle("active", !review);
    elements.reviewView.hidden = !review;
    elements.reviewView.classList.toggle("active", review);
    for (const [link, active] of [[elements.navReader, !review], [elements.navReview, review]]) {
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    }
    elements.skip.href = review ? "#review-session" : "#reader";
    elements.headerEyebrow.textContent = review ? t("app.review.eyebrow", "Practice") : t("app.reader.eyebrow", "Languages");
    elements.headerTitle.textContent = review ? t("app.review.title", "Review") : t("app.reader.title", "Curriculum Reader");
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function showReviewEmpty(title, message, kind = "empty") {
    state.review.card = null;
    state.review.revealed = false;
    const box = node("div", "empty-state review-empty");
    box.append(node("p", "eyebrow", t("app.review.session", "Review session")), node("h2", "", title), node("p", "", message));
    elements.reviewSession.replaceChildren(box);
    setStatus(kind, message);
  }

  function findReviewPackage(packageId, version) {
    return state.review.packages.find(item => item.packageId === packageId && item.packageVersion === version);
  }

  function populateReviewPackageControls(chosen) {
    const ids = [...new Set(state.review.packages.map(item => item.packageId))];
    fill(elements.reviewPackage, ids.map(packageId => ({ value: packageId, label: state.review.packages.find(item => item.packageId === packageId)?.name || packageId })));
    elements.reviewPackage.value = chosen.packageId;
    const versions = state.review.packages.filter(item => item.packageId === chosen.packageId);
    fill(elements.reviewVersion, versions.map(item => ({ value: item.packageVersion, label: item.packageVersion })));
    elements.reviewVersion.value = chosen.packageVersion;
    elements.reviewPackages.hidden = false;
  }

  async function loadReview(route = readRoute()) {
    setStatus("loading", t("app.review.loading", "Loading authorized Review packages…"));
    const data = await api("/api/review");
    state.review.packages = data.packages || [];
    state.review.completedCount = 0;
    if (!state.review.packages.length) {
      elements.reviewPackages.hidden = true;
      elements.decks.replaceChildren();
      showReviewEmpty(t("app.review.none", "No Review packages"), data.unavailable?.length ? t("app.review.unavailable", "An authorized Review package is unavailable or corrupt. Ask an administrator to repair the exact version.") : t("app.review.nonePrompt", "No Review packages are installed and authorized for this account."));
      writeRoute({ reviewPackage: null, reviewVersion: null, reviewSource: null }, true);
      return;
    }
    if ((route.reviewPackage && !route.reviewVersion) || (!route.reviewPackage && route.reviewVersion)) {
      elements.reviewPackages.hidden = true;
      elements.decks.replaceChildren();
      showReviewEmpty(t("app.review.exactRequired", "Exact version required"), t("app.review.exactPrompt", "A Review link must include both package ID and exact version."), "error");
      return;
    }
    if (route.reviewPackage && route.reviewVersion && !findReviewPackage(route.reviewPackage, route.reviewVersion)) {
      elements.reviewPackages.hidden = true;
      elements.decks.replaceChildren();
      showReviewEmpty(t("app.review.unavailableTitle", "Review package unavailable"), t("app.review.unauthorized", "That exact Review package version is unavailable or not authorized for this account."), "error");
      return;
    }
    const chosen = findReviewPackage(route.reviewPackage, route.reviewVersion) || state.review.packages[0];
    await selectReviewPackage(chosen, route.reviewSource, true);
  }

  async function selectReviewPackage(chosen, requestedSource = null, replace = false) {
    state.review.package = chosen;
    state.review.source = null;
    state.review.card = null;
    state.review.completedCount = 0;
    populateReviewPackageControls(chosen);
    elements.decks.replaceChildren();
    if (!chosen.sources.length) {
      showReviewEmpty(t("app.review.noSources", "No Review sources"), t("app.review.noSourcesPrompt", "This exact Review package version contains no usable Review sources."));
      writeRoute({ reviewSource: null }, replace);
      return;
    }
    const scope = node("p", "deck-group-label", chosen.scope === "specialized" ? t("app.review.specialized", "Specialized Review") : t("app.review.ordinary", "Ordinary Review"));
    const buttons = chosen.sources.map(source => {
      const button = node("button", "deck-item");
      button.type = "button";
      button.dataset.source = source.sourcePath;
      const meta = node("span", "deck-meta");
      meta.append(node("span", "", `${source.itemCount} ${t("app.review.cards", "cards")}`), node("span", "due-badge", `${source.due} ${t("app.review.due", "due")}`));
      button.append(node("strong", "", source.title), meta);
      button.addEventListener("click", () => void selectReviewSource(source, false));
      return button;
    });
    elements.decks.append(scope, ...buttons);
    if (requestedSource && !chosen.sources.some(source => source.sourcePath === requestedSource)) {
      showReviewEmpty(t("app.review.sourceMissing", "Review source unavailable"), t("app.review.sourceMissingPrompt", "That source path does not exist in the authorized exact package version."), "error");
      writeRoute({ reviewSource: requestedSource }, true);
      return;
    }
    const source = chosen.sources.find(item => item.sourcePath === requestedSource) || chosen.sources[0];
    await selectReviewSource(source, replace);
  }

  async function selectReviewSource(source, replace = false) {
    state.review.source = source;
    state.review.card = null;
    state.review.revealed = false;
    state.review.completedCount = 0;
    all("#deck-list .deck-item").forEach(button => {
      if (button.dataset.source === source.sourcePath) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
    });
    writeRoute({ reviewSource: source.sourcePath }, replace);
    await loadReviewSession();
  }

  async function loadReviewSession({ preserveCompleted = true } = {}) {
    const selected = state.review.package, source = state.review.source;
    if (!selected || !source) return;
    setBusy(true);
    setStatus("loading", t("app.review.loadingSession", "Loading due cards…"));
    try {
      const query = new URLSearchParams({ packageId: selected.packageId, version: selected.packageVersion, sourcePath: source.sourcePath });
      const result = await api(`/api/review/session?${query}`);
      if (result.complete) {
        const reviewed = preserveCompleted ? state.review.completedCount : 0;
        showReviewEmpty(reviewed ? t("app.review.complete", "Session complete") : t("app.review.noneDue", "No cards due"), reviewed ? `${t("app.review.completePrompt", "You reviewed")} ${reviewed} ${reviewed === 1 ? t("app.review.card", "card") : t("app.review.cards", "cards")}.` : t("app.review.noneDuePrompt", "This source has no active cards due right now."), "success");
      } else {
        renderReviewCard(result);
        setStatus("success", `${result.due} ${t("app.review.dueNow", "cards due in this source.")}`);
      }
    } catch (error) {
      showReviewFailure(error);
    } finally {
      setBusy(false);
    }
  }

  function renderReviewCard(result) {
    const card = result.card;
    state.review.card = card;
    state.review.revealed = false;
    state.review.submitting = false;
    const article = node("article", "review-card");
    const header = node("header", "review-card-header");
    const titles = node("div", "");
    titles.append(node("p", "eyebrow", t("app.review.prompt", "Prompt")), node("h2", "", card.title));
    header.append(titles, node("div", "review-count", `${result.due} ${t("app.review.due", "due")} · ${t("app.review.version", "version")} ${result.packageVersion}`));
    const prompt = node("section", "review-prompt");
    prompt.setAttribute("role", "region");
    prompt.setAttribute("aria-label", t("app.review.prompt", "Prompt"));
    for (const line of card.promptLines) prompt.append(node("p", "", line));
    if (card.hintLines?.length) prompt.append(node("div", "review-hints", card.hintLines.join(" · ")));
    const reveal = node("button", "button reveal-button", t("app.review.reveal", "Reveal answer"));
    reveal.type = "button";
    reveal.addEventListener("click", () => void revealAnswer());
    prompt.append(reveal);
    const footer = node("footer", "review-keyboard-hint", t("app.review.revealHint", "Press Enter or Space to reveal. Ratings are available only afterward."));
    article.append(header, prompt, footer);
    elements.reviewSession.replaceChildren(article);
    elements.reviewSession.focus();
  }

  async function revealAnswer() {
    if (state.view !== "review" || state.review.revealed || state.review.submitting || !state.review.card || !state.review.package || !state.review.source) return;
    state.review.submitting = true;
    setBusy(true);
    try {
      const result = await api("/api/review/reveal", { method: "POST", body: JSON.stringify({ packageId: state.review.package.packageId, packageVersion: state.review.package.packageVersion, sourcePath: state.review.source.sourcePath, itemId: state.review.card.itemId }) });
      const article = elements.reviewSession.querySelector(".review-card");
      if (!article) return;
      article.querySelector(".reveal-button")?.remove();
      const answer = node("section", "review-answer");
      answer.tabIndex = -1;
      answer.setAttribute("role", "region");
      answer.setAttribute("aria-live", "polite");
      answer.setAttribute("aria-label", t("app.review.answer", "Answer"));
      answer.append(node("h3", "", t("app.review.answer", "Answer")));
      for (const line of result.answerLines || []) answer.append(node("p", "", line));
      const evidenceLines = [...(result.noteLines || []), ...(result.exampleLines || []), ...(result.evidence ? [result.evidence] : [])];
      if (evidenceLines.length || result.sourceAvailable === false) {
        const evidence = node("div", "review-evidence");
        evidence.append(node("h3", "", t("app.review.evidence", "Source example / evidence")));
        for (const line of evidenceLines) evidence.append(node("p", "", line));
        if (result.sourceAvailable === false) evidence.append(node("p", "", t("app.review.sourceUnavailable", "The linked reading source is unavailable; the packaged card remains reviewable.")));
        answer.append(evidence);
      }
      const ratings = node("div", "rating-bar");
      ratings.setAttribute("role", "group");
      ratings.setAttribute("aria-label", t("app.review.grade", "Grade this answer"));
      [["again", "1", "Again"], ["hard", "2", "Hard"], ["good", "3", "Good"], ["easy", "4", "Easy"]].forEach(([rating, key, label]) => {
        const button = node("button", "rating-button");
        button.type = "button";
        button.dataset.rating = rating;
        button.setAttribute("aria-label", `${key} — ${t(`app.review.rating.${rating}`, label)}`);
        button.append(node("span", "", t(`app.review.rating.${rating}`, label)), node("small", "", key));
        button.addEventListener("click", () => void gradeReview(rating));
        ratings.append(button);
      });
      article.insertBefore(answer, article.lastElementChild);
      article.insertBefore(ratings, article.lastElementChild);
      article.lastElementChild.textContent = t("app.review.gradeHint", "Grade with 1–4, or use a rating button.");
      state.review.revealed = true;
      state.review.submitting = false;
      setBusy(false);
      answer.focus();
      setStatus("success", t("app.review.revealed", "Answer revealed. Choose a rating."));
    } catch (error) { showError(error); }
    finally { state.review.submitting = false; setBusy(false); }
  }

  async function gradeReview(rating) {
    if (!state.review.revealed || state.review.submitting || !state.review.card || !state.review.package || !state.review.source) return;
    state.review.submitting = true;
    all(".rating-button").forEach(button => { button.disabled = true; });
    setBusy(true);
    try {
      await api("/api/review/answer", { method: "POST", body: JSON.stringify({ packageId: state.review.package.packageId, packageVersion: state.review.package.packageVersion, sourcePath: state.review.source.sourcePath, itemId: state.review.card.itemId, expectedReviewCount: state.review.card.reviewCount, rating }) });
      state.review.completedCount += 1;
      state.review.source.due = Math.max(0, state.review.source.due - 1);
      const badge = all("#deck-list .deck-item").find(button => button.dataset.source === state.review.source.sourcePath)?.querySelector(".due-badge");
      if (badge) badge.textContent = `${state.review.source.due} ${t("app.review.due", "due")}`;
      await loadReviewSession();
    } catch (error) {
      showError(error);
      all(".rating-button").forEach(button => { button.disabled = false; });
      elements.reviewSession.focus();
    } finally { state.review.submitting = false; setBusy(false); }
  }

  function showReviewFailure(error) {
    state.review.card = null;
    const box = node("div", "empty-state review-empty");
    box.append(node("p", "eyebrow", t("app.review.error", "Review unavailable")), node("h2", "", t("app.review.retryTitle", "Could not load this session")), node("p", "", error.message));
    const actions = node("div", "review-error-actions");
    const retry = node("button", "button", t("app.review.retry", "Retry"));
    retry.type = "button";
    retry.addEventListener("click", () => void loadReviewSession());
    actions.append(retry);
    box.append(actions);
    elements.reviewSession.replaceChildren(box);
    showError(error);
  }

  function renderInline(node, text) {
    const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/gu;
    let position = 0;
    let match;
    while ((match = pattern.exec(text))) {
      node.append(document.createTextNode(text.slice(position, match.index)));
      if (match[2]) {
        const strong = document.createElement("strong"); strong.textContent = match[2]; node.append(strong);
      } else if (match[3]) {
        const code = document.createElement("code"); code.textContent = match[3]; node.append(code);
      } else if (match[4]) {
        const emphasis = document.createElement("em"); emphasis.textContent = match[4]; node.append(emphasis);
      } else if (safeUrl(match[6])) {
        const link = document.createElement("a");
        link.textContent = match[5];
        link.href = match[6];
        const parsed = new URL(link.href);
        if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin !== location.origin) {
          link.rel = "noopener noreferrer";
          link.target = "_blank";
        }
        node.append(link);
      } else node.append(document.createTextNode(match[5]));
      position = pattern.lastIndex;
    }
    node.append(document.createTextNode(text.slice(position)));
  }

  function safeUrl(value) {
    try {
      const decoded = decodeURIComponent(value.trim());
      if (decoded.startsWith("//")) return false;
      const parsed = new URL(decoded, location.href);
      return parsed.protocol === "mailto:" || ((parsed.protocol === "http:" || parsed.protocol === "https:") && (/^[a-z][a-z0-9+.-]*:/iu.test(decoded) || parsed.origin === location.origin));
    } catch { return false; }
  }

  async function saveSourceLocale(locale) {
    const generation = ++state.generation;
    const focusTarget = elements.source;
    setBusy(true);
    setStatus("loading", t("app.savingSource", "Saving source language…"));
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ locale, theme: document.documentElement.dataset.theme }) });
      state.locale = locale;
      elements.source.value = locale;
      if (state.view === "review") {
        await loadReview(readRoute());
        setStatus("success", t("app.sourceSaved", "Source language saved."));
        return;
      }
      const data = await api("/api/curricula");
      if (generation !== state.generation) return;
      state.curricula = data.curricula || [];
      state.unavailable = data.unavailable || [];
      const selected = findCurriculum(state.curriculum?.packageId, state.curriculum?.packageVersion);
      if (!selected) {
        showNoCurricula();
        writeRoute({ locale, packageId: null, version: null, chapter: null });
        return;
      }
      const chapter = state.chapter?.id;
      await selectCurriculum(selected, chapter, false, false, focusTarget);
      if (!chapter) focusTarget.focus();
      setStatus("success", t("app.sourceSaved", "Source language saved."));
    } catch (error) {
      if (generation === state.generation) showError(error);
    } finally {
      if (generation === state.generation) { setBusy(false); focusTarget.focus(); }
    }
  }

  async function toggleTheme() {
    const previous = document.documentElement.dataset.theme || "dark";
    const next = previous === "light" ? "dark" : "light";
    applyTheme(next);
    savePreferences();
    setBusy(true);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ locale: state.locale, theme: next }) });
      setStatus("success", t("app.themeSaved", "Theme saved."));
    } catch (error) {
      applyTheme(previous);
      savePreferences();
      showError(error);
    } finally { setBusy(false); elements.theme.focus(); }
  }

  async function changeDisplay(focusTarget) {
    syncDisplayControls();
    const previousChapter = chapterForMode(state.chapter?.id);
    if (state.curriculum) {
      await selectCurriculum(state.curriculum, previousChapter, false, false, focusTarget);
      if (!previousChapter) focusTarget.focus();
    }
  }

  function setSidebar(open) {
    elements.sidebar.classList.toggle("open", open);
    elements.menu.setAttribute("aria-expanded", String(open));
    elements.backdrop.hidden = !open;
    if (open) elements.sidebar.querySelector("a.active")?.focus();
    else elements.menu.focus();
  }

  async function restoreHistory() {
    await start();
  }

  elements.curriculum.addEventListener("change", () => {
    const versions = state.curricula.filter(item => item.packageId === elements.curriculum.value);
    const selected = versions[0];
    if (selected) selectCurriculum(selected, null, false);
  });
  elements.version.addEventListener("change", () => {
    const selected = findCurriculum(elements.curriculum.value, elements.version.value);
    if (selected) selectCurriculum(selected, null, false);
  });
  elements.reviewPackage.addEventListener("change", () => {
    const selected = state.review.packages.find(item => item.packageId === elements.reviewPackage.value);
    if (selected) void selectReviewPackage(selected, null, false);
  });
  elements.reviewVersion.addEventListener("change", () => {
    const selected = findReviewPackage(elements.reviewPackage.value, elements.reviewVersion.value);
    if (selected) void selectReviewPackage(selected, null, false);
  });
  elements.source.addEventListener("change", () => saveSourceLocale(elements.source.value));
  elements.theme.addEventListener("click", toggleTheme);
  all("[data-mode]").forEach(button => button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    void changeDisplay(button);
  }));
  for (const [control, key] of [[elements.translation, "translation"], [elements.characters, "characters"], [elements.breakdown, "breakdown"]]) {
    control.addEventListener("change", () => { state[key] = control.checked; void changeDisplay(control); });
  }
  elements.previous.addEventListener("click", () => elements.previous.dataset.chapter && openChapter(elements.previous.dataset.chapter, true, false, elements.reader));
  elements.next.addEventListener("click", () => elements.next.dataset.chapter && openChapter(elements.next.dataset.chapter, true, false, elements.reader));
  elements.logout.addEventListener("click", async () => {
    if (state.busy) return;
    setBusy(true);
    try { await api("/api/logout", { method: "POST", body: "{}" }); location.assign("/login"); }
    catch (error) { showError(error); setBusy(false); }
  });
  elements.menu.addEventListener("click", () => setSidebar(!elements.sidebar.classList.contains("open")));
  elements.backdrop.addEventListener("click", () => setSidebar(false));
  for (const [link, view] of [[elements.navReader, "reader"], [elements.navReview, "review"]]) link.addEventListener("click", event => {
    event.preventDefault();
    if (state.busy) return;
    history.pushState(null, "", `/app?view=${view}`);
    setSidebar(false);
    void start();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && elements.sidebar.classList.contains("open")) { event.preventDefault(); setSidebar(false); }
    if (state.view !== "review" || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if ((event.key === "Enter" || event.key === " ") && state.review.card) {
      if (state.review.revealed) {
        if (event.target instanceof Element && event.target.closest(".rating-button")) event.preventDefault();
        return;
      }
      if (event.target instanceof Element && event.target.closest("select, input, textarea")) return;
      event.preventDefault();
      void revealAnswer();
      return;
    }
    if (!state.review.revealed || !["1", "2", "3", "4"].includes(event.key)) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select")) return;
    event.preventDefault();
    void gradeReview(["again", "hard", "good", "easy"][Number(event.key) - 1]);
  });
  addEventListener("popstate", () => void restoreHistory());
  void start();
})();
