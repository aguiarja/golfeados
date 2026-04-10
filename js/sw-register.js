// ══════════════════════════════════════════════════════
// GOLFEADOS — Service Worker Registration
// ══════════════════════════════════════════════════════

// ── Service Worker Registration with iOS-aggressive update ──
if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try{
      const reg=await navigator.serviceWorker.register('/golfeados/sw.js');
      console.log('[SW] Registered:', reg.scope);

      // Check for updates immediately and on each focus
      reg.update().catch(()=>{});
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible') reg.update().catch(()=>{});
      });

      // When new SW found → force it to activate immediately
      reg.addEventListener('updatefound', ()=>{
        const newSW=reg.installing;
        if(!newSW) return;
        console.log('[SW] New version found, installing...');
        newSW.addEventListener('statechange', ()=>{
          if(newSW.state==='installed' && navigator.serviceWorker.controller){
            console.log('[SW] New SW installed, sending skipWaiting');
            newSW.postMessage('skipWaiting');
          }
        });
      });

      // When new SW takes control → reload page to get fresh content
      let refreshing=false;
      navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        if(refreshing) return;
        refreshing=true;
        console.log('[SW] Controller changed, reloading...');
        window.location.reload();
      });

    }catch(err){
      console.log('[SW] Registration error:', err);
    }
  });
}
