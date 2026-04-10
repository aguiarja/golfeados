// ══════════════════════════════════════════════════════
// GOLFEADOS — Utilities (Storage, Updates, Seed)
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// STORAGE — Subir fotos
// ══════════════════════════════════════════════════════
async function uploadPhoto(file, path, progressBarId=null){
  return new Promise((resolve,reject)=>{
    const ref=storage.ref(path);
    const task=ref.put(file);
    task.on('state_changed',
      snap=>{
        if(progressBarId){
          const pct=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
          const bar=document.getElementById(progressBarId);
          if(bar){bar.parentElement.style.display='block';bar.style.width=pct+'%';}
        }
      },
      err=>reject(err),
      async ()=>{
        const url=await task.snapshot.ref.getDownloadURL();
        if(progressBarId){
          const bar=document.getElementById(progressBarId);
          if(bar){bar.parentElement.style.display='none';bar.style.width='0%';}
        }
        resolve(url);
      }
    );
  });
}

function resizeAndCompress(file, maxW=800, quality=0.82){
  return new Promise(resolve=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      const ratio=Math.min(1,maxW/img.width);
      const canvas=document.createElement('canvas');
      canvas.width=img.width*ratio; canvas.height=img.height*ratio;
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      canvas.toBlob(b=>{ URL.revokeObjectURL(url); resolve(new File([b],file.name,{type:'image/jpeg'})); },'image/jpeg',quality);
    };
    img.src=url;
  });
}

function previewPhoto(input, imgId, fallbackId=null){
  const file=input.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=document.getElementById(imgId);
    if(img){img.src=e.target.result;img.style.display='block';}
    if(fallbackId){const fb=document.getElementById(fallbackId);if(fb)fb.style.display='none';}
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════════════════════════
// ACTUALIZACIONES AUTOMÁTICAS — iOS compatible
// iOS ignora reload(true), usamos navegación con cache-bust
// ══════════════════════════════════════════════════════
function initUpdateChecker(){
  // Si llegamos con ?bust= en la URL, limpiar y guardar versión
  const url=new URL(window.location.href);
  if(url.searchParams.get('bust')){
    localStorage.setItem('golfeados_version', APP_VERSION);
    localStorage.setItem('golfeados_dismissed_ver', APP_VERSION);
    document.getElementById('updateBanner').style.display='none';
    url.searchParams.delete('bust');
    window.history.replaceState(null,'',url.toString());
  }
  // Also hide banner immediately if current version was dismissed
  const alreadyDismissed=localStorage.getItem('golfeados_dismissed_ver');
  if(alreadyDismissed===APP_VERSION){
    document.getElementById('updateBanner').style.display='none';
  }

  // Si la versión guardada no coincide → navegar con cache-bust (recarga real en iOS)
  const stored=localStorage.getItem('golfeados_version');
  if(stored && stored !== APP_VERSION){
    localStorage.setItem('golfeados_version', APP_VERSION);
    doHardReload();
    return;
  }
  localStorage.setItem('golfeados_version', APP_VERSION);

  // Chequeo periódico: descarga el HTML y compara versión
  async function checkForUpdate(){
    try{
      // Also trigger SW update check
      if('serviceWorker' in navigator){
        const reg=await navigator.serviceWorker.getRegistration();
        if(reg) reg.update().catch(()=>{});
      }
      const res=await fetch(window.location.pathname+'?nc='+Date.now(),{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}
      });
      const text=await res.text();
      const match=text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if(match && match[1] && match[1] !== APP_VERSION){
        showUpdateBanner(match[1]);
      }
    }catch(e){ /* sin conexión, silencioso */ }
  }

  // Chequear 4s después de entrar, luego cada 3 minutos
  setTimeout(checkForUpdate, 4000);
  setInterval(checkForUpdate, 3*60*1000);

  // Chequear al volver de segundo plano (iOS PWA)
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') setTimeout(checkForUpdate,1500);
  });

  // Chequear al recuperar conexión
  window.addEventListener('online', ()=>setTimeout(checkForUpdate,2000));
}

