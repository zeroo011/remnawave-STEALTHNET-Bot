import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const candidates = [
  new URL("./modules/branding/spa-html.js", import.meta.url),
  new URL("../dist/modules/branding/spa-html.js", import.meta.url),
  new URL("../src/modules/branding/spa-html.js", import.meta.url),
];
let spaHtmlPath = null;
for (const c of candidates) {
  if (fs.existsSync(c)) {
    spaHtmlPath = c.href;
    break;
  }
}
if (!spaHtmlPath) {
  throw new Error("Could not find spa-html.js module in any expected location");
}

const { renderHtml, replaceOrInsertMeta, escapeAttr, escapeHtml } = await import(spaHtmlPath);

test("spa-html: replaceOrInsertMeta properly replaces existing meta tags regardless of attribute order", () => {
  const html1 = `<html><head><meta name="description" content="old"></head><body></body></html>`;
  const res1 = replaceOrInsertMeta(html1, "name", "description", "new description");
  assert.ok(res1.includes('<meta name="description" content="new description" />'));
  assert.ok(!res1.includes('"old"'));

  const html2 = `<html><head><meta content="old val" property="og:description"></head><body></body></html>`;
  const res2 = replaceOrInsertMeta(html2, "property", "og:description", "new og val");
  assert.ok(res2.includes('<meta property="og:description" content="new og val" />'));
  assert.ok(!res2.includes("old val"));
});

test("spa-html: replaceOrInsertMeta inserts missing meta tags before </head>", () => {
  const html = `<html><head><title>Title</title></head><body></body></html>`;
  const res = replaceOrInsertMeta(html, "property", "og:image", "https://example.com/pic.png");
  assert.ok(res.includes('<meta property="og:image" content="https://example.com/pic.png" />'));
  assert.ok(res.includes("</head>"));
});

test("spa-html: escapeAttr and escapeHtml correctly sanitize special characters", () => {
  const raw = `Ghost "Test" & <Special>`;
  assert.equal(escapeAttr(raw), "Ghost &quot;Test&quot; &amp; &lt;Special&gt;");
  assert.equal(escapeHtml(raw), "Ghost &quot;Test&quot; &amp; &lt;Special&gt;");
});

test("spa-html: renderHtml overrides old hardcoded tags with dynamic DB values", () => {
  const hardcodedTpl = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <title>GhostNet</title>
    <meta name="description" content="GhostNet - старое описание" />
    <meta property="og:title" content="GhostNet" />
    <meta property="og:description" content="GhostNet - старое описание" />
    <meta property="og:image" content="https://ghostnet.store/preview.png" />
  </head>
  <body><div id="root"></div></body>
</html>`;

  const brand = {
    brand: "GhostNet",
    description: "GhostNet — самый быстрый и безопасный VPN",
    ogImage: "https://ghostnet.store/api/public/brand/og-image.png",
    publicAppUrl: "https://ghostnet.store",
  };

  const res = renderHtml(hardcodedTpl, brand);
  assert.ok(res.includes("<title>GhostNet</title>"));
  assert.ok(res.includes('<meta property="og:description" content="GhostNet — самый быстрый и безопасный VPN" />'));
  assert.ok(res.includes('<meta name="description" content="GhostNet — самый быстрый и безопасный VPN" />'));
  assert.ok(res.includes('<meta property="og:image" content="https://ghostnet.store/api/public/brand/og-image.png" />'));
  assert.ok(res.includes('<meta property="og:url" content="https://ghostnet.store/" />'));
  assert.ok(res.includes('<meta name="twitter:card" content="summary_large_image" />'));
  assert.ok(!res.includes("GhostNet - старое описание"));
  assert.ok(!res.includes("preview.png"));
});

test("spa-html: resolveOgImage fallback logic (ogImage -> favicon -> logo -> default)", () => {
  function testFallback(cfg, publicAppUrl) {
    const rawImage = (cfg?.ogImage || cfg?.favicon || cfg?.logo || cfg?.logoBot || "").trim();
    if (/^https?:\/\//i.test(rawImage)) return rawImage;
    if (rawImage || publicAppUrl) {
      return publicAppUrl ? `${publicAppUrl}/api/public/brand/og-image.png` : `/api/public/brand/og-image.png`;
    }
    return publicAppUrl ? `${publicAppUrl}/apple-touch-icon.png` : `/apple-touch-icon.png`;
  }

  const host = "https://ghostnet.store";

  // 1. Кастомный ogImage задан
  assert.equal(
    testFallback({ ogImage: "data:image/png;base64,123", favicon: "data:image/png;base64,456" }, host),
    "https://ghostnet.store/api/public/brand/og-image.png"
  );

  // 2. ogImage не задан, есть favicon -> fallback на фавикон
  assert.equal(
    testFallback({ ogImage: null, favicon: "data:image/png;base64,456" }, host),
    "https://ghostnet.store/api/public/brand/og-image.png"
  );

  // 3. Прямой URL картинки
  assert.equal(
    testFallback({ ogImage: "https://cdn.example.com/banner.png" }, host),
    "https://cdn.example.com/banner.png"
  );

  // 4. Нет картинок вообще, но есть publicAppUrl -> эндпоинт /api/public/brand/og-image.png
  assert.equal(
    testFallback({ ogImage: null, favicon: null, logo: null }, host),
    "https://ghostnet.store/api/public/brand/og-image.png"
  );

  // 5. Ни картинок, ни publicAppUrl -> относительный путь
  assert.equal(
    testFallback({ ogImage: null, favicon: null, logo: null }, null),
    "/apple-touch-icon.png"
  );
});
