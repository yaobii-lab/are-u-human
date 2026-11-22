// The catalog is a regular script so page scripts can translate their first render synchronously.
(() => {
  const storageKey = 'neverland-language';
  const visit = location.pathname.match(/^\/visit\/[0-9a-f]{32}(?=\/)/)?.[0] || '';
  const requested = new URL(location.href).searchParams.get('lang');
  const supported = value => value === 'en' || value === 'zh';
  let lang = supported(requested) ? requested : 'en';
  try {
    if (!visit && supported(requested)) localStorage.setItem(storageKey, lang);
    else if (!visit) {
      const saved = localStorage.getItem(storageKey);
      if (supported(saved)) lang = saved;
    }
  } catch { /* URL navigation still works with storage disabled. */ }

  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const messages = window.neverlandMessages[lang];
  function t(key, params = {}) {
    return messages[key].replace(/\{(\w+)\}/g, (_, name) => params[name]);
  }
  function url(path, language = lang) {
    const target = new URL(path, location.href);
    if (visit && !target.pathname.startsWith(visit + '/')) target.pathname = visit + target.pathname;
    target.searchParams.set('lang', language);
    return target.href;
  }
  function apply(root) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n, el.dataset);
    });
    // Rich entries only contain authored markup from the bundled catalogs.
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    for (const attr of ['aria-label', 'placeholder', 'alt', 'title']) {
      root.querySelectorAll('[data-i18n-' + attr + ']').forEach(el => {
        el.setAttribute(attr, t(el.getAttribute('data-i18n-' + attr)));
      });
    }
    root.querySelectorAll('[data-background-page]').forEach(frame => {
      frame.src = url(frame.dataset.backgroundPage);
    });
    root.querySelectorAll('[data-lang]').forEach(link => {
      link.href = url(location.href, link.dataset.lang);
      if (link.dataset.lang === lang) link.setAttribute('aria-current', 'true');
    });
  }
  window.t = t;
  window.i18n = {lang, url, apply, visit};
})();
