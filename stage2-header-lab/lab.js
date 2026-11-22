const treatments = [
  {id:'copy', name:'复写层', caption:'像每个人都在同一叠复写纸上落笔。',
    pre:['凭第一眼，点一张图','Pick one at first glance.'],
    post:['同一张纸，容得下不同的答案。','Different answers fit on the same sheet.'],
    colors:[['#F6FF85','#1A1D0E','#54573C'],['#E6F0FA','#153285','#415B9C'],['#FDE7EA','#781D2A','#924553']]},
  {id:'protocol', name:'网管规约', caption:'Neverland 把每个人的直觉都当成一份申报。',
    pre:['请选择一张图片','Select one image.'],
    post:['本站允许你与多数人意见不同。','Site policy permits a difference of opinion.'],
    colors:[['#BB262B','#FFFFFF','#FFF2EE'],['#F59F00','#141517','#413A29'],['#0B5CAB','#FFFFFF','#E0F4FF']]},
  {id:'desk', name:'桌角交接', caption:'一张虚构的便签，来自上一位坐在这里的人。',
    pre:['挑一张你觉得像的','Pick the one that feels right.'],
    post:['换你啦。我刚也想了好久。','Your turn. I took a while, too.'],
    colors:[['#0B132B','#E0E6ED','#ABBBCE'],['#0E2425','#E4F1EA','#A4C2BD'],['#36223D','#FAEFFF','#D4B6D9']]}
];
const questions = ['A2','B11','A3','B10','A6','B7','A4','B9','A5','B8','A1'];
const params = new URLSearchParams(location.search);
const language = params.get('lang') === 'en' ? 'en' : 'zh';
const panels = document.getElementById('panels');
const view = document.getElementById('view');
const statusText = document.getElementById('status');
const colorButton = document.getElementById('color');
const questionButton = document.getElementById('question');
let questionIndex = 0;
let revision = 0;
const previews = [];

// The first color is random as well. Every change draws from the remaining pairs.
function changeColor(preview){
  const available = preview.treatment.colors.filter(pair => pair !== preview.palette);
  preview.palette = available[Math.floor(Math.random() * available.length)];
  const root = preview.frame?.contentDocument?.body;
  if (!root) return;
  ['--paper','--ink-main','--ink-note'].forEach((name,i) => root.style.setProperty(name,preview.palette[i]));
}
function chooseView(){
  panels.classList.toggle('single',view.value !== 'all');
  for (const preview of previews) preview.panel.hidden = view.value !== 'all' && view.value !== preview.treatment.id;
}
function showQuestion(){
  revision++;
  const currentRevision = revision;
  let ready = 0;
  statusText.hidden = false;
  statusText.textContent = '正在打开题面…';
  colorButton.disabled = questionButton.disabled = true;
  for (const preview of previews){
    const frame = document.createElement('iframe');
    frame.title = preview.treatment.name + ' · 可操作题面';
    const absolute = name => new URL(name,location.href).href;
    const doc = source.cloneNode(true);
    doc.querySelector('.band').classList.remove('desk-note');
    const base = doc.createElement('base');
    base.href = absolute('../');
    doc.head.prepend(base);
    for (const external of doc.querySelectorAll('link[href^="https://fonts."]')) external.remove();
    const langScript = doc.querySelector('script[src="i18n.js"]');
    langScript.src = absolute('language.js');
    const style = doc.createElement('link');
    style.rel = 'stylesheet';
    style.href = absolute('frame.css');
    doc.head.append(style);
    // Prevent routing out of a review specimen. All game controls still run locally.
    doc.querySelector('script[src="flow.js"]').remove();
    const adapter = doc.createElement('script');
    adapter.src = absolute('frame.js');
    doc.body.append(adapter);
    frame.preview = {
      language, treatment:preview.treatment, questions, questionIndex,
      color:() => changeColor(preview),
    };
    frame.addEventListener('load',() => {
      if (currentRevision !== revision) return;
      if (!frame.contentWindow.previewReady) {
        statusText.textContent = '题面未能加载，请刷新此页。';
        return;
      }
      if (++ready === previews.length){
        statusText.hidden = true;
        colorButton.disabled = questionButton.disabled = false;
      }
    },{once:true});
    frame.srcdoc = '<!doctype html>' + doc.documentElement.outerHTML;
    preview.frame?.remove();
    preview.frame = frame;
    preview.panel.append(frame);
  }
}
function nextQuestion(){
  questionIndex = (questionIndex + 1) % questions.length;
  showQuestion();
}
for (const treatment of treatments) {
  const panel = document.createElement('article');
  const title = document.createElement('h2'), caption = document.createElement('p');
  title.textContent = treatment.name;
  caption.textContent = treatment.caption;
  panel.append(title,caption);
  panels.append(panel);
  previews.push({treatment,panel});
}
const initial = treatments.find(t => t.id === params.get('view'));
view.value = initial?.id || (matchMedia('(max-width:940px)').matches ? 'copy' : 'all');
chooseView();
view.addEventListener('change', chooseView);
colorButton.addEventListener('click',() => previews.forEach(changeColor));
questionButton.addEventListener('click',nextQuestion);
let source;
(async () => {
  try{
    const response = await fetch('../stage2.html');
    if (!response.ok) throw Error(response.statusText);
    source = new DOMParser().parseFromString(await response.text(),'text/html');
    showQuestion();
  } catch {
    statusText.textContent = '无法打开 Stage 2，请刷新此页重试。';
  }
})();
