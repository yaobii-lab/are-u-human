// Shared navigation for the verification flow.
(function(){
  var ORDER=['index.html','start.html','face.html','stage2.html','stage3.html','certified.html','pass.html','forum.html','credits.html'];
  var portal = location.hostname === 'portal.ariari.art';
  var deployed = portal || location.hostname === 'ariari.art';
  // Portal and forum live on different hosts. Keep the camera choice scoped to this visit.
  function cameraCookie(){ return window.i18n.visit ? 'neverland-visit-camera' : 'neverland-camera'; }
  window.flowCamera = {
    choose(choice){
      const scope = deployed ? '; Domain=ariari.art; Secure' : '';
      document.cookie = cameraCookie() + '=' + choice + '; Path=' + window.i18n.visit + '/; SameSite=Lax' + scope;
    },
    choice(){
      const key = cameraCookie() + '=';
      return document.cookie.split('; ').find(cookie => cookie.startsWith(key))?.slice(key.length);
    }
  };
  function route(page){
    if(!deployed) return page;
    if(page === 'index.html') return 'https://ariari.art/';
    if(page === 'forum.html') return 'https://ariari.art/forum.html';
    return 'https://portal.ariari.art/' + (page === 'start.html' ? '' : page);
  }
  function destination(page){
    const path = route(page);
    return window.i18n ? i18n.url(path) : path;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let wash, leaving = false;
  function sheet() {
    wash = document.createElement('div');
    wash.className = 'gate-wash';
    wash.setAttribute('aria-hidden', 'true');
    document.documentElement.append(wash);
    return wash;
  }
  function clearWash() {
    if (wash) wash.remove();
    wash = null;
    leaving = false;
  }
  if (location.hash === '#gate-wash') {
    history.replaceState(history.state, '', location.pathname + location.search);
    if (!reduced.matches && Element.prototype.animate) {
      const cover = sheet();
      document.addEventListener('DOMContentLoaded', () => {
        cover.animate([{transform:'translateY(0)'}, {transform:'translateY(-101%)'}],
          {duration:370, easing:'cubic-bezier(.5,0,.25,1)', fill:'forwards'}).finished
          .then(() => { if (wash === cover) clearWash(); });
      });
    }
  }
  async function navigate(url, {useWash = true, status, ready} = {}) {
    if (leaving) return;
    clearWash();
    leaving = true;
    const animate = useWash && !reduced.matches && !!Element.prototype.animate;
    const target = new URL(url, location.href);
    if (!animate && !status) {
      location.assign(target.href);
      return;
    }
    const cover = sheet();
    if (status) {
      cover.removeAttribute('aria-hidden');
      const message = document.createElement('span');
      message.className = 'gate-wash-status';
      message.setAttribute('role', 'status');
      cover.append(message);
      message.textContent = t(status);
    }
    const entrance = animate && cover.animate(
      [{transform:'translateY(101%)'}, {transform:'translateY(0)'}],
      {duration:320, easing:'cubic-bezier(.45,0,.2,1)', fill:'forwards'}
    ).finished;
    try {
      // Processing and the visible pause start together, even on a slow connection.
      await Promise.all([entrance, ready?.(), status && new Promise(resolve => setTimeout(resolve, 3500))]);
      if (animate) target.hash = 'gate-wash';
      location.assign(target.href);
    } catch (error) {
      clearWash();
      throw error;
    }
  }
  addEventListener('pageshow', event => { if (event.persisted) clearWash(); });
  document.addEventListener('DOMContentLoaded', () => {
    const entry = document.querySelector('a.verify');
    if (!entry) return;
    entry.href = destination('start.html');
    entry.addEventListener('click', event => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(entry.href);
    });
  });
  function here(){
    var p=location.pathname.split('/').pop()||(portal?'start.html':'index.html');
    var q=new URLSearchParams(location.search).get('s');
    return q?p+'?s='+q:p;
  }
  function idx(){var i=ORDER.indexOf(here());return i<0?0:i;}
  const processing = {
    'start.html': 'flow.connecting',
    'stage3.html': 'flow.processing'
  };
  window.flowNext = function({ready} = {}) {
    const next = ORDER[idx() + 1];
    if (next) return navigate(destination(next), {
      useWash: next !== 'credits.html',
      status: processing[here()],
      ready
    });
  };
  window.flowPrev = function() {
    const previous = ORDER[idx() - 1];
    if (previous) return navigate(destination(previous), {useWash: here() !== 'credits.html'});
  };
})();
