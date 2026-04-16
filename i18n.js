/**
 * i18n helper — replaces text in elements with data-i18n attributes
 * using chrome.i18n.getMessage().
 *
 * Supported attributes:
 *   data-i18n="key"                → textContent
 *   data-i18n-title="key"          → title
 *   data-i18n-placeholder="key"    → placeholder
 *   data-i18n-html="key"           → innerHTML (use sparingly)
 */
function applyI18n(root) {
  if (typeof chrome === 'undefined' || !chrome.i18n) return;
  const base = root || document;

  base.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  base.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
    if (msg) el.title = msg;
  });
  base.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
    if (msg) el.placeholder = msg;
  });
  base.querySelectorAll('[data-i18n-html]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nHtml);
    if (msg) el.innerHTML = msg;
  });
}

function i18n(key, substitutions) {
  if (typeof chrome === 'undefined' || !chrome.i18n) return key;
  return chrome.i18n.getMessage(key, substitutions) || key;
}

document.addEventListener('DOMContentLoaded', () => applyI18n());
