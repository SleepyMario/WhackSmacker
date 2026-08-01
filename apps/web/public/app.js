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
    translation: byId("translation-toggle"), characters: byId("characters-toggle"), breakdown: byId("breakdown-toggle")
  };
  const preferenceKey = "whacksmacker.web.reader.v1";
  const state = {
    curricula: [], curriculum: null, chapter: null, locale: "en", mode: "normal", translation: false,
    characters: false, breakdown: false, busy: false, generation: 0, unavailable: []
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
    if (status === 403) return t("app.error.unauthorized", "You are not authorized to use that curriculum version.");
    if (status === 404) return t("app.error.notFound", "That curriculum or chapter is no longer available.");
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
    return {
      packageId: value("package", "packageId"), version: value("version"), chapter: value("chapter"), locale: canonicalLocale(value("locale")),
      mode: ["normal", "expert", "developer"].includes(mode) ? mode : null,
      translation: booleanValue(value("translation", "translations")), characters: booleanValue(value("characters")), breakdown: booleanValue(value("breakdown"))
    };
  }

  function routeState(overrides = {}) {
    const next = {
      packageId: state.curriculum?.packageId ?? null,
      version: state.curriculum?.packageVersion ?? null,
      chapter: state.chapter?.id ?? null,
      locale: state.locale,
      mode: state.mode,
      translation: state.translation,
      characters: state.characters,
      breakdown: state.breakdown,
      ...overrides
    };
    const params = new URLSearchParams();
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
      const data = await api("/api/curricula");
      if (generation !== state.generation) return;
      state.locale = locale;
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
    const route = readRoute();
    const generation = ++state.generation;
    setBusy(true);
    try {
      state.mode = route.mode || "normal";
      state.translation = route.translation;
      state.characters = route.characters;
      state.breakdown = route.breakdown;
      syncDisplayControls();
      if (route.locale && route.locale !== state.locale) {
        await api("/api/settings", { method: "PUT", body: JSON.stringify({ locale: route.locale, theme: document.documentElement.dataset.theme }) });
        state.locale = route.locale;
        elements.source.value = state.locale;
        const data = await api("/api/curricula");
        state.curricula = data.curricula || [];
        state.unavailable = data.unavailable || [];
      }
      if (generation !== state.generation) return;
      if ((route.packageId && !route.version) || (!route.packageId && route.version) || (route.packageId && route.version && !findCurriculum(route.packageId, route.version))) {
        showUnavailableExactVersion(t("app.error.unavailableVersion", "The curriculum version in this link is unavailable or not authorized for your account."));
        return;
      }
      const selected = findCurriculum(route.packageId, route.version) || state.curricula[0];
      if (!selected) { showNoCurricula(); return; }
      await selectCurriculum(selected, route.chapter, true, true);
    } catch (error) { if (generation === state.generation) showError(error); }
    finally { if (generation === state.generation) setBusy(false); }
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
  elements.sidebar.querySelector("a.active")?.addEventListener("click", () => setSidebar(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && elements.sidebar.classList.contains("open")) { event.preventDefault(); setSidebar(false); }
  });
  addEventListener("popstate", () => void restoreHistory());
  void start();
})();
