// The portal's IndexedDB serializes first use across tabs, even before a pass cookie exists.
function visitorBrowserKey() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('neverland-admission', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('browser');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('browser', 'readwrite');
      const store = tx.objectStore('browser');
      const read = store.get('key');
      let key;
      read.onsuccess = () => {
        key = read.result;
        if (!key) {
          key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
          store.put(key, 'key');
        }
      };
      tx.oncomplete = () => { db.close(); resolve(key); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}
async function visitorRequest(action, payload) {
  const options = {cache: 'no-store'};
  if (action) {
    options.method = 'POST';
    options.headers = {'Content-Type': 'application/json'};
    options.body = JSON.stringify(i18n.visit ? payload : {...payload, browser: await visitorBrowserKey()});
  }
  const response = await fetch(i18n.visit + '/api/visitor' + (action ? '/' + action : ''), options);
  if (!response.ok) throw Object.assign(new Error('Visitor service unavailable'), {status: response.status});
  return response.json();
}
function visitorDigits(number) {
  return Number.isSafeInteger(number) && number > 0 ? String(number).padStart(6, '0') : '------';
}
async function paintVisitor() {
  const counter = document.getElementById('counter');
  if (!counter && !document.querySelector('[data-pass-number]')) return;
  const {number, verified} = await visitorRequest().catch(() => ({number: null}));
  const digits = visitorDigits(number);
  if (counter) {
    counter.replaceChildren(...Array.from(digits, digit => {
      const tile = document.createElement('b');
      tile.textContent = digit;
      return tile;
    }));
  }
  const gate = document.querySelector('.gate a.verify');
  if (gate) {
    const destination = verified ? 'forum.html' : location.hostname === 'ariari.art' ? 'https://portal.ariari.art/' : 'start.html';
    gate.href = i18n.url(destination);
    gate.textContent = t(verified ? 'index.enter' : 'index.verify');
    document.querySelector('.gate .warn span').textContent = t(verified ? 'index.verified' : 'index.warning');
    const cue = document.querySelector('.verify-cue');
    if (cue) cue.textContent = t(verified ? 'index.enter' : 'index.verifyBelow');
  }
  const welcome = document.querySelector('[data-visitor-welcome]');
  if (welcome) {
    welcome.innerHTML = t('forum.welcome', {n: digits});
    document.getElementById('wbody').textContent = t('forum.wBody', {n: digits});
  }
  const pass = document.querySelector('[data-pass-number]');
  if (pass) pass.textContent = 'No.' + digits;
}
addEventListener('pageshow', paintVisitor);
document.addEventListener('visibilitychange', () => { if (!document.hidden) paintVisitor(); });
