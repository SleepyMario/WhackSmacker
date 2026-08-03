import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import {
  assertMemorizationMediaManifestReferences,
  isSafePackageImagePath,
  markdownForPedagogicalFingerprint,
  markdownWithImagePlaceholders,
  packageImageMediaTypeForPath,
  parseMemorizationMarkdownImages
} from "../dist/packages/core/index.js";

const prompt = "![Animal illustration](media/animal-0001-dog-illustration.webp)\n\ndog\n\nThe dog is running in the garden.";

test("package image paths and MIME types support only safe raster media", () => {
  assert.equal(packageImageMediaTypeForPath("media/a.webp"), "image/webp");
  assert.equal(packageImageMediaTypeForPath("media/a.png"), "image/png");
  assert.equal(packageImageMediaTypeForPath("media/a.jpg"), "image/jpeg");
  assert.equal(packageImageMediaTypeForPath("media/a.jpeg"), "image/jpeg");
  assert.equal(packageImageMediaTypeForPath("media/a.svg"), undefined);
  assert.equal(isSafePackageImagePath("media/animals/dog.webp"), true);
});

test("unsafe URL and path forms are rejected as Markdown package images", () => {
  const rejected = [
    "http://example.com/a.webp", "https://example.com/a.webp", "//example.com/a.webp",
    "data:image/png;base64,AAAA", "file:///tmp/a.png", "javascript:alert(1)", "blob:https://example.com/id",
    "/media/a.png", "C:/media/a.png", "C:\\media\\a.png", "media\\a.png",
    "media/../a.png", "media/./a.png", "media//a.png", "media/%2e%2e/a.png", "media/%252e%252e/a.png",
    "media/a.png?x=1", "media/a.png#fragment", "media/a.svg", "media/a.gif", "media/a.PNG", "media/\0a.png"
  ];
  for (const path of rejected) {
    assert.equal(isSafePackageImagePath(path), false, path);
    assert.throws(() => parseMemorizationMarkdownImages(`![safe alt](${path})`), /Unsafe or unsupported/u, path);
  }
});

test("Markdown image placeholders preserve safe alt text and surrounding text", () => {
  assert.deepEqual(parseMemorizationMarkdownImages(prompt).map(({ alt, path }) => ({ alt, path })), [{
    alt: "Animal illustration", path: "media/animal-0001-dog-illustration.webp"
  }]);
  assert.doesNotMatch(parseMemorizationMarkdownImages(prompt)[0].alt, /dog/iu);
  assert.equal(markdownWithImagePlaceholders(prompt), "[Image: Animal illustration]\n\ndog\n\nThe dog is running in the garden.");
  assert.throws(() => parseMemorizationMarkdownImages("![](media/a.png)"), /non-empty alt text/u);
});

test("raw HTML remains inert and is never recognized as package image Markdown", () => {
  const html = "<img src=x onerror=alert(1)>";
  assert.deepEqual(parseMemorizationMarkdownImages(html), []);
  assert.equal(markdownWithImagePlaceholders(html), html);
});

test("asset paths do not become pedagogical identity material", () => {
  const first = markdownForPedagogicalFingerprint("![Animal illustration](media/a.webp)\n\ndog");
  const second = markdownForPedagogicalFingerprint("![Animal illustration](media/replaced.webp)\n\ndog");
  assert.equal(first, second);
  assert.match(first, /media\/package-image/u);
});

test("manifest media references require exact unique metadata and MIME types", () => {
  const item = { schemaVersion: 1, id: "animal/dog", kind: "vocabulary", prompt: { text: prompt, plainText: markdownWithImagePlaceholders(prompt), mediaType: "text/markdown" }, answer: { text: "dog" } };
  const record = { path: "media/animal-0001-dog-illustration.webp", mediaType: "image/webp", size: 4, sha256: "0".repeat(64) };
  assert.equal(assertMemorizationMediaManifestReferences(item, [record]).length, 1);
  assert.throws(() => assertMemorizationMediaManifestReferences(item, []), /missing from package metadata/u);
  assert.throws(() => assertMemorizationMediaManifestReferences(item, [{ ...record, mediaType: "text/plain" }]), /MIME type mismatch/u);
  assert.throws(() => assertMemorizationMediaManifestReferences(item, [record, record]), /Duplicate or ambiguous/u);
});

test("browser memorization renderer creates only validated same-origin images and inert text", async () => {
  const script = await readFile("apps/web/public/memorization-media.js", "utf8");
  const dom = new JSDOM("<div id=card></div>", { url: "http://127.0.0.1:8787/app", runScripts: "outside-only" });
  dom.window.eval(script);
  const container = dom.window.document.querySelector("#card");
  const media = [{
    path: "media/animal-0001-dog-illustration.webp",
    mediaType: "image/webp",
    url: "/api/package-media?packageId=com.example.animals&version=1.0.0&path=media%2Fanimal-0001-dog-illustration.webp"
  }];
  dom.window.WhackSmackerMemorizationMedia.renderBlock(container, {
    text: `${prompt}\n\n<img src=x onerror=alert(1)>`, mediaType: "text/markdown"
  }, media);
  const image = container.querySelector("img");
  assert.equal(image.alt, "Animal illustration");
  assert.equal(image.getAttribute("onerror"), null);
  assert.equal(container.querySelectorAll("img").length, 1);
  assert.match(container.textContent, /dog[\s\S]*<img src=x onerror=alert\(1\)>/u);
  dom.window.WhackSmackerMemorizationMedia.renderBlock(container, { text: "![<b>Animal</b>](media/animal-0001-dog-illustration.webp)", mediaType: "text/markdown" }, media);
  assert.equal(container.querySelector("img").alt, "<b>Animal</b>");
  assert.equal(container.querySelector("b"), null);
  assert.throws(() => dom.window.WhackSmackerMemorizationMedia.renderBlock(container, { text: prompt, mediaType: "text/markdown" }, [{ ...media[0], url: "https://evil.example/a.webp" }]), /Unsafe package image URL/u);
});
