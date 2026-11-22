// This adapter runs in the same document as the actual Stage 2 bank and renderer.
(() => {
  const preview = frameElement.preview;
  const variant = preview.treatment;
  const langIndex = preview.language === 'zh' ? 0 : 1;
  document.body.dataset.treatment = variant.id;
  $('pre').textContent = variant.pre[langIndex];
  $('post').textContent = variant.post[langIndex];
  const ordered = preview.questions.map(id => BANK.find(question => question.id === id)).filter(Boolean);
  run = ordered.slice(preview.questionIndex).concat(ordered.slice(0,preview.questionIndex));
  load(0);
  preview.color();
  let lastQuestion = q.id;
  new MutationObserver(() => {
    if (q.id !== lastQuestion){
      lastQuestion = q.id;
      preview.color();
    }
  }).observe($('kw'),{childList:true});
  window.flowNext = () => {
    const next = (run.indexOf(q) + 1) % run.length;
    run = run.slice(next).concat(run.slice(0,next));
    passed = [];
    steadyFlags = 0;
    need = 3;
    load(0);
  };
  window.previewReady = true;
})();
