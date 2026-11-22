// Use the game's catalog without changing the language of the visitor's actual game.
(() => {
  const lang = frameElement.preview.language;
  const messages = window.neverlandMessages[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  window.t = (key, params = {}) => messages[key].replace(/\{(\w+)\}/g,(_,name) => params[name]);
  window.i18n = {lang, apply(root){
    root.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n,el.dataset));
    root.querySelectorAll('[data-i18n-aria-label]').forEach(el => el.setAttribute('aria-label',t(el.dataset.i18nAriaLabel)));
  }};
})();