function showUpdateBanner(newVer){
  const banner=document.getElementById('updateBanner');
  const sub=banner.querySelector('div div:last-child');
  if(sub) sub.textContent='Versión '+newVer+' disponible — toca para instalar';
  banner.style.display='flex';
}

function doHardReload(){
  // iOS-compatible: navegar a la misma URL con parámetro nuevo (bypassa caché)
  const url=new URL(window.location.href);
  url.searchParams.set('bust', Date.now());
  window.location.replace(url.toString());
}

function forceUpdate(){
  localStorage.setItem('golfeados_dismissed_ver', APP_VERSION);

  // 1) Clear all caches
  if('caches' in window){
    caches.keys().then(names=>names.forEach(n=>caches.delete(n)));
  }

  // 2) Force SW to update (or unregister + re-register)
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(regs=>{
      const promises=regs.map(reg=>{
        // Try to update first
        return reg.update().catch(()=>{
          // If update fails, unregister entirely
          return reg.unregister();
        });
      });
      Promise.all(promises).then(()=>{
        setTimeout(doHardReload, 500);
      });
    }).catch(()=> doHardReload());
  } else {
    doHardReload();
  }
}

// ══════════════════════════════════════════════════════
// SEED
// ══════════════════════════════════════════════════════
async function seedDatos(){
  const msg=document.getElementById('seedMsg');
  msg.style.display='block'; msg.textContent='⏳ Cargando datos iniciales...';
  try{
    const batch=db.batch();
    batch.set(db.collection('torneos').doc('apertura2026'),{nombre:'Torneo Apertura 2026',estado:'Activo',jornadas_total:8,temporada:'2026',creado:firebase.firestore.FieldValue.serverTimestamp()});
    [
      {id:'badell',nombre:'Daniel Badell',alias:'Badell',foto:'DB'},
      {id:'jimeno',nombre:'Javi Jimeno',alias:'Jimeno',foto:'JJ'},
      {id:'padron',nombre:'Loor Padrón',alias:'Loor',foto:'LP'},
      {id:'kolman',nombre:'Juan Kolman',alias:'Kolman',foto:'JK'},
      {id:'aguiar',nombre:'Jesús Aguiar',alias:'J. Aguiar',foto:'JA'},
      {id:'soto',nombre:'Mauricio Soto',alias:'Soto',foto:'MS'},
      {id:'aguiar_r',nombre:'Jesús Aguiar Romero',alias:'Aguiar R.',foto:'JR'},
    ].forEach(j=>{const{id,...d}=j;batch.set(db.collection('jugadores').doc(id),{...d,creado:firebase.firestore.FieldValue.serverTimestamp()});});
    await batch.commit();
    const clubesSeed=[
      {nombre:'Izcaragua Country Club',ciudad:'Caracas'},
      {nombre:'Junko Golf Club',ciudad:'Caracas'},
      {nombre:'Lagunita Country Club',ciudad:'Caracas'},
      {nombre:'Valle Arriba Golf Club',ciudad:'Caracas'},
      {nombre:'Guataparo Country Club',ciudad:'Valencia'},
    ];
    for(const c of clubesSeed){
      await db.collection('clubes').add({...c,creado:firebase.firestore.FieldValue.serverTimestamp()});
    }
    msg.textContent='✅ ¡Datos cargados! Jugadores, partidas y clubes creados.';
  }catch(e){ msg.style.color='var(--red)'; msg.textContent='❌ Error: '+e.message; }
}

// ── Register static button handlers ─────────────────
// Button is in static HTML above this script, so it already exists in DOM
(function(){
  const btnCrear=document.getElementById('btnCrearJugador');
  if(btnCrear){
    let _crearRunning=false;
    btnCrear.addEventListener('click', async function(e){
      e.preventDefault();
      e.stopPropagation();
      if(_crearRunning) return;
      _crearRunning=true;
      btnCrear.textContent='Creando...';
      btnCrear.disabled=true;
      try{
        await crearYAgregarJugador();
      }finally{
        _crearRunning=false;
        btnCrear.textContent='Crear y agregar al torneo 🏌️';
        btnCrear.disabled=false;
      }
    });
    console.log('[init] btnCrearJugador listener OK');
  } else {
    console.error('[init] btnCrearJugador NOT FOUND');
  }
})();
