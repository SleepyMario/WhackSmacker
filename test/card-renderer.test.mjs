import assert from "node:assert/strict";
import { test } from "node:test";

import { renderAnkiCardHtml } from "../dist/packages/language/card-renderer.js";

test("renderer removes style content and template CSS", () => {
  const rendered = renderAnkiCardHtml("<style>.card { font-family: PMingLiU; font-size: 12px; }</style><div>日本語</div>");

  assert.equal(rendered, "日本語");
  assert.doesNotMatch(rendered, /font-family|PMingLiU|card/u);
});

test("renderer removes raw CSS and font declarations", () => {
  const rendered = renderAnkiCardHtml(".card { font-family: Arial; color: red; }\nfont-family: Arial;\n<p>Front</p>");

  assert.equal(rendered, "Front");
});

test("renderer removes script content", () => {
  const rendered = renderAnkiCardHtml("<script>alert('bad')</script><p>Answer</p>");

  assert.equal(rendered, "Answer");
  assert.doesNotMatch(rendered, /alert|script/u);
});

test("renderer converts breaks paragraphs and lists to readable lines", () => {
  const rendered = renderAnkiCardHtml("<p>One<br>Two</p><ul><li>Three</li><li>Four</li></ul>");

  assert.equal(rendered, "One\nTwo\n- Three\n- Four");
});

test("renderer decodes entities and nonbreaking spaces", () => {
  const rendered = renderAnkiCardHtml("<p>A&amp;B&nbsp;&lt;C&gt; &#26085;&#x672c;</p>");

  assert.equal(rendered, "A&B <C> 日本");
});

test("renderer preserves multilingual Unicode text", () => {
  const rendered = renderAnkiCardHtml("<div>日本語 中文 한국어 Tiếng Việt</div>");

  assert.equal(rendered, "日本語 中文 한국어 Tiếng Việt");
});

test("renderer removes repeated blank lines", () => {
  const rendered = renderAnkiCardHtml("<p>Front</p><br><br><br><p>Back</p>");

  assert.equal(rendered, "Front\nBack");
});

test("renderer renders image placeholder from alt text", () => {
  const rendered = renderAnkiCardHtml('<p>See <img src="media/card.png" alt="stroke order"></p>');

  assert.equal(rendered, "See [image: stroke order]");
});

test("renderer renders image placeholder from filename", () => {
  const rendered = renderAnkiCardHtml('<p><img src="/collection.media/kanji%201.png"></p>');

  assert.equal(rendered, "[image: kanji 1.png]");
});

test("renderer ignores hidden elements", () => {
  const rendered = renderAnkiCardHtml('<div>Visible</div><div hidden>Hidden</div><span style="display: none">Also hidden</span>');

  assert.equal(rendered, "Visible");
});
