(() => {
  "use strict";

  const imagePattern = /!\[([^\]\r\n]+)\]\((media\/[^)\r\n]+)\)/gu;
  const allowedMediaTypes = new Set(["image/webp", "image/png", "image/jpeg"]);

  function localized(value, locale) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    return value[locale] ?? value[locale === "en-US" ? "en" : locale] ?? Object.values(value).find(candidate => typeof candidate === "string") ?? "";
  }

  function renderBlock(container, block, media, locale = "en-US") {
    const text = localized(block?.text, locale);
    container.replaceChildren();
    if (block?.mediaType !== "text/markdown") {
      container.textContent = text;
      return;
    }
    const records = new Map((Array.isArray(media) ? media : []).map(record => [record.path, record]));
    let offset = 0;
    imagePattern.lastIndex = 0;
    for (const match of text.matchAll(imagePattern)) {
      appendText(container, text.slice(offset, match.index));
      const alt = match[1];
      const path = match[2];
      const record = records.get(path);
      if (!record || !allowedMediaTypes.has(record.mediaType)) throw new Error(`Validated package image record is missing: ${path}`);
      const url = new URL(record.url, location.href);
      if (url.origin !== location.origin || url.pathname !== "/api/package-media" || !url.searchParams.has("packageId") || !url.searchParams.has("version") || url.searchParams.get("path") !== path) {
        throw new Error(`Unsafe package image URL: ${path}`);
      }
      const image = document.createElement("img");
      image.className = "memorization-package-image";
      image.alt = alt;
      image.loading = "eager";
      image.decoding = "async";
      image.src = url.href;
      container.append(image);
      offset = (match.index ?? 0) + match[0].length;
    }
    appendText(container, text.slice(offset));
  }

  function appendText(container, text) {
    const lines = text.replace(/\r\n?/gu, "\n").split("\n");
    lines.forEach((line, index) => {
      if (index > 0) container.append(document.createElement("br"));
      if (line.length > 0) container.append(document.createTextNode(line));
    });
  }

  window.WhackSmackerMemorizationMedia = Object.freeze({ renderBlock });
})();
