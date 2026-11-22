// Motion reference: Jérémy Perret's bloub (MIT), src/bot/face.ts and src/ui/gaze.ts.
// Gate uses original CSS capsules and poses. Gaze, lid and expression move independently.
(() => {
  const script = document.currentScript;
  const scene = script.dataset.scene;
  const mount = document.querySelector(script.dataset.mount || 'body');
  const style = document.createElement('style');
  style.textContent = `
    body:has(>.gate-eyes){isolation:isolate}
    .gate-eyes{position:fixed;inset:0;z-index:-1;pointer-events:none;user-select:none;
      --eye-color:var(--brand-600,#2c6378);--eye-alpha:.30;--eye-unit:1px;
      --eyes-x:50%;--eyes-y:8%;--ease-eye:cubic-bezier(.12,.73,.18,1)}
    .gate-eyes[data-scene=start]{--eyes-y:12%}
    .gate-eyes[data-scene=face]{--eyes-x:calc(50% + min(37vw,155px));--eyes-y:38px}
    .gate-eyes[data-scene=stage2]{--eyes-y:clamp(62px,14vh,110px)}
    @media(max-height:650px){.gate-eyes[data-scene=stage2]{--eyes-y:37px}}
    .gate-eyes[data-scene=jury]{--eyes-x:82%;--eyes-y:26px}
    .gate-eyes[data-scene=pass]{--eyes-y:20%}
    .gate-anchor{position:absolute;left:var(--eyes-x);top:var(--eyes-y);width:0;height:0;font-size:var(--eye-unit)}
    .gate-gaze,.gate-pose,.gate-lids{display:flex;align-items:center;justify-content:center}
    .gate-gaze{position:absolute;width:64em;height:48em;left:-32em;top:-24em;
      color:var(--eye-color);opacity:var(--eye-alpha);
      transform:translate(var(--dx,0px),var(--dy,0px));transition:transform .32s var(--ease-eye),opacity .55s,color .55s}
    .gate-lids{gap:18em;transform:scaleY(var(--audio-lid,1));transition:transform .12s linear}
    .gate-pose{transform:rotate(var(--roll,0deg)) scale(var(--near,1));transition:transform .45s var(--ease-eye)}
    .gate-lids i{display:block;background:currentColor;width:var(--width,9em);height:var(--left,28em);border-radius:8em;transition:height .38s var(--ease-eye),width .38s var(--ease-eye)}
    .gate-lids i+i{height:var(--right,28em)}
    .gate-eyes[data-state=scrutinize]{--near:1.16;--left:21em;--right:21em}
    .gate-eyes[data-state=doubt]{--left:28em;--right:15em;--roll:-5deg}
    .gate-eyes[data-state=cold]{--left:7em;--right:7em;--width:12em}
    .gate-eyes[data-state=pass]{--left:24em;--right:24em}
    .v-orb .presence .gate-eyes,.gate-eyes[data-scene=lab]{position:absolute;inset:0;z-index:0}
    .v-orb .presence .gate-eyes{--eye-alpha:1;--eye-color:white;--eye-unit:1.37px;--eyes-y:clamp(122px,24dvh,230px)}
    .gate-eyes[data-scene=lab]{--eyes-y:50%;--eye-unit:2px;--eye-alpha:.72}
    .gate-eyes[data-scene=lab][data-state=surfaced]{--eye-alpha:1;--eye-color:white}
    .v-call .gate-eyes[data-scene=voice]{--eyes-x:calc(50% + min(35vw,140px));--eye-color:var(--brand-200);--eyes-y:68px}
    .v-form .gate-eyes[data-scene=voice]{--eyes-x:77%;--eyes-y:55px}
    .gate-eyes[data-scene=voice] .gate-anchor{animation:gate-rise 1.35s var(--ease-eye) both}
    @keyframes gate-rise{from{transform:translateY(14vh);opacity:.18}to{transform:none;opacity:1}}
    @media(prefers-reduced-motion:reduce){.gate-eyes *{animation:none!important;transition:none!important}}
  `;
  document.head.append(style);
  const layer = document.createElement('div');
  layer.className = 'gate-eyes';
  layer.dataset.scene = scene;
  layer.setAttribute('aria-hidden','true');
  layer.innerHTML = '<div class="gate-anchor"><div class="gate-gaze"><div class="gate-pose"><div class="gate-lids"><i></i><i></i></div></div></div></div>';
  mount.prepend(layer);
  const gaze = layer.querySelector('.gate-gaze');
  const lids = layer.querySelector('.gate-lids');
  const states = ['watch','scrutinize','doubt','cold','pass','surfaced'];
  const getForced = () => new URLSearchParams(location.search).get('eyes');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  let target = [0,0], heldUntil = 0, faceUntil = 0, release, blink;
  function move(x,y){
    if(reduced.matches)return;
    gaze.style.setProperty('--dx',x+'px');
    gaze.style.setProperty('--dy',y+'px');
  }
  function track(x,y,source){
    const now=performance.now();
    if(source==='face')faceUntil=now+400;
    else if(now<faceUntil)return;
    const clamp=n=>Math.max(-1,Math.min(1,n));
    target=[clamp(x)*12,clamp(y)*7];
    if(now>=heldUntil)move(...target);
  }
  function glance(x,y,ms){
    clearTimeout(release);
    heldUntil=performance.now()+ms;
    move(x,y);
    release=setTimeout(()=>move(...target),ms);
  }
  function lookAt(el){
    if(!el || reduced.matches)return;
    const rect=el.getBoundingClientRect(),origin=layer.querySelector('.gate-anchor').getBoundingClientRect();
    const dx=rect.left+rect.width/2-origin.x,dy=rect.top+rect.height/2-origin.y;
    const len=Math.max(1,Math.hypot(dx,dy));
    glance(dx/len*14,dy/len*9,1150);
  }
  function closeLids(ms){
    if(reduced.matches)return;
    blink?.cancel();
    blink=lids.animate([{transform:'scaleY(1)'},{transform:'scaleY(.13)',offset:.38},
      {transform:'scaleY(.13)',offset:.52},{transform:'scaleY(1)'}],{duration:ms,easing:'ease-in-out'});
  }
  function set(requested){
    const forced=getForced();
    const state=states.includes(forced)?forced:requested;
    if(!states.includes(state))return;
    clearTimeout(release);heldUntil=0;
    layer.dataset.state=state; move(...target);
    if(state==='doubt')glance(10,6,1050);
    if(state==='cold')glance(-13,2,1450);
    if(state==='pass'){closeLids(640);heldUntil=Infinity;move(12,-3);}
  }
  function level(db){
    const strength=Number.isFinite(db)?Math.max(0,Math.min(1,(db+60)/42)):0;
    lids.style.setProperty('--audio-lid',reduced.matches?1:1-.14*strength);
  }
  document.addEventListener('pointermove',e=>track(2*e.clientX/innerWidth-1,2*e.clientY/innerHeight-1),{passive:true});
  let cycle=0;
  setInterval(()=>{
    if(document.hidden||reduced.matches||performance.now()<heldUntil)return;
    closeLids(400);
    if(++cycle%2===0)glance(target[0]+4,target[1]-2,950);
  },7100);
  reduced.addEventListener('change',()=>{if(reduced.matches){blink?.cancel();gaze.style.removeProperty('--dx');gaze.style.removeProperty('--dy');level(-90);}});
  window.Eyes={set,lookAt,track,level};
  set(script.dataset.initial||'watch');
})();
