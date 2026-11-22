// Shared navigation for the verification flow.
(function(){
  var ORDER=['index.html','start.html','face.html','stage2.html','stage3.html','jury.html','pass.html','forum.html','credits.html'];
  var portal = location.hostname === 'portal.ariari.art';
  var deployed = portal || location.hostname === 'ariari.art';
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
  const entry = document.querySelector('a.verify');
  if (entry) entry.href = destination('start.html');
  function here(){
    var p=location.pathname.split('/').pop()||(portal?'start.html':'index.html');
    var q=new URLSearchParams(location.search).get('s');
    return q?p+'?s='+q:p;
  }
  function idx(){var i=ORDER.indexOf(here());return i<0?0:i;}
  window.flowNext=function(){var i=idx();if(i<ORDER.length-1)location.href=destination(ORDER[i+1]);};
  window.flowPrev=function(){var i=idx();if(i>0)location.href=destination(ORDER[i-1]);};
})();
