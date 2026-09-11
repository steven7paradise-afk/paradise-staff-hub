import assert from "node:assert/strict";
import test from "node:test";
import { hasInternalEmailContent, internalEmailPlainText, sanitizeInternalEmailHtml } from "../lib/internal-email-html";

test("mantiene la formattazione consentita delle email", () => {
  const html = sanitizeInternalEmailHtml('<p>Ciao <strong>team</strong></p><ul><li>Novità</li></ul><a href="https://paradisebeauty.it">Apri</a>');

  assert.match(html, /<strong>team<\/strong>/);
  assert.match(html, /<ul><li>Novità<\/li><\/ul>/);
  assert.match(html, /href="https:\/\/paradisebeauty\.it"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("rimuove script, stili e link non sicuri", () => {
  const html = sanitizeInternalEmailHtml('<script>alert(1)</script><p style="color:red" onclick="alert(2)">Testo</p><a href="javascript:alert(3)">clicca</a>');

  assert.doesNotMatch(html, /script|style=|onclick|javascript:/i);
  assert.match(html, /<p>Testo<\/p>/);
  assert.match(html, />clicca<\/a>/);
});

test("genera l’anteprima testuale e riconosce i messaggi vuoti", () => {
  assert.equal(internalEmailPlainText("<p>Ciao <strong>team</strong></p><ul><li>Prima</li><li>Seconda</li></ul>"), "Ciao team\nPrima\nSeconda");
  assert.equal(hasInternalEmailContent("<p><br></p>"), false);
  assert.equal(hasInternalEmailContent("<p>Messaggio</p>"), true);
});

