// The display canvas is also the print master. Placed stamps use its logical coordinates.
(() => {
  i18n.apply(document);
  const el = id => document.getElementById(id);
  const scene = el('scene'), paper = el('paper'), card = el('card');
  const width = 520, height = 328, sealSize = 89;
  const ink = '#292921';
  const marks = new Image();
  marks.src = 'assets/pass/marks.svg';
  const seals = [
    {key:'notes', tile:1, words:['hummed','a song'], angle:-8},
    {key:'palette', tile:4, words:['drew','something'], angle:6},
    {key:'heart', tile:5, words:['fell for','someone'], angle:-4},
    {key:'cloud', tile:6, words:['stared at','clouds'], angle:10},
    {key:'mug', tile:7, words:['let coffee','go cold'], angle:-12}
  ];
  const impressions = [];
  let selected = null;
  let passNumber, signature = '';

  function mark(ctx, tile, x, y, size) {
    const unit = marks.naturalHeight;
    ctx.drawImage(marks, tile * unit, 0, unit, unit, x, y, size, size);
  }
  function lettering(ctx, words, size, x, y, family = 'px PassHand, cursive') {
    ctx.font = size + family;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = size < 20 ? .32 : .24;
    ctx.strokeText(words, x, y);
    ctx.fillText(words, x, y);
    ctx.restore();
  }
  function makeSeal(seal) {
    const image = document.createElement('canvas');
    image.width = image.height = 300;
    const ctx = image.getContext('2d');
    ctx.scale(3, 3);
    mark(ctx, 3, 2, 2, 96);
    mark(ctx, seal.tile, 32, 16, 36);
    ctx.textAlign = 'center';
    lettering(ctx, seal.words[0], 14, 50, 63);
    lettering(ctx, seal.words[1], 14, 50, 76);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = seal.key === 'heart' ? '#719444' : ink;
    ctx.fillRect(0, 0, 100, 100);
    return image;
  }
  function drawCard() {
    const ctx = card.getContext('2d');
    ctx.setTransform(card.width / width, 0, 0, card.height / height, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fafaf5';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 15);
    ctx.fill();
    ctx.strokeStyle = '#d3d2c6';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(.8, .8, width-1.6, height-1.6, 15);
    ctx.stroke();
    ctx.fillStyle = ink;
    lettering(ctx, 'HUMAN PASS', 39, 24, 52);
    mark(ctx, 0, 8, 58, 220);
    mark(ctx, 1, 150, 75, 45);
    mark(ctx, 2, 206, 107, 29);
    ctx.save();
    ctx.translate(463, 24);
    ctx.rotate(.16);
    mark(ctx, 2, 0, 0, 29);
    ctx.restore();
    lettering(ctx, 'No.' + passNumber, 32, 296, 144);
    lettering(ctx, 'verified human', 19, 298, 170);
    lettering(ctx, 'Neverland', 19, 298, 193);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(298, 239); ctx.quadraticCurveTo(352, 236, 410, 238.4); ctx.quadraticCurveTo(456, 240, 494, 236.6);
    ctx.stroke();
    ctx.restore();
    if (signature) {
      const family = 'px PassHand, PassHandHan, cursive';
      let size = 27;
      ctx.font = size + family;
      while (size > 13 && ctx.measureText(signature).width > 194) ctx.font = --size + family;
      lettering(ctx, signature, size, 300, 232, family);
    }
    ctx.beginPath();
    ctx.setLineDash([4, 5]);
    ctx.moveTo(23, 266); ctx.lineTo(497, 265); ctx.stroke(); ctx.setLineDash([]);
    const zh = i18n.lang === 'zh';
    lettering(ctx, 'you still need to verify at least once every 24 hours to stay human.', 14, 24, zh ? 290 : 300);
    if (zh) lettering(ctx, '要继续当人类，每 24 小时至少要再验证一次。', 12.5, 24, 310);
    for (const {seal, x, y} of impressions) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(seal.angle * Math.PI / 180);
      ctx.drawImage(seal.image, -sealSize/2, -sealSize/2, sealSize, sealSize);
      ctx.restore();
    }
    preparePNG();
  }

  function select(seal) {
    selected = seal;
    for (const item of seals) item.button.setAttribute('aria-pressed', String(seal === item));
    paper.classList.add('inking');
    paper.setAttribute('aria-label', t('pass.placeLabel', {stamp:t('pass.' + seal.key)}));
  }
  function buildPalette() {
    for (const seal of seals) {
      seal.image = makeSeal(seal);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seal';
      button.title = t('pass.' + seal.key);
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', 'false');
      button.append(seal.image);
      button.addEventListener('click', () => select(seal));
      el('palette').append(button);
      seal.button = button;
    }
  }

  function measureLanding() {
    const sheet = paper.parentElement.getBoundingClientRect();
    const floor = scene.getBoundingClientRect().bottom - Math.max(25, scene.clientHeight * .055);
    const tiltedHalfHeight = .72 * (sheet.height * .995 + sheet.width * .105) / 2;
    const landingY = floor - tiltedHalfHeight;
    paper.style.setProperty('--land', (landingY - sheet.top - sheet.height/2) + 'px');
    scene.style.setProperty('--landing-eye-y', (landingY - scene.getBoundingClientRect().top) + 'px');
  }
  function land() {
    scene.dataset.state = 'landed';
    paper.disabled = false;
  }
  paper.addEventListener('animationend', e => {
    if (e.animationName === 'fall' && scene.dataset.state === 'falling') land();
  });
  paper.addEventListener('click', e => {
    if (scene.dataset.state === 'landed') {
      scene.dataset.state = 'open';
      el('tools').inert = false;
      el('tools').removeAttribute('aria-hidden');
      paper.setAttribute('aria-label', t('pass.label'));
      if (scene.dataset.step === 'name') {
        if (!e.detail || matchMedia('(pointer:fine)').matches) el('name').focus({preventScroll:true});
      } else if (!e.detail) seals[0].button.focus();
      return;
    }
    if (scene.dataset.state !== 'open' || !selected) return;
    const bounds = card.getBoundingClientRect();
    const x = e.detail ? (e.clientX - bounds.left) / bounds.width * width : width/2;
    const y = e.detail ? (e.clientY - bounds.top) / bounds.height * height : height/2;
    const inset = sealSize / 2;
    impressions.push({seal:selected, x:Math.max(inset, Math.min(width-inset, x)), y:Math.max(inset, Math.min(height-inset, y))});
    drawCard();
    el('undo').hidden = false;
  });
  // The nickname is written on the card as it is typed, then kept for the epilogue's visitor list.
  const nameInput = el('name');
  function writeName() {
    signature = nameInput.value.replace(/\s+/g, ' ').trim();
    el('sign').disabled = !signature;
    el('nameError').hidden = true;
    drawCard();
    // Han characters outside the PassHand subset come from a lazily loaded face; redraw once it lands.
    const typed = signature;
    if (typed) document.fonts.load('27px PassHand, PassHandHan', typed).then(() => { if (signature === typed) drawCard(); }, () => {});
  }
  async function keepName(name) {
    const form = el('naming');
    if (form.inert) return;
    form.inert = true;
    try {
      await visitorRequest('name', {name});
      signature = name;
      drawCard();
      scene.dataset.step = 'stamp';
      seals[0].button.focus({preventScroll:true});
    } catch (error) {
      const rejected = error.status === 422;
      el('nameError').textContent = t(rejected ? 'pass.nameRejected' : 'pass.nameError');
      el('nameError').hidden = false;
      if (rejected) nameInput.select();
    } finally {
      form.inert = false;
    }
  }
  nameInput.addEventListener('input', writeName);
  el('naming').addEventListener('submit', e => {
    e.preventDefault();
    if (signature) keepName(signature);
  });
  el('anonymous').onclick = () => {
    nameInput.value = '';
    writeName();
    keepName('');
  };

  el('undo').onclick = () => {
    impressions.pop();
    drawCard();
    el('undo').hidden = !impressions.length;
  };

  // Prepare the PNG while editing so the native share sheet opens within the save tap.
  let png, version = 0;
  function preparePNG() {
    const current = ++version;
    png = null;
    card.toBlob(blob => { if (version === current) png = blob; }, 'image/png');
  }
  function longPressImage() {
    el('savedImage').src = card.toDataURL('image/png');
    el('preview').showModal();
  }
  el('closePreview').onclick = () => el('preview').close();
  el('save').onclick = async () => {
    const name = 'Neverland-Human-Pass-' + passNumber + '.png';
    if (matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0) {
      try {
        if (png && navigator.canShare && navigator.share) {
          const file = new File([png], name, {type:'image/png'});
          if (navigator.canShare({files:[file]})) {
            await navigator.share({files:[file]});
            return;
          }
        }
      } catch (error) { if (error.name === 'AbortError') return; }
      longPressImage();
      return;
    }
    const link = document.createElement('a');
    if (!('download' in link)) return longPressImage();
    link.download = name;
    link.href = card.toDataURL('image/png');
    link.click();
  };

  window.addEventListener('resize', measureLanding);
  Promise.all([visitorRequest(), marks.decode(), document.fonts.load('24px PassHand').catch(() => {})]).then(([visitor]) => {
    if (!visitor.number) { location.replace(i18n.url('start.html')); return; }
    passNumber = visitorDigits(visitor.number);
    nameInput.value = visitor.name || '';
    writeName();
    scene.dataset.step = 'name';
    buildPalette();
    drawCard();
    measureLanding();
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) land();
    else scene.dataset.state = 'falling';
  }).catch(() => {
    const retry = document.createElement('button');
    retry.textContent = t('jury.retry');
    retry.onclick = () => location.reload();
    scene.replaceChildren(retry);
  });
})();
