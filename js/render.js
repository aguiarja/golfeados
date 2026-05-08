// ══════════════════════════════════════════════════════
// GOLFEADOS — Rendering (Dashboard, Ranking, Jornadas)
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// MONITOR DE CONEXIÓN EN TIEMPO REAL
// ══════════════════════════════════════════════════════
function initConnectionMonitor(){
  // Firestore network state via .info/connected (uses Realtime DB trick via Firestore itself)
  // We use a heartbeat approach: check if snapshots arrive within expected time
  let lastUpdate=Date.now();
  let connTimer=null;
  const dot=document.getElementById('connDot');

  function setOnline(){
    lastUpdate=Date.now();
    if(dot){ dot.style.background='#4CAF50'; dot.style.animation=''; }
  }
  function setOffline(){
    if(dot){ dot.style.background='#FFC107'; dot.style.animation='pulse-dot 1s infinite'; }
  }
  function setSyncing(){
    if(dot){ dot.style.background='#2196F3'; dot.style.animation='pulse-dot 0.8s infinite'; }
    setTimeout(setOnline,1500);
  }

  // Patch initListeners to call setSyncing on each snapshot
  const _origInit=initListeners;

  // Monitor: if no update in 15s, show reconnecting
  function heartbeat(){
    const elapsed=Date.now()-lastUpdate;
    if(elapsed>15000) setOffline();
    else setOnline();
  }
  connTimer=setInterval(heartbeat,5000);

  // Listen to window online/offline events
  window.addEventListener('online',()=>{
    setSyncing();
    // Re-init listeners on reconnect
    initListeners();
  });
  window.addEventListener('offline',setOffline);

  // Firestore automatically reconnects — track with a lightweight doc listener
  // Use user's own profile doc (always has permission) instead of broad torneos query
  if(STATE.user?.uid){
    db.collection('users').doc(STATE.user.uid).onSnapshot(
      ()=>{ lastUpdate=Date.now(); },
      ()=>{ setOffline(); }
    );
  }

  // Expose setOnline so snapshot callbacks can call it
  STATE._connSetOnline=setOnline;
  STATE._connSetSyncing=setSyncing;
}

// CSS for pulsing dot
(function(){
  const s=document.createElement('style');
  s.textContent='@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.8);}}';
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════
// NAVEGACIÓN
// ══════════════════════════════════════════════════════
function goTab(tab){
  STATE.currentTab=tab; STATE.cargarJornadaId=null;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('[data-tab="'+tab+'"]')?.classList.add('active');
  // For jugadores sub-view, highlight Mis Torneos tab
  if(tab==='jugadores') document.querySelector('[data-tab="mistorneos"]')?.classList.add('active');
  ['dashboard','mistorneos','jornadas','jugadores','wallet','clubes','admin-wallet','admin-users','cargar','creartorneo'].forEach(t=>{
    const el=document.getElementById('tab-'+t); if(el) el.style.display='none';
  });
  if(tab==='creartorneo'){ const ct=document.getElementById('tab-creartorneo'); if(ct) ct.dataset.ready=''; }
  const tEl=document.getElementById('tab-'+tab); if(tEl) tEl.style.display='block';
  renderCurrentTab();
}
function goCargar(jornadaId){
  STATE.cargarJornadaId=jornadaId; STATE.currentTab='cargar';
  STATE._jornadaFotosExistentes=[];
  STATE._jornadaFotoFiles=[null,null,null];  // store File objects here
  cargarParticipantes=[]; cargarPosiciones=[]; cargarStep=1;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  ['dashboard','mistorneos','jornadas','jugadores','wallet','clubes','admin-wallet','admin-users','cargar','creartorneo'].forEach(t=>{
    const el=document.getElementById('tab-'+t); if(el) el.style.display='none';
  });
  const ct=document.getElementById('tab-cargar');
  if(ct) ct.style.display='block';
  renderCargar();
}
let _renderRAF=null;
function renderCurrentTab(){
  if(_renderRAF) cancelAnimationFrame(_renderRAF);
  _renderRAF=requestAnimationFrame(()=>{
    _renderRAF=null;
    // Always update header pelotas counter regardless of active tab
    if(typeof updateHeaderPelotas==='function') updateHeaderPelotas(STATE.wallet?.balance||0);
    if(STATE.currentTab==='dashboard') renderDashboard();
    else if(STATE.currentTab==='mistorneos') renderMisTorneos();
    else if(STATE.currentTab==='jornadas') renderJornadas();
    else if(STATE.currentTab==='jugadores') renderJugadores();
    else if(STATE.currentTab==='wallet') renderWallet();
    else if(STATE.currentTab==='clubes') renderClubes();
    else if(STATE.currentTab==='admin-wallet') renderAdminWallet();
    else if(STATE.currentTab==='admin-users') renderAdminUsers();
    else if(STATE.currentTab==='cargar') renderCargar();
    else if(STATE.currentTab==='creartorneo') renderCrearTorneo();
  });
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

// Reglas por defecto del torneo
// ── Permission helpers ───────────────────────────────
function isTorneoAdmin(torneo){
  if(!torneo||!STATE.user) return false;
  if(STATE.profile?.role==='admin') return true; // plataforma admin
  const uid=STATE.user.uid;
  return torneo.creado_por===uid || torneo.adminId===uid ||
         (torneo.admins||[]).includes(uid);
}
function isCargador(torneo){
  if(!torneo||!STATE.user) return false;
  if(isTorneoAdmin(torneo)) return true;
  return (torneo.cargadores||[]).includes(STATE.user.uid);
}
function isCargadorTorneo(torneo){ return isCargador(torneo); }
function canCargarTorneo(torneo){ return isCargador(torneo); }
// ─── JUGADOR LOOKUP — busca en todos los torneos cargados ─────
function getJugador(jugadorId){
  if(!jugadorId) return null;
  // Search active torneo first (fastest)
  const fromActive=(STATE.jugadores||[]).find(j=>j.id===jugadorId);
  if(fromActive) return fromActive;
  // Search all torneos by_torneo map
  for(const lista of Object.values(STATE.jugadores_by_torneo||{})){
    const found=lista.find(j=>j.id===jugadorId);
    if(found) return found;
  }
  // Fallback to global cache (covers old torneos with players only in jugadores/ collection)
  const fromGlobal=(STATE.jugadores_global||[]).find(j=>j.id===jugadorId);
  if(fromGlobal) return fromGlobal;
  return null;
}

// Ensure global jugadores are loaded (for name lookups and search)
let _jugadoresGlobalUnsub=null;
function ensureJugadoresGlobal(){
  if(_jugadoresGlobalUnsub) return; // already listening
  let _firstLoad=true;
  _jugadoresGlobalUnsub=db.collection('jugadores').orderBy('nombre')
    .onSnapshot(s=>{
      STATE.jugadores_global=s.docs.map(d=>({id:d.id,...d.data()}));
      // Fetch user profiles for any jugador with user_uid (for admin enrichment)
      _enrichJugadoresWithUserProfiles();
      // Skip render on first load (other listeners handle initial render)
      // Re-render on subsequent updates (e.g., when user vinculars and jugador data changes)
      if(_firstLoad){ _firstLoad=false; return; }
      renderCurrentTab();
    }, e=>console.error('jugadores global listener:',e));
  // Add to unsubs for cleanup
  STATE.unsubs.push(()=>{ if(_jugadoresGlobalUnsub){ _jugadoresGlobalUnsub(); _jugadoresGlobalUnsub=null; }});
}

// Fetch user profiles to enrich jugador data for admin view
// Two discovery paths:
// 1) jugadores with user_uid → fetch users/{user_uid}
// 2) users with linked_jugadores → reverse map jugadorId → userProfile
let _enrichRunning=false;
async function _enrichJugadoresWithUserProfiles(){
  if(_enrichRunning) return;
  _enrichRunning=true;
  let changed=false;
  try{
    // PATH 1: jugadores that have user_uid set → fetch user profile
    const uidsFromJugadores=new Set();
    for(const jug of STATE.jugadores_global){
      if(jug.user_uid && !STATE.users_cache[jug.user_uid]){
        uidsFromJugadores.add(jug.user_uid);
      }
    }
    if(uidsFromJugadores.size>0){
      const uidArr=Array.from(uidsFromJugadores);
      for(let i=0; i<uidArr.length; i+=10){
        const batch=uidArr.slice(i,i+10);
        try{
          const snap=await db.collection('users').where(firebase.firestore.FieldPath.documentId(),'in',batch).get();
          snap.docs.forEach(d=>{ STATE.users_cache[d.id]=d.data(); changed=true; });
        }catch(e){
          for(const uid of batch){
            try{ const doc=await db.collection('users').doc(uid).get();
              if(doc.exists){ STATE.users_cache[doc.id]=doc.data(); changed=true; }
            }catch(e2){}
          }
        }
      }
    }

    // PATH 2: users who have linked_jugadores → build reverse map
    // This catches cases where user_uid didn't get written to jugador doc (permission issues)
    if(!STATE._jugadorToUserMap) STATE._jugadorToUserMap={};
    try{
      const linkedSnap=await db.collection('users').where('has_linked_jugadores','==',true).get();
      linkedSnap.docs.forEach(d=>{
        const userData=d.data();
        STATE.users_cache[d.id]=userData;
        const linkedJugs=userData.linked_jugadores||[];
        linkedJugs.forEach(jugId=>{
          STATE._jugadorToUserMap[jugId]={uid:d.id, ...userData};
        });
      });
      if(linkedSnap.docs.length>0) changed=true;
    }catch(e){
      console.warn('[enrich] linked_jugadores query failed:', e.message);
    }

    // PATH 2b: Also fix jugador docs that are missing user_uid (admin can write)
    // If admin sees a jugador without user_uid but knows the user via reverse map → write it
    const isAdmin=STATE.profile?.role==='admin';
    if(isAdmin){
      for(const jug of STATE.jugadores_global){
        if(!jug.user_uid && STATE._jugadorToUserMap[jug.id]){
          const mapping=STATE._jugadorToUserMap[jug.id];
          try{
            await db.collection('jugadores').doc(jug.id).update({user_uid:mapping.uid});
            jug.user_uid=mapping.uid; // update local cache
            console.log('[enrich] Admin fixed user_uid on jugador '+jug.id);
            changed=true;
          }catch(e){ /* admin can't write either, skip */ }
        }
      }
    }
  }catch(e){
    console.warn('[enrich] error:', e.message);
  }
  _enrichRunning=false;
  if(changed) renderCurrentTab();
}
function getJugadoresTorneo(torneoId){
  if(torneoId===STATE.activeTorneoId) return STATE.jugadores||[];
  return STATE.jugadores_by_torneo[torneoId]||[];
}

// Returns unified list: participantes + players from resultados (same source as calcRankingTorneo)
function getJugadoresCompletesTorneo(torneoId){
  const participantes=getJugadoresTorneo(torneoId);
  const pMap=new Map(participantes.map(j=>[j.id,j]));
  // Collect jugador_ids from resultados for this torneo's jornadas
  const jornadasT=STATE.jornadas.filter(j=>
    j.torneo_id===torneoId||(!j.torneo_id&&torneoId===STATE.torneo?.id)
  );
  jornadasT.forEach(jn=>{
    STATE.resultados.filter(r=>r.jornada_id===jn.id).forEach(r=>{
      if(!pMap.has(r.jugador_id)){
        const jug=getJugador(r.jugador_id)||{id:r.jugador_id,nombre:'Jugador',foto:'?'};
        pMap.set(r.jugador_id,{...jug,id:r.jugador_id,_fromResults:true});
      }
    });
  });
  // Sort: participantes first (alphabetical), then result-only players
  return Array.from(pMap.values()).sort((a,b)=>{
    if(a._fromResults&&!b._fromResults) return 1;
    if(!a._fromResults&&b._fromResults) return -1;
    return (a.nombre||'').localeCompare(b.nombre||'');
  });
}
// ── Phone utility functions ──────────────────────────
function normalizeTelVE(tel, codigoPais){
  if(!tel) return '';
  // Strip non-digits
  let t=tel.replace(/\D/g,'');
  if(!t) return '';
  // For Venezuela (+58): if starts with 0, remove leading 0
  if(codigoPais==='+58' && t.startsWith('0')) t=t.substring(1);
  return t;
}

function validarFormatoTel(tel, codigoPais){
  if(!tel) return true; // empty is valid (optional field)
  const digits=tel.replace(/\D/g,'');
  if(codigoPais==='+58') return digits.length>=7 && digits.length<=10;
  return digits.length>=7 && digits.length<=15;
}

function validarTelefonoNew(input){
  // Live validation hint for phone input in agregar jugador form
  const v=input.value.replace(/\D/g,'');
  input.value=v;
}

// Normaliza texto quitando acentos y caracteres especiales
function normalizeStr(str){
  return (str||'').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')  // remove diacritics
    .replace(/[^a-z0-9 ]/g,' ')
    .replace(/\s+/g,' ').trim();
}

function setActiveTorneo(torneoId){
  if(STATE.activeTorneoId===torneoId) return;
  STATE.activeTorneoId=torneoId;
  STATE.torneo=STATE.torneos.find(t=>t.id===torneoId)||null;
  // Swap STATE.jugadores to the new active torneo (already loaded or empty)
  STATE.jugadores=STATE.jugadores_by_torneo[torneoId]||[];
  // Subscribe if not yet loaded
  if(!_participantesUnsubs[torneoId]){
    subscribeParticipantes();
  } else {
    renderCurrentTab();
  }
}

function getActiveTorneo(){
  return STATE.torneos.find(t=>t.id===STATE.activeTorneoId)||STATE.torneo||null;
}

// Find a torneo by ID — searches allTorneos (broad) then filtered torneos
function findTorneo(torneoId){
  if(!torneoId) return null;
  return (STATE.allTorneos||[]).find(t=>t.id===torneoId)
      || STATE.torneos.find(t=>t.id===torneoId)
      || null;
}

function getReglas(torneoId){
  const t=findTorneo(torneoId)||STATE.torneo;
  return Object.assign({
    puntos:{1:4,2:3,3:2,resto:1},
    bonusAsistencia:0,
    penalNoAsistencia:0,
    penalDQ:0,
    descartes:0,
    empates:'comparten'
  }, t?.reglas||{});
}

// Puntos por posición según reglas del torneo
function getPtsPosicion(pos, reglas){
  if(!reglas) reglas=getReglas(STATE.activeTorneoId);
  const p=reglas.puntos||{};
  return p[pos]!==undefined ? p[pos] : (p.resto!==undefined ? p.resto : 1);
}

// Legacy getPts (backward compat with cargar resultados)
function getPts(pos,asist,torneoId){
  if(!asist) return 0;
  const reglas=getReglas(torneoId||STATE.activeTorneoId);
  return getPtsPosicion(pos, reglas);
}

// ─── calcRankingTorneo: with empates y descartes ─────
function calcRankingTorneo(torneoId){
  const reglas=getReglas(torneoId);
  const jornadasT=STATE.jornadas.filter(j=>
    (!torneoId||(j.torneo_id===torneoId||(!j.torneo_id&&torneoId===STATE.torneo?.id)))
    && j.cuentaRanking!==false
  );
  const jugados=jornadasT.filter(j=>j.estado!=='Planificada');
  const oficiales=jornadasT.filter(j=>j.estado==='Oficial');

  // 1. Build pts-per-partida map: recalculate from position applying empate rules
  // First build a map: jornada_id → { jugador_id → calculated_pts }
  const jornadaPtsMap={};
  for(const jn of jugados){
    // Per-partida rules: use reglasOverride if present
    const jnReglas=jn.reglasOverride?Object.assign({},reglas,{
      puntos:jn.reglasOverride.puntos||reglas.puntos,
      bonusAsistencia:jn.reglasOverride.bonusAsistencia!=null?jn.reglasOverride.bonusAsistencia:reglas.bonusAsistencia,
      penalNoAsistencia:jn.reglasOverride.penalNoAsistencia!=null?jn.reglasOverride.penalNoAsistencia:reglas.penalNoAsistencia,
      penalDQ:jn.reglasOverride.penalDQ!=null?jn.reglasOverride.penalDQ:reglas.penalDQ
    }):reglas;
    const jnResults=STATE.resultados.filter(r=>r.jornada_id===jn.id&&r.asistencia);
    // Group by position to detect empates
    const byPos={};
    jnResults.forEach(r=>{
      if(!byPos[r.pos]) byPos[r.pos]=[];
      byPos[r.pos].push(r);
    });
    jornadaPtsMap[jn.id]={};
    Object.entries(byPos).forEach(([posStr,group])=>{
      const pos=Number(posStr);
      let basePts;
      if(jnReglas.empates==='comparten'&&group.length>1){
        // Average points of positions pos, pos+1, ... pos+group.length-1
        let sum=0;
        for(let k=0;k<group.length;k++) sum+=getPtsPosicion(pos+k,jnReglas);
        basePts=sum/group.length;
      } else {
        basePts=getPtsPosicion(pos,jnReglas);
      }
      group.forEach(r=>{
        let pts=basePts;
        pts+=(jnReglas.bonusAsistencia||0);
        if(r.dq) pts+=(jnReglas.penalDQ||0);
        jornadaPtsMap[jn.id][r.jugador_id]=Math.round(pts*100)/100;
      });
    });
    // Non-attendees
    STATE.resultados.filter(r=>r.jornada_id===jn.id&&!r.asistencia).forEach(r=>{
      jornadaPtsMap[jn.id][r.jugador_id]=(jnReglas.penalNoAsistencia||0);
    });
  }

  // 2. Aggregate per player — build from resultados (works without participantes subcollection)
  // Collect unique jugador_ids who have results in this torneo's jornadas
  const jugadorIds=new Set();
  jugados.forEach(jn=>{
    STATE.resultados.filter(r=>r.jornada_id===jn.id).forEach(r=>jugadorIds.add(r.jugador_id));
  });
  // Also include participantes even if no results yet
  const participantes=getJugadoresTorneo(torneoId);
  participantes.forEach(j=>jugadorIds.add(j.id));

  const rawData=Array.from(jugadorIds).map(jugadorId=>{
    // Look up jugador from all sources
    const jugador=getJugador(jugadorId)||participantes.find(j=>j.id===jugadorId)||{id:jugadorId,nombre:'Jugador',foto:'?'};
    // Enrich with latest data from jugadores_global (updated in real-time via onSnapshot)
    const global=(STATE.jugadores_global||[]).find(g=>g.id===jugadorId||g.id===jugador.jugador_id);
    if(global){
      if(global.nombre) jugador.nombre=global.nombre;
      if(global.alias) jugador.alias=global.alias;
      if(global.foto) jugador.foto=global.foto;
      if(global.fotoURL) jugador.fotoURL=global.fotoURL;
    }
    const jornadaPts=jugados.map(jn=>{
      const r=STATE.resultados.find(r=>r.jornada_id===jn.id&&r.jugador_id===jugadorId);
      if(!r) return null;
      const calculatedPts=jornadaPtsMap[jn.id]?.[jugadorId]??0;
      return{jornada_id:jn.id,pts:calculatedPts,asistencia:r.asistencia,dq:r.dq||false,pos:r.pos};
    }).filter(Boolean);

    // Apply descartes: remove N lowest scoring partidas
    let ptsList=[...jornadaPts];
    if(reglas.descartes>0&&ptsList.length>reglas.descartes){
      const sorted=[...ptsList].sort((a,b)=>a.pts-b.pts);
      const descartados=new Set(sorted.slice(0,reglas.descartes).map(p=>p.jornada_id));
      ptsList=ptsList.filter(p=>!descartados.has(p.jornada_id));
    }

    const ptsT=Math.round(ptsList.reduce((a,r)=>a+r.pts,0)*100)/100;
    const ptsOf=Math.round(ptsList.filter(r=>oficiales.some(j=>j.id===r.jornada_id)).reduce((a,r)=>a+r.pts,0)*100)/100;
    const asist=jornadaPts.filter(r=>r.asistencia).length;
    return{...jugador,id:jugadorId,ptsT,ptsOf,asist,jornadaPts};
  });

  // 3. Sort by ptsT desc
  rawData.sort((a,b)=>b.ptsT-a.ptsT);

  // 4. Assign ranking positions
  rawData.forEach((j,i)=>j.pos=i+1);

  return rawData;
}

// Legacy calcRanking uses active torneo
function calcRanking(){ return calcRankingTorneo(STATE.activeTorneoId||STATE.torneo?.id); }
function avatarBg(pos){
  if(pos===1)return'#C49A00'; if(pos===2)return'#78909C'; if(pos===3)return'#8D6E63';
  return'var(--green)';
}
function medal(pos){
  if(pos===1)return'🥇'; if(pos===2)return'🥈'; if(pos===3)return'🥉';
  return`<span style="color:var(--muted);font-weight:700;font-size:14px;width:22px;display:inline-block;text-align:center;">${pos}</span>`;
}
function badgeHTML(estado){
  const m={'Oficial':'badge-oficial','Jugado':'badge-validar','Por Validar':'badge-validar','Pendiente Attest':'badge-attest','Planificada':'badge-planificada','En Juego':'badge-enjuego','Activo':'badge-activo','Borrador':'badge-planificada'};
  return`<span class="badge ${m[estado]||'badge-planificada'}">${estado}</span>`;
}
function avatarHTML(foto,pos,size='md'){
  const bg=avatarBg(pos);
  const sz=size==='sm'?'32px;font-size:11px':size==='lg'?'42px;font-size:15px':'36px;font-size:13px';
  const shadow=pos===1?'box-shadow:0 0 0 3px rgba(196,154,0,0.25);':'';
  return`<div class="avatar" style="width:${sz};background:${bg};${shadow}">${foto||'?'}</div>`;
}
function fmtPts(n){ return Number.isInteger(n)?String(n):n.toFixed(1); }
function fmtFecha(v){
  if(!v) return '—';
  let d;
  if(typeof v==='object' && v.seconds) d=new Date(v.seconds*1000);
  else if(typeof v==='object' && v.toDate) d=v.toDate();
  else if(typeof v==='string'||typeof v==='number') d=new Date(String(v).length<=10?v+'T12:00:00':v);
  else d=new Date(v);
  return (!d||isNaN(d.getTime())) ? '—' : d.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
}
function fmtFechaJornada(jn){
  return fmtFecha(jn.fecha||jn.creado||null);
}

// Returns the LIVE estado for a partida (auto En Juego when date arrives)
function getEstadoJornada(jn){
  const stored=jn.estado||'Planificada';
  // Terminal states: never auto-change
  if(stored==='Pendiente Attest'||stored==='Jugado'||stored==='Oficial'||stored==='Por Validar') return stored;
  // Auto-transition: if fecha is today or past → En Juego
  // Uses LOCAL date (not UTC) so Venezuela/Miami time is respected
  if(jn.fecha){
    const fechaStr=typeof jn.fecha==='object'&&jn.fecha.seconds
      ? new Date(jn.fecha.seconds*1000).toLocaleDateString('en-CA')  // YYYY-MM-DD in local tz
      : String(jn.fecha).substring(0,10);
    const now=new Date();
    const today=now.toLocaleDateString('en-CA');  // YYYY-MM-DD in local tz
    if(fechaStr<=today) return 'En Juego';
  }
  return 'Planificada';
}

// ══════════════════════════════════════════════════════
// DASHBOARD — Multi-torneo
// ══════════════════════════════════════════════════════
function torneoCardHTML(torneo, compact=false){
  const tid=torneo.id;
  const reglas=getReglas(tid);
  const jornadasT=STATE.jornadas.filter(j=>j.torneo_id===tid||(!j.torneo_id&&tid===STATE.torneo?.id));
  const jugadas=jornadasT.filter(j=>j.estado!=='Planificada').length;
  const total=torneo.jornadas_total||jornadasT.length||'?';
  const proxima=[...jornadasT].sort((a,b)=>new Date(a.fecha)-new Date(b.fecha))
    .find(j=>j.estado==='Planificada'&&j.fecha>=new Date().toISOString().slice(0,10));

  // My position
  const rk=calcRankingTorneo(tid);
  const jugCount=getJugadoresTorneo(tid).filter(j=>j.activo!==false).length;
  const myJugadorId=STATE.profile?.jugador_id;
  const myPos=rk.find(r=>r.id===myJugadorId);
  const isAdmin=isTorneoAdmin(torneo);

  const estadoColor={'Activo':'var(--green)','activo':'var(--green)','Finalizado':'var(--muted)','finalizado':'var(--muted)','Borrador':'var(--gold)','borrador':'var(--gold)'}[torneo.estado]||'var(--blue)';

  return`
  <div class="card" style="margin-bottom:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,var(--green),var(--teal));cursor:pointer;"
      onclick="toggleTorneoDash('${tid}')">
      <div style="display:flex;">
        <!-- Logo grande a la izquierda -->
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;width:110px;min-height:110px;padding:12px;">
          ${torneo.logoURL
            ?`<img src="${torneo.logoURL}" style="width:90px;height:90px;border-radius:14px;object-fit:cover;border:2px solid rgba(255,255,255,0.3);box-shadow:0 4px 12px rgba(0,0,0,0.2);"/>`
            :`<div style="width:90px;height:90px;border-radius:14px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-size:36px;border:2px solid rgba(255,255,255,0.15);">🏆</div>`}
        </div>
        <!-- Info a la derecha -->
        <div style="flex:1;padding:14px 16px 14px 4px;display:flex;flex-direction:column;justify-content:center;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div style="color:rgba(255,255,255,0.7);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">
                ${torneo.estado?.toUpperCase()||'ACTIVO'}
              </div>
              <div style="color:#fff;font-size:16px;font-weight:800;font-family:Georgia,serif;line-height:1.2;">${torneo.nombre}</div>
            </div>
            ${myPos?`<div style="text-align:right;flex-shrink:0;margin-left:8px;">
              <div style="color:rgba(255,255,255,0.7);font-size:9px;">Mi pos.</div>
              <div style="color:#fff;font-size:20px;font-weight:800;line-height:1.1;">#${myPos.pos}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:10px;">${myPos.ptsT} pts</div>
            </div>`:''}
          </div>
          <div style="display:flex;gap:14px;margin-top:10px;">
            <div><div style="color:rgba(255,255,255,0.55);font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Partidas</div>
              <div style="color:#fff;font-size:13px;font-weight:700;">${jugadas}/${total}</div></div>
            <div><div style="color:rgba(255,255,255,0.55);font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Jugadores</div>
              <div style="color:#fff;font-size:13px;font-weight:700;">${jugCount}</div></div>
            <div><div style="color:rgba(255,255,255,0.55);font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Próxima</div>
              <div style="color:#fff;font-size:12px;font-weight:600;">${proxima?fmtFecha(proxima.fecha):'—'}</div></div>
          </div>
        </div>
      </div>
    </div>

    ${STATE.expandedTorneo===tid?`
    <div style="padding:0;">
      <!-- Mini ranking top 3 -->
      <div style="padding:14px 20px 8px;">
        <div class="text-11 text-muted font-bold" style="letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">🏆 Podio</div>
        ${rk.slice(0,3).map(j=>`
          <div class="result-row" style="margin-bottom:8px;">
            ${medal(j.pos)}
            ${j.fotoURL?`<img src="${j.fotoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;"/>`:avatarHTML(j.foto,j.pos,'sm')}
            <div class="flex-1 text-13 font-bold">${j.nombre}</div>
            <div style="font-size:16px;font-weight:800;color:${j.pos===1?'var(--gold)':'var(--text)'};">${fmtPts(j.ptsT)}<span class="text-10 text-muted"> pts</span></div>
          </div>`).join('')}
      </div>
      <!-- Próximas partidas -->
      ${jornadasT.filter(j=>j.estado==='Planificada').slice(0,2).length?`
      <div style="border-top:1px solid var(--border);padding:12px 20px 8px;">
        <div class="text-11 text-muted font-bold" style="letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">📅 Próximas</div>
        ${jornadasT.filter(j=>j.estado==='Planificada').slice(0,2).map(jn=>`
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            ${clubAvatarHTML(jn.sede)}
            <div class="flex-1">
              <div class="text-13 font-bold">${jn.sede||'Sin sede'}</div>
              <div class="text-11 text-muted">${fmtFechaJornada(jn)}${jn.teeTime?' · ⏰ '+jn.teeTime:''}</div>
            </div>
          </div>`).join('')}
      </div>`:''}
      <!-- Actions -->
      <div style="border-top:1px solid var(--border);padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-outline" style="font-size:12px;padding:7px 14px;" onclick="verTorneoCompleto('${tid}')">Ver ranking completo →</button>
      </div>
    </div>`:``}
  </div>`;
}

function toggleTorneoDash(torneoId){
  STATE.expandedTorneo=STATE.expandedTorneo===torneoId?null:torneoId;
  renderDashboard();
}

function verTorneoCompleto(torneoId){
  STATE.activeTorneoId=torneoId;
  goTab('mistorneos');
  STATE.expandedTorneo=torneoId;
}

function renderDashboard(){
  const el=document.getElementById('tab-dashboard');
  const isAdmin=STATE.profile?.role==='admin';
  const publicos=(STATE.allTorneos||[]).filter(t=>t.visibilidad==='publico'&&(t.estado==='Activo'||t.estado==='activo'));
  const sorted=[...publicos].sort((a,b)=>{
    const fa=a.creado?.toDate?a.creado.toDate():new Date(a.creado||0);
    const fb=b.creado?.toDate?b.creado.toDate():new Date(b.creado||0);
    return fb-fa;
  });
  let html=`<div style="margin-bottom:12px;"><div class="text-15 font-bold">Torneos Públicos</div></div>`;
  if(sorted.length===0){
    html+=`<div class="card"><div class="card-body" style="text-align:center;padding:32px;">
      <div style="font-size:40px;margin-bottom:8px;">🏆</div>
      <div class="text-14 font-bold">No hay torneos públicos</div>
      <div class="text-12 text-muted" style="margin-top:6px;">Usa <strong>➕ Crear</strong> para crear tu primer torneo público</div>
    </div></div>`;
  } else {
    sorted.forEach(t=>{
      const costoTxt=t.costoInscripcion>0
        ?`${t.costoInscripcion} ${t.monedaInscripcion==='pelotas'?'⛳':t.monedaInscripcion}`
        :'Gratis';
      const logoEl=t.logoURL
        ?`<img src="${t.logoURL}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid var(--border);"/>`
        :`<div style="width:44px;height:44px;border-radius:10px;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;flex-shrink:0;">🏆</div>`;
      html+=`<div class="card" style="margin-bottom:10px;cursor:pointer;" onclick="openTorneoPublico('${t.id}')">
        <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
          ${logoEl}
          <div class="flex-1">
            <div class="text-14 font-bold">${t.nombre}</div>
            <div class="text-12 text-muted">${t.descripcion||'Sin descripción'}</div>
          </div>
          <div style="text-align:right;">
            <div class="text-12 font-bold" style="color:var(--green);">${costoTxt}</div>
            <div class="text-11 text-muted">Inscripción</div>
          </div>
        </div>
      </div>`;
    });
  }
  if(isAdmin){
    html+=`<div class="card" style="margin-top:12px;">
      <div class="card-header"><span class="card-title">⚙️ Admin</span></div>
      <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-outline" onclick="goTab('jugadores')">+ Jugador</button>
        ${STATE.jugadores.length===0?`<button class="btn-teal" onclick="seedDatos()">🌱 Datos Iniciales</button>`:''}
      </div>
      <div id="seedMsg" style="display:none;padding:10px 20px;font-size:13px;color:var(--green);"></div>
    </div>`;
  }
  el.innerHTML=html;
}

function openTorneoPublico(torneoId){
  if(typeof openModalInscripcion==='function') openModalInscripcion(torneoId);
}


// ══════════════════════════════════════════════════════
// MIS TORNEOS — Lista completa con detalle expandible
// ══════════════════════════════════════════════════════
function renderMisTorneos(){
  const el=document.getElementById('tab-mistorneos');
  const isAdmin=STATE.profile?.role==='admin';
  const torneos=[...STATE.torneos].sort((a,b)=>{
    const order={activo:0,Activo:0,borrador:1,Borrador:1,finalizado:2,Finalizado:2};
    return (order[a.estado]||1)-(order[b.estado]||1);
  });

  el.innerHTML=`
    <div style="margin-bottom:16px;">
      <div class="text-15 font-bold" style="font-family:Georgia,serif;">Mis Torneos</div>
      <div class="text-12 text-muted">${torneos.length} torneo${torneos.length!==1?'s':''}</div>
    </div>
    ${torneos.length===0?`<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:40px;">
      <div style="font-size:48px;margin-bottom:12px;">⛳</div>
      <div>No tienes torneos aún.</div>
      <div class="text-12" style="margin-top:8px;">Usa la pestaña <strong>➕ Crear</strong> para crear tu primer torneo.</div>
    </div></div>`:''}
    ${torneos.map(t=>{
      const tid=t.id;
      const isExpanded=STATE.expandedTorneo===tid;
      const rk=calcRankingTorneo(tid);
      const jornadasT=STATE.jornadas.filter(j=>j.torneo_id===tid||(!j.torneo_id&&tid===STATE.torneo?.id));
      const jugadas=jornadasT.filter(j=>j.estado!=='Planificada').length;
      const total=t.jornadas_total||jornadasT.length||'?';
      const myJugadorId=STATE.profile?.jugador_id;
      const myPos=rk.find(r=>r.id===myJugadorId);
      const isAdminT=isTorneoAdmin(t);

      return`
      <div class="card" style="margin-bottom:12px;">
        <!-- Card header -->
        <div style="padding:16px 20px;cursor:pointer;display:flex;align-items:center;gap:14px;"
          onclick="toggleTorneoMis('${tid}')">
          ${t.logoURL
            ?`<img src="${t.logoURL}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid var(--border);"/>`
            :`<div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--green),var(--teal));
            display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0;">⛳</div>`}
          <div class="flex-1">
            <div class="text-15 font-bold">${t.nombre}</div>
            <div class="text-12 text-muted">${jugadas}/${total} partidas · ${getJugadoresTorneo(tid).filter(j=>j.activo!==false).length} jugadores</div>
            ${myPos?`<div class="text-11" style="color:var(--green);margin-top:2px;">Tu posición: #${myPos.pos} · ${myPos.ptsT} pts</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${badgeHTML(t.estado||'Activo')}
            <span style="color:var(--muted);font-size:13px;">${isExpanded?'▲':'▼'}</span>
          </div>
        </div>

        ${isExpanded?`
        <!-- Ranking completo -->
        <div style="border-top:1px solid var(--border);">
          <div style="padding:14px 20px 4px;">
            <div class="text-11 text-muted font-bold" style="letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">📊 Ranking</div>
            <div class="rank-head"><span>#</span><span>Jugador</span><span>Asist.</span><span>Total</span></div>
            ${rk.map(j=>`
              <div class="rank-row ${j.pos<=3?'top':''}">
                <div>${medal(j.pos)}</div>
                <div class="flex items-center gap-8">
                  ${j.fotoURL?`<img src="${j.fotoURL}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;"/>`:avatarHTML(j.foto,j.pos,'sm')}
                  <div><div class="text-13 font-bold">${j.nombre}</div><div class="text-11 text-muted">${j.alias||''}</div></div>
                </div>
                <div class="text-13 text-muted">${j.asist}✓</div>
                <div style="font-size:15px;font-weight:800;color:${j.pos===1?'var(--gold)':'var(--text)'};">${j.ptsT}</div>
              </div>`).join('')}
          </div>

          <!-- Partidas del torneo — clickeables -->
          <div style="border-top:1px solid var(--border);padding:14px 20px 8px;">
            <div class="text-11 text-muted font-bold" style="letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">📅 Partidas</div>
            ${jornadasT.length===0?`<div class="text-13 text-muted">Sin partidas aún.</div>`:''}
            ${[...jornadasT].sort((a,b)=>{const fa=a.fecha&&typeof a.fecha==='object'&&a.fecha.seconds?new Date(a.fecha.seconds*1000):new Date(a.fecha||0);const fb=b.fecha&&typeof b.fecha==='object'&&b.fecha.seconds?new Date(b.fecha.seconds*1000):new Date(b.fecha||0);return fa-fb;}).map(jn=>jornadaRowMT(jn)).join('')}
          </div>

          <!-- Desglose por partida -->
          ${(()=>{
            const jJugadas=jornadasT.filter(j=>j.estado!=='Planificada');
            if(!jJugadas.length) return '';
            const minW=80+jJugadas.length*60;
            let html='<div style="border-top:1px solid var(--border);padding:14px 20px 8px;overflow-x:auto;">';
            html+='<div class="text-11 text-muted font-bold" style="letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Desglose por Partida</div>';
            html+='<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:'+minW+'px;">';
            html+='<tr><td style="padding:4px 8px;color:var(--muted);font-weight:700;white-space:nowrap;">Jugador</td>';
            jJugadas.forEach(jn=>{html+='<td style="padding:4px 8px;text-align:center;color:var(--muted);font-weight:700;white-space:nowrap;">'+jn.sede+(jn.reglasOverride?' ⭐':'')+'<br/><span style="font-size:10px;opacity:0.75;">'+fmtFechaJornada(jn)+'</span><br/>'+badgeHTML(getEstadoJornada(jn))+'</td>';});
            html+='<td style="padding:4px 8px;text-align:center;color:var(--green);font-weight:700;">TOT</td></tr>';
            rk.forEach(j=>{
              html+='<tr style="border-top:1px solid var(--border);">';
              html+='<td style="padding:5px 8px;font-weight:600;white-space:nowrap;">'+j.nombre+'</td>';
              jJugadas.forEach(jn=>{
                const jp=(j.jornadaPts||[]).find(p=>p.jornada_id===jn.id);
                if(!jp){ html+='<td style="padding:5px 8px;text-align:center;color:var(--muted);">?</td>'; return; }
                if(!jp.asistencia){ html+='<td style="padding:5px 8px;text-align:center;color:var(--muted);">—</td>'; return; }
                if(jp.dq){ html+='<td style="padding:5px 8px;text-align:center;color:#C62828;">DQ</td>'; return; }
                const col=jp.pts>=4?'var(--gold)':'var(--text)';
                html+='<td style="padding:5px 8px;text-align:center;color:'+col+';">'+fmtPts(jp.pts)+'</td>';
              });
              html+='<td style="padding:5px 8px;text-align:center;font-weight:800;color:'+(j.pos===1?'var(--gold)':'var(--text)')+';">'+fmtPts(j.ptsT)+'</td>';
              html+='</tr>';
            });
            html+='</table></div>';
            return html;
          })()}

          <!-- Reglas del torneo -->
          <div style="border-top:1px solid var(--border);padding:14px 20px 8px;">
            <div class="text-11 text-muted font-bold" style="letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Reglas</div>
            ${reglasResumenHTML(t)}
            ${t.docURL?`<div style="margin-top:10px;">
              <a href="${t.docURL}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--cardL);border-radius:8px;border:1px solid var(--border);color:var(--blue);font-size:13px;font-weight:600;text-decoration:none;">
                ${t.docType==='pdf'?'📄 Ver reglamento / documento':'🖼️ Ver imagen del torneo'}
              </a>
            </div>`:''}
          </div>

          <!-- Acciones -->
          <div style="border-top:1px solid var(--border);padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-blue" style="font-size:12px;padding:7px 14px;" onclick="shareTorneoWA('${tid}',event)">📲 Compartir</button>
            ${(()=>{const pc=(STATE.inscripciones||[]).filter(i=>i.torneo_id===tid&&i.estado==='pendiente').length;return isAdminT&&pc>0?`<button class="btn-outline" style="font-size:12px;padding:7px 14px;" onclick="openModalPendientes('${tid}')">📋 Pendientes <span style="background:#E65100;color:#fff;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:2px;">${pc}</span></button>`:''})()}
            ${isAdminT?`<button class="btn-outline" style="font-size:12px;padding:7px 14px;" onclick="openJugadoresTorneo('${tid}')">👤 Jugadores</button>`:''}
            ${isAdminT?`<button class="btn-green" style="font-size:12px;padding:7px 14px;" onclick="openModalJornada(null,'${tid}')">+ Partida</button>`:''}
            ${isAdminT?`<button class="btn-outline" style="font-size:12px;padding:7px 14px;" onclick="openModalEditTorneo('${tid}')">✏️ Editar torneo</button>`:''}
          </div>
        </div>`:``}
      </div>`;
    }).join('')}
  `;
}

function toggleTorneoMis(torneoId){
  STATE.expandedTorneo=STATE.expandedTorneo===torneoId?null:torneoId;
  renderMisTorneos();
}

function toggleJornadaMT(jid){
  STATE.expandedJornadaMT=STATE.expandedJornadaMT===jid?null:jid;
  renderMisTorneos();
}

// Returns HTML string for a clickable partida row inside Mis Torneos
function jornadaRowMT(jn){
  const isOpen=STATE.expandedJornadaMT===jn.id;
  const est=getEstadoJornada(jn);
  const res=STATE.resultados.filter(r=>r.jornada_id===jn.id).sort((a,b)=>a.pos-b.pos);
  const hasResults=res.length>0;
  const hasFotos=Array.isArray(jn.fotos)&&jn.fotos.length>0;
  const isAdmin=STATE.profile?.role==='admin';

  // ── HEADER ──────────────────────────────────────────
  let html='<div style="border-radius:10px;overflow:hidden;margin-bottom:8px;border:1px solid '+(isOpen?'var(--green)':'var(--border)')+';">';
  html+='<div onclick="toggleJornadaMT(\''+jn.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;background:'+(isOpen?'#F1F8E9':'var(--white)')+';">';
  html+=clubAvatarHTML(jn.sede);
  html+='<div style="flex:1;min-width:0;">';
  html+='<div style="font-size:13px;font-weight:700;">'+(jn.sede||'Sin sede');
  if(jn.cuentaRanking===false) html+=' 🚫';
  if(jn.reglasOverride) html+=' <span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:700;padding:1px 4px;border-radius:4px;">⭐</span>';
  html+='</div>';
  html+='<div style="font-size:11px;color:var(--muted);margin-top:1px;">'+fmtFechaJornada(jn)+(jn.teeTime?' · ⏰ '+jn.teeTime:'')+'</div>';
  html+='</div>';
  // Right side: badge + foto count + arrow
  html+='<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">';
  if(hasFotos) html+='<span style="background:#E3F2FD;color:#1565C0;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;">📷'+jn.fotos.length+'</span>';
  html+=badgeHTML(getEstadoJornada(jn));
  html+='<span style="color:var(--muted);font-size:12px;min-width:10px;">'+(isOpen?'▲':'▼')+'</span>';
  html+='</div>';
  html+='</div>'; // end clickable header

  if(isOpen){
    // ── RESULTS ──────────────────────────────────────
    if(hasResults){
      html+='<div style="border-top:1px solid var(--border);background:var(--bg);">';
      res.forEach(function(r){
        const jug=getJugador(r.jugador_id);
        const isTop=r.pos===1;
        const noAsist=!r.asistencia;
        const isDQ=r.dq;
        html+='<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border);'+(isTop?'background:linear-gradient(90deg,#FFFDE7,transparent);':'')+(noAsist?'opacity:0.55;':'')+'">';
        html+='<div style="min-width:32px;text-align:center;">';
        if(r.pos<=3&&!noAsist&&!isDQ){
          html+='<span style="font-size:18px;">'+medal(r.pos)+'</span>';
        } else {
          html+='<span style="background:var(--border);border-radius:5px;padding:2px 6px;font-size:11px;font-weight:700;color:var(--muted);">'+(noAsist?'—':isDQ?'DQ':r.pos+'°')+'</span>';
        }
        html+='</div>';
        html+=avatarHTML(jug&&jug.foto?jug.foto:'?',r.pos,'sm');
        html+='<div style="flex:1;min-width:0;">';
        html+='<div style="font-size:13px;font-weight:600;">'+(jug?jug.nombre:'Desconocido')+'</div>';
        if(noAsist) html+='<div style="font-size:11px;color:var(--red);">No asistió</div>';
        if(isDQ) html+='<div style="font-size:11px;color:var(--red);">Descalificado</div>';
        html+='</div>';
        if(!noAsist) html+='<div style="font-size:16px;font-weight:800;color:'+(isTop?'#B8860B':'var(--text)')+';">'+fmtPts(r.pts)+'<span style="font-size:11px;font-weight:400;color:var(--muted);"> pts</span></div>';
        html+='</div>';
      });
      html+='</div>';
    } else {
      html+='<div style="padding:14px;text-align:center;color:var(--muted);font-size:12px;border-top:1px solid var(--border);">Sin resultados cargados aún</div>';
    }

    // ── FOTOS ──────────────────────────────────────────
    if(hasFotos){
      html+='<div style="border-top:1px solid var(--border);padding:12px 14px;background:#fafafa;">';
      html+='<div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">📸 Fotos</div>';
      // Carousel container
      html+='<div style="position:relative;overflow:hidden;border-radius:10px;background:#111;cursor:pointer;" onclick="openCarousel(\''+jn.id+'\',0)">';
      html+='<div id="cmt_'+jn.id+'" style="display:flex;transition:transform 0.35s ease;">';
      jn.fotos.forEach(function(url){
        html+='<img src="'+url+'" style="width:100%;flex-shrink:0;aspect-ratio:4/3;object-fit:cover;" loading="lazy"/>';
      });
      html+='</div>';
      if(jn.fotos.length>1){
        html+='<button onclick="event.stopPropagation();slideCMT(\''+jn.id+'\',-1)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:26px;border-radius:50%;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#8249;</button>';
        html+='<button onclick="event.stopPropagation();slideCMT(\''+jn.id+'\',1)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:26px;border-radius:50%;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#8250;</button>';
        html+='<div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:5px;">';
        jn.fotos.forEach(function(_,di){
          html+='<div id="cmt_dot_'+jn.id+'_'+di+'" style="width:7px;height:7px;border-radius:50%;background:'+(di===0?'#fff':'rgba(255,255,255,0.4)')+';"></div>';
        });
        html+='</div>';
      }
      html+='</div></div>';
    }
  }

  html+='</div>';
  return html;
}


const _cmtIdx={};
function slideCMT(jid,dir){
  const t=document.getElementById('cmt_'+jid); if(!t) return;
  const n=t.querySelectorAll('img').length;
  _cmtIdx[jid]=((_cmtIdx[jid]||0)+dir+n)%n;
  t.style.transform='translateX(-'+(_cmtIdx[jid]*100)+'%)';
  for(let i=0;i<n;i++){const d=document.getElementById('cmt_dot_'+jid+'_'+i);if(d)d.style.background=i===_cmtIdx[jid]?'#fff':'rgba(255,255,255,0.4)';}
}

function reglasResumenHTML(torneo){
  const r=torneo.reglas||{};
  const pts=r.puntos||{1:4,2:3,3:2,resto:1};
  const items=[
    `Puntos: 1°=${pts[1]||4} · 2°=${pts[2]||3} · 3°=${pts[3]||2} · Resto=${pts.resto||1}`,
    r.bonusAsistencia?`Bonus asistencia: +${r.bonusAsistencia} pts`:'',
    r.penalNoAsistencia?`Penal no asistencia: ${r.penalNoAsistencia} pts`:'',
    r.penalDQ?`Penal DQ: ${r.penalDQ} pts`:'',
    r.descartes?`Descartes: ${r.descartes} peor(es) partida(s) no cuentan`:'',
    `Empates: ${r.empates==='comparten'?'Comparten puntos promedio':'Posición anterior'}`,
  ].filter(Boolean);
  return`<div style="display:flex;flex-direction:column;gap:4px;">
    ${items.map(i=>`<div class="text-12 text-muted">• ${i}</div>`).join('')}
  </div>`;
}

// ══════════════════════════════════════════════════════
// MODAL TORNEO — Crear / Editar
// ══════════════════════════════════════════════════════
let editingTorneoId = null;

function openModalTorneo(torneoId=null){
  editingTorneoId=torneoId;
  document.getElementById('modalTorneoError').style.display='none';
  const t=torneoId?STATE.torneos.find(t=>t.id===torneoId):null;
  document.getElementById('modalTorneoTitle').textContent=torneoId?'Editar Torneo':'Nuevo Torneo';

  // Info básica
  document.getElementById('tNombre').value=t?.nombre||'';
  // dates removed — managed through partidas
  document.getElementById('tJornadasTotal').value=t?.jornadas_total||'';
  document.getElementById('tEstado').value=t?.estado||'Activo';
  document.getElementById('tDescripcion').value=t?.descripcion||'';
  document.getElementById('tVisibilidad').value=t?.visibilidad||'privado';
  document.getElementById('tQuienCarga').value=t?.quienCargaResultados||'admins';
  if(document.getElementById('tCostoInscripcion')) document.getElementById('tCostoInscripcion').value=t?.costoInscripcion||0;
  if(document.getElementById('tMonedaInscripcion')) document.getElementById('tMonedaInscripcion').value=t?.monedaInscripcion||'pelotas';

  // Reglas
  const r=t?.reglas||{};
  const pts=r.puntos||{};
  document.getElementById('rPts1').value=pts[1]!==undefined?pts[1]:4;
  document.getElementById('rPts2').value=pts[2]!==undefined?pts[2]:3;
  document.getElementById('rPts3').value=pts[3]!==undefined?pts[3]:2;
  document.getElementById('rPtsResto').value=pts.resto!==undefined?pts.resto:1;
  document.getElementById('rBonus').value=r.bonusAsistencia||0;
  document.getElementById('rPenalNoAsist').value=r.penalNoAsistencia||0;
  document.getElementById('rPenalDQ').value=r.penalDQ||0;
  document.getElementById('rDescartes').value=r.descartes||0;
  document.getElementById('rEmpates').value=r.empates||'comparten';

  updateEmpateEjemplo();

  // Load existing doc
  STATE._torneoDocURL=t?.docURL||null;
  STATE._torneoDocCleared=false;
  document.getElementById('tDocPreview').style.display='none';
  document.getElementById('tDocLabel').style.display='block';
  document.getElementById('tDocInput').value='';
  if(t?.docURL){
    document.getElementById('tDocExisting').style.display='flex';
    document.getElementById('tDocLink').href=t.docURL;
    document.getElementById('tDocLink').textContent=t.docType==='pdf'?'📄 Ver reglamento':'🖼️ Ver imagen del torneo';
  } else {
    document.getElementById('tDocExisting').style.display='none';
  }

  // Load existing logo
  STATE._torneoLogoURL=t?.logoURL||null;
  STATE._torneoLogoCleared=false;
  document.getElementById('tLogoInput').value='';
  if(t?.logoURL){
    document.getElementById('tLogoPreview').src=t.logoURL;
    document.getElementById('tLogoPreview').style.display='block';
    document.getElementById('tLogoPlaceholder').style.display='none';
    document.getElementById('tLogoClearBtn').style.display='inline';
  } else {
    document.getElementById('tLogoPreview').style.display='none';
    document.getElementById('tLogoPreview').src='';
    document.getElementById('tLogoPlaceholder').style.display='';
    document.getElementById('tLogoClearBtn').style.display='none';
  }

  // Load co-admins
  STATE._coAdmins=[...(t?.admins||[])].filter(uid=>uid!==STATE.user?.uid);
  renderAdminsList();

  // Hide co-admins section for new torneos (show after creation)
  document.getElementById('seccionAdmins').style.display=torneoId?'block':'none';
  document.getElementById('modalTorneo').style.display='flex';
}

// Alias for edit button
function openModalEditTorneo(torneoId){ openModalTorneo(torneoId); }

// ── Share tournament via WhatsApp ─────────────────────
function shareTorneoWA(torneoId, event){
  if(event) event.stopPropagation();
  const t=(STATE.allTorneos||STATE.torneos||[]).find(x=>x.id===torneoId);
  if(!t) return;
  const url=(window.location.origin+window.location.pathname).replace(/\/$/, '')+'?torneo='+torneoId;
  const costoTxt=t.costoInscripcion>0
    ?t.costoInscripcion+' '+(t.monedaInscripcion==='pelotas'?'pelotas':t.monedaInscripcion)
    :'Gratis';
  const msg='🏌️ *¡Te invito a un torneo en Golfeados!*\n\n'
    +'🏆 *'+t.nombre+'*\n'
    +(t.descripcion?t.descripcion+'\n':'')
    +'\n💰 Inscripción: '+costoTxt+'\n\n'
    +'👉 Inscríbete aquí: '+url+'\n\n'
    +'¡Nos vemos en el campo! ⛳';
  window.open('https://wa.me/?text='+encodeURIComponent(msg), '_blank');
}

// ── Crear Torneo — Tab inline ─────────────────────────
function renderCrearTorneo(){
  const el=document.getElementById('tab-creartorneo');
  if(!el) return;
  if(el.dataset.ready==='1') return;
  el.dataset.ready='1';
  const modalBody=document.querySelector('#modalTorneo .modal-body');
  if(!modalBody) return;
  el.innerHTML=`
    <div style="margin-bottom:16px;">
      <div class="text-15 font-bold" style="font-family:Georgia,serif;">Crear Torneo</div>
      <div class="text-12 text-muted">Configura los detalles de tu nuevo torneo</div>
    </div>
    ${modalBody.innerHTML}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;padding-bottom:20px;">
      <button class="btn-green" id="btnGuardarTorneo" onclick="saveModalTorneo()" style="padding:12px 28px;font-size:14px;">Crear Torneo ⛳</button>
    </div>`;
  editingTorneoId=null;
  STATE._torneoDocURL=null; STATE._torneoDocCleared=false;
  STATE._torneoLogoURL=null; STATE._torneoLogoCleared=false;
  STATE._coAdmins=[]; STATE._adminUsers={};
  const fv={tNombre:'',tJornadasTotal:'',tDescripcion:'',addAdminInput:''};
  Object.entries(fv).forEach(([id,v])=>{ const e=document.getElementById(id); if(e) e.value=v; });
  const sv={tEstado:'Activo',tVisibilidad:'privado',tQuienCarga:'admins',tCostoInscripcion:'0',tMonedaInscripcion:'pelotas',rPts1:'4',rPts2:'3',rPts3:'2',rPtsResto:'1',rBonus:'0',rPenalNoAsist:'0',rPenalDQ:'0',rDescartes:'0',rEmpates:'comparten'};
  Object.entries(sv).forEach(([id,v])=>{ const e=document.getElementById(id); if(e) e.value=v; });
  ['tDocPreview','tDocExisting','tLogoPreview','tLogoClearBtn','modalTorneoError'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.style.display='none';
  });
  const ph=document.getElementById('tLogoPlaceholder'); if(ph) ph.style.display='';
  updateEmpateEjemplo();
  renderAdminsList();
}

function renderAdminsList(){
  const el=document.getElementById('adminsList');
  if(!el)return;
  const admins=STATE._coAdmins||[];
  if(admins.length===0){
    el.innerHTML='<div class="text-12 text-muted">Sin co-administradores aún.</div>';
    return;
  }
  el.innerHTML=admins.map(uid=>{
    const u=STATE._adminUsers?.[uid]||{};
    return`<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border-radius:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">${(u.nombre||uid).slice(0,2).toUpperCase()}</div>
      <div class="flex-1"><div class="text-12 font-bold">${u.nombre||uid}</div><div class="text-11 text-muted">${u.email||''}</div></div>
      <button onclick="removeCoAdmin('${uid}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;">✕</button>
    </div>`;
  }).join('');
}

async function addCoAdmin(){
  const input=document.getElementById('addAdminInput');
  const errEl=document.getElementById('addAdminError');
  const val=input.value.trim();
  errEl.style.display='none';
  if(!val)return;

  try{
    // Search by email or username
    let snap;
    if(val.includes('@')&&val.includes('.')){
      snap=await db.collection('users').where('email','==',val).limit(1).get();
    } else {
      snap=await db.collection('users').where('username','==',val.replace('@','')).limit(1).get();
    }
    if(snap.empty){ errEl.textContent='Usuario no encontrado.'; errEl.style.display='block'; return; }
    const userData=snap.docs[0].data();
    const uid=snap.docs[0].id;
    if(STATE._coAdmins.includes(uid)||uid===STATE.user?.uid){
      errEl.textContent='Este usuario ya es admin.'; errEl.style.display='block'; return;
    }
    STATE._coAdmins.push(uid);
    if(!STATE._adminUsers) STATE._adminUsers={};
    STATE._adminUsers[uid]=userData;
    input.value='';
    renderAdminsList();
  }catch(e){ errEl.textContent='Error: '+e.message; errEl.style.display='block'; }
}

function removeCoAdmin(uid){
  STATE._coAdmins=(STATE._coAdmins||[]).filter(u=>u!==uid);
  renderAdminsList();
}

function closeModalTorneo(event){
  if(event&&event.currentTarget!==event.target)return;
  document.getElementById('modalTorneo').style.display='none';
  editingTorneoId=null;
}

function updateEmpateEjemplo(){
  const el=document.getElementById('empateEjemplo');
  if(!el)return;
  const tipo=(document.getElementById('rEmpates')?.value)||'comparten';
  const pts1=Number(document.getElementById('rPts1')?.value)||4;
  const pts2=Number(document.getElementById('rPts2')?.value)||3;
  const pts3=Number(document.getElementById('rPts3')?.value)||2;
  if(tipo==='comparten'){
    const avg2=((pts1+pts2)/2).toFixed(1);
    const avg3=((pts1+pts2+pts3)/3).toFixed(1);
    el.innerHTML=
      `<strong>2 empatados en 1°:</strong> ${avg2} pts c/u → siguiente toma 3°<br>`+
      `<strong>3 empatados en 1°:</strong> ${avg3} pts c/u → siguiente toma 4°`;
  } else {
    el.innerHTML=
      `<strong>2 empatados en 1°:</strong> ambos reciben ${pts1} pts → siguiente toma 3°<br>`+
      `<strong>3 empatados en 1°:</strong> todos reciben ${pts1} pts → siguiente toma 4°`;
  }
}

async function saveModalTorneo(){
  const nombre=document.getElementById('tNombre').value.trim();
  const err=document.getElementById('modalTorneoError');
  const btn=document.getElementById('btnGuardarTorneo');
  err.style.display='none';

  if(!nombre){ err.textContent='El nombre es obligatorio.'; err.style.display='block'; return; }

  btn.disabled=true; btn.textContent='Guardando...';
  try{
    // Upload doc if selected
    let docURL=STATE._torneoDocURL||null;
    let docType='';
    const docFile=document.getElementById('tDocInput').files[0];
    if(docFile){
      const path='torneos/'+(editingTorneoId||Date.now())+'_doc'+(docFile.type==='application/pdf'?'.pdf':'.jpg');
      if(docFile.type==='application/pdf'){
        docURL=await uploadPhoto(docFile,path,'tDocProgress');
        docType='pdf';
      } else {
        const comp=await resizeAndCompress(docFile,1200,0.85);
        docURL=await uploadPhoto(comp,path,'tDocProgress');
        docType='img';
      }
    }
    if(STATE._torneoDocCleared){ docURL=null; docType=''; }

    // Upload logo if selected
    let logoURL=STATE._torneoLogoURL||null;
    const logoFile=document.getElementById('tLogoInput').files[0];
    if(logoFile){
      const comp=await resizeAndCompress(logoFile,256,0.85);
      const logoPath='torneos/'+(editingTorneoId||Date.now())+'_logo.jpg';
      logoURL=await uploadPhoto(comp,logoPath,'tLogoProgress');
    }
    if(STATE._torneoLogoCleared){ logoURL=null; }

    const data={
      nombre, logoURL,
      ...(docURL?{docURL,docType}:{}),
      jornadas_total:Number(document.getElementById('tJornadasTotal').value)||0,
      estado:document.getElementById('tEstado').value,
      descripcion:document.getElementById('tDescripcion').value.trim(),
      visibilidad:document.getElementById('tVisibilidad').value,
      quienCargaResultados:document.getElementById('tQuienCarga').value,
      costoInscripcion:Number(document.getElementById('tCostoInscripcion')?.value)||0,
      monedaInscripcion:document.getElementById('tMonedaInscripcion')?.value||'pelotas',
      reglas:{
        puntos:{
          1:Number(document.getElementById('rPts1').value)||4,
          2:Number(document.getElementById('rPts2').value)||3,
          3:Number(document.getElementById('rPts3').value)||2,
          resto:Number(document.getElementById('rPtsResto').value)||1,
        },
        bonusAsistencia:Number(document.getElementById('rBonus').value)||0,
        penalNoAsistencia:Number(document.getElementById('rPenalNoAsist').value)||0,
        penalDQ:Number(document.getElementById('rPenalDQ').value)||0,
        descartes:Number(document.getElementById('rDescartes').value)||0,
        empates:document.getElementById('rEmpates').value||'comparten',
      }
    };

    if(editingTorneoId){
      data.updated_at=firebase.firestore.FieldValue.serverTimestamp();
      // Keep original adminId, update admins list
      const origTorneo=STATE.torneos.find(t=>t.id===editingTorneoId);
      data.admins=[origTorneo?.adminId||STATE.user.uid,...(STATE._coAdmins||[])];
      await db.collection('torneos').doc(editingTorneoId).update(data);
    } else {
      data.adminId=STATE.user.uid;
      data.creado_por=STATE.user.uid;
      data.admins=[STATE.user.uid];
      data.cargadores=[];
      data.creado=firebase.firestore.FieldValue.serverTimestamp();
      const ref=await db.collection('torneos').add(data);
      switchActiveTorneo(ref.id);
    }
    closeModalTorneo();
    goTab('mistorneos');
  }catch(e){
    err.textContent='Error: '+e.message; err.style.display='block';
  }finally{
    btn.disabled=false; btn.textContent='Guardar Torneo';
  }
}

// ══════════════════════════════════════════════════════
// RANKING
// ══════════════════════════════════════════════════════
function renderRanking(){
  const el=document.getElementById('tab-ranking');
  const torneoId=STATE.activeTorneoId||STATE.torneos[0]?.id||null;
  if(!torneoId||STATE.torneos.length===0){
    el.innerHTML='<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:40px;">Sin torneos disponibles.</div></div>';
    return;
  }
  const torneo=STATE.torneos.find(t=>t.id===torneoId)||STATE.torneos[0];
  const rk=calcRankingTorneo(torneoId);
  const jornadasT=STATE.jornadas.filter(j=>j.torneo_id===torneoId||(!j.torneo_id&&torneoId===STATE.torneo?.id));
  const oficiales=jornadasT.filter(j=>j.estado==='Oficial').length;
  const jugadasAll=jornadasT.filter(j=>j.estado!=='Planificada');
  const selectorOpts=STATE.torneos.map(t=>`<option value="${t.id}" ${t.id===torneoId?'selected':''}>${t.nombre}</option>`).join('');

  el.innerHTML=`
    <div style="margin-bottom:14px;">
      <label class="form-label">Torneo</label>
      <select class="form-select" style="width:100%;font-size:14px;" onchange="STATE.activeTorneoId=this.value;renderRanking()">
        ${selectorOpts}
      </select>
    </div>
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;gap:10px;">
        ${torneo.logoURL?`<img src="${torneo.logoURL}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0;"/>`:''}
        <span class="card-title" style="flex:1;">${torneo.logoURL?'':'🏆 '}${torneo.nombre}</span>
        <span class="text-11 text-muted">${oficiales}/${jugadasAll.length} partidas oficiales</span>
      </div>
      <div class="rank-head"><span>#</span><span>Jugador</span><span>Asist.</span><span>Total</span></div>
      ${rk.map(j=>`
        <div class="rank-row ${j.pos<=3?'top':''}">
          <div>${medal(j.pos)}</div>
          <div class="flex items-center gap-8">${j.fotoURL?`<img src="${j.fotoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${j.pos===1?'var(--gold)':'var(--border)'}"/>`:avatarHTML(j.foto,j.pos,'sm')}<div><div class="text-13 font-bold">${j.nombre}</div><div class="text-11 text-muted">${j.alias||''}</div></div></div>
          <div class="text-13 text-muted">${j.asist}✓</div>
          <div style="font-size:15px;font-weight:800;color:${j.pos===1?'var(--gold)':'var(--text)'};">${fmtPts(j.ptsT)}</div>
        </div>`).join('')}
    </div>
    ${jugadasAll.length>0?`
    <div class="card">
      <div class="card-header"><span class="card-title">📊 Desglose por Partida</span></div>
      <div style="overflow-x:auto;padding:12px;">
        <table class="breakdown-table" style="min-width:${100+jugadasAll.length*80}px;">
          <tr>
            <td style="padding:6px 8px;color:var(--muted);font-weight:700;white-space:nowrap;">Jugador</td>
            ${jugadasAll.map(jn=>`<td style="padding:6px 8px;text-align:center;color:var(--muted);font-weight:700;white-space:nowrap;min-width:70px;">${jn.sede}<br/>${badgeHTML(getEstadoJornada(jn))}</td>`).join('')}
            <td style="padding:6px 8px;text-align:center;color:var(--green);font-weight:700;">TOTAL</td>
          </tr>
          ${rk.map(j=>`
            <tr>
              <td style="padding:8px;font-weight:600;white-space:nowrap;">${j.nombre}</td>
              ${jugadasAll.map(jn=>{
                const jp=(j.jornadaPts||[]).find(p=>p.jornada_id===jn.id);
                if(!jp) return`<td style="padding:8px;text-align:center;color:var(--muted);">?</td>`;
                if(!jp.asistencia) return`<td style="padding:8px;text-align:center;color:var(--muted);">—</td>`;
                if(jp.dq) return`<td style="padding:8px;text-align:center;color:#C62828;">DQ</td>`;
                const col=jp.pts>=4?'var(--gold)':'var(--text)';
                return`<td style="padding:8px;text-align:center;color:${col};">${fmtPts(jp.pts)}</td>`;
              }).join('')}
              <td style="padding:8px;text-align:center;font-weight:800;color:${j.pos===1?'var(--gold)':'var(--text)'};">${fmtPts(j.ptsT)}</td>
            </tr>`).join('')}
        </table>
      </div>
    </div>`:''}
  `;
}

// ══════════════════════════════════════════════════════
// JORNADAS
// ══════════════════════════════════════════════════════
// Helper: club avatar for partida list
function clubAvatarHTML(sede){
  const cl=STATE.clubes.find(c=>c.nombre===sede);
  const bg=cl?.color||'#2E7D5E';
  const ini=cl?.iniciales||sede?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3)||'⛳';
  if(cl?.fotoURL) return`<img src="${cl.fotoURL}" style="width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid var(--border);"/>`;
  return`<div style="width:42px;height:42px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;background:${bg};">${ini}</div>`;
}

function renderJornadas(){
  const el=document.getElementById('tab-jornadas');
  const torneo_=getActiveTorneo();
  // Show only partidas from torneos the user admins or participates in
  const misTorneoIds=new Set(STATE.torneos.map(t=>t.id)); // ya filtrado por admins
  const myJugId=STATE.profile?.jugador_id;
  // Include jornada if: user is admin of its torneo OR user has a result in it
  const jornadasConResultado=myJugId?new Set(
    STATE.resultados.filter(r=>r.jugador_id===myJugId).map(r=>r.jornada_id)
  ):new Set();
  const misJornadas=STATE.jornadas.filter(j=>{
    if(j.torneo_id && misTorneoIds.has(j.torneo_id)) return true;  // admin del torneo
    if(jornadasConResultado.has(j.id)) return true;                // tiene resultado
    return false;
  });
  const jornadasOrdenadas=[...misJornadas].sort((a,b)=>{
    const da=a.fecha?(typeof a.fecha==='object'&&a.fecha.seconds?new Date(a.fecha.seconds*1000):new Date(a.fecha)):null;
    const db_=b.fecha?(typeof b.fecha==='object'&&b.fecha.seconds?new Date(b.fecha.seconds*1000):new Date(b.fecha)):null;
    if(!da) return 1; if(!db_) return -1;
    return da-db_;
  });

  el.innerHTML=`
    <div style="margin-bottom:14px;">
      <div class="text-15 font-bold" style="font-family:Georgia,serif;">Mis Partidas</div>
      <div class="text-12 text-muted">Partidas de los torneos en que participas</div>
    </div>
    ${jornadasOrdenadas.length===0?`<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:40px;">No hay partidas creadas aún.</div></div>`:''}
    ${jornadasOrdenadas.map(jn=>{
      const res=STATE.resultados.filter(r=>r.jornada_id===jn.id).sort((a,b)=>a.pos-b.pos);
      const isOpen=STATE.expandedJornada===jn.id;
      const cargador=getJugador(jn.cargado_por);
      const attestador=getJugador(jn.attest_por);
      const myJugadorId=STATE.profile?.jugador_id;
      const est=getEstadoJornada(jn);  // live computed estado
      // Per-jornada torneo permissions
      const torneoDeJornada=findTorneo(jn.torneo_id);
      const isAdminJornada=isTorneoAdmin(torneoDeJornada);
      const canCargarThis=canCargarTorneo(torneoDeJornada);
      const quienCarga=torneoDeJornada?.quienCargaResultados||'admins';
      const canAttest=(est==='Pendiente Attest'||est==='Por Validar')&&jn.cargado_por!==myJugadorId&&(isAdminJornada||STATE.resultados.some(r=>r.jornada_id===jn.id&&r.jugador_id===myJugadorId));
      const canCargar=est==='En Juego'&&(canCargarThis||(quienCarga==='cualquiera'&&STATE.profile?.jugador_id&&STATE.resultados.some(r=>r.jornada_id===jn.id&&r.jugador_id===myJugadorId)));
      // Build "quién puede cargar" label
      const quienPuedeMsj=quienCarga==='cualquiera'?'Cualquier participante puede cargar los resultados':
        'Solo el admin del torneo puede cargar resultados';

      return`
        <div class="partida-card" style="${est==='Jugado'||est==='Por Validar'?'border:2px solid #C8E6C9;':est==='En Juego'?'border:2px solid #FFE082;':''}">
          <div class="partida-header" onclick="toggleJornada('${jn.id}')" style="${est==='Jugado'||est==='Por Validar'?'background:linear-gradient(135deg,#F1F8E9,#E8F5E9);':est==='En Juego'?'background:linear-gradient(135deg,#FFFDE7,#FFF8E1);':''}"  >
            <div class="flex items-center gap-10" style="flex:1;min-width:0;">
              ${clubAvatarHTML(jn.sede)}
              <div style="flex:1;min-width:0;">
                <div class="text-14 font-bold" style="line-height:1.3;">
                  ${jn.sede||'Sin sede'}${jn.cuentaRanking===false?' 🚫':''}${jn.reglasOverride?` <span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;">⭐ Especial</span>`:''}
                </div>
                <div style="font-size:12px;color:var(--text2);font-weight:600;margin-top:2px;">${fmtFechaJornada(jn)}${jn.teeTime?' · ⏰ '+jn.teeTime:''}</div>
                ${jn.notas?`<div class="text-11 text-muted">${jn.notas}</div>`:''}
                ${(()=>{const t=findTorneo(jn.torneo_id);return t?`<div class="text-11" style="color:var(--green);font-weight:600;margin-top:1px;">🏆 ${t.nombre}</div>`:'';})()} 
              </div>
              ${jn.fotos&&jn.fotos.length>0?`<div style="display:flex;flex-direction:row;gap:0;flex-shrink:0;margin-left:4px;cursor:pointer;" onclick="event.stopPropagation();toggleJornada('${jn.id}')">${jn.fotos.slice(0,3).map((url,fi)=>'<img src="'+url+'" style="width:34px;height:34px;object-fit:cover;border-radius:6px;border:2px solid var(--white);'+(fi>0?'margin-left:-8px;':'')+'box-shadow:0 1px 3px rgba(0,0,0,0.15);"/>').join('')}</div>`:''}
            </div>
            <div class="flex items-center gap-6" style="flex-shrink:0;margin-left:8px;">
              ${badgeHTML(est)}
              ${isAdminJornada&&est!=='Jugado'&&est!=='Oficial'?`<button class="btn-outline" style="padding:4px 10px;font-size:12px;" onclick="event.stopPropagation();openModalJornada('${jn.id}')">✏️</button>`:''}              <span style="color:var(--muted);font-size:13px;">${isOpen?'▲':'▼'}</span>
            </div></div>
          ${isOpen?`
            <div class="partida-body">
              <div class="partida-actions">
                ${est==='En Juego'&&(isAdminJornada||quienCarga==='cualquiera')?`<button class="btn-primary" onclick="event.stopPropagation();goCargar('${jn.id}')">📋 Cargar Resultados</button>`:''}
                ${est==='En Juego'&&!isAdminJornada&&quienCarga!=='cualquiera'?`<div style="padding:6px 10px;background:#FFF8E1;border-radius:8px;border:1px solid #FFE082;font-size:12px;color:#5D4037;line-height:1.5;">⛳ <strong>Partida en juego</strong><br/>${quienPuedeMsj}</div>`:''}
                ${est==='Planificada'?`<div class="text-11 text-muted" style="padding:4px 0;">⏳ Aún no es el día de juego</div>`:''}
                ${(est==='Pendiente Attest'||est==='Por Validar')&&canAttest?`<button class="btn-attest" onclick="event.stopPropagation();handleAttest('${jn.id}')">✍️ Marcar como Jugada</button>`:''}
                ${(est==='Pendiente Attest'||est==='Por Validar')&&!canAttest&&res.length>0?`<div class="text-11 text-muted" style="padding:4px 0;">⏳ Esperando confirmación</div>`:''}
                ${(est==='Pendiente Attest'||est==='Por Validar')&&(isAdminJornada||canCargarThis)?`<button class="btn-outline" onclick="event.stopPropagation();goCargar('${jn.id}')">✏️ Editar resultados</button>`:''}
                ${isAdminJornada&&est!=='Jugado'&&est!=='Oficial'?`<button class="btn-danger" onclick="deleteJornada('${jn.id}')">🗑️ Eliminar</button>`:''}
              </div>
              ${res.length>0?`
                ${res.map(r=>{
                  const jug=getJugador(r.jugador_id);
                  const isTop=r.pos===1;
                  const isDQ=r.dq;
                  const noAsistio=!r.asistencia;
                  return`
                  <div class="result-row" style="${isTop?'background:linear-gradient(135deg,#FFFDE7,#FFF9C4);border-color:#F9A825;':''}${noAsistio?'opacity:0.6;':''}">
                    <div style="min-width:28px;text-align:center;">
                      ${r.pos<=3&&!noAsistio&&!isDQ?`<span style="font-size:20px;">${medal(r.pos)}</span>`:`<span style="background:var(--bg);border-radius:6px;padding:2px 6px;font-size:12px;font-weight:700;color:var(--muted);">${noAsistio?'–':isDQ?'DQ':r.pos+'°'}</span>`}
                    </div>
                    ${avatarHTML(jug?.foto||'?',r.pos,'sm')}
                    <div class="flex-1">
                      <div class="text-13 font-bold">${jug?.nombre||'Desconocido'}</div>
                      ${noAsistio?`<div class="text-11" style="color:var(--red);">No asistió</div>`:''}
                      ${isDQ?`<div class="text-11" style="color:var(--red);">Descalificado</div>`:''}
                    </div>
                    ${!noAsistio?`<div style="font-size:17px;font-weight:800;color:${isTop?'#B8860B':'var(--text)'};">${fmtPts(r.pts)}<span style="font-size:11px;font-weight:400;color:var(--muted);"> pts</span></div>`:''}
                  </div>`;}).join('')}
                <div style="margin-top:10px;padding:8px 12px;background:var(--cardL);border-radius:8px;font-size:11px;color:var(--muted);border:1px solid var(--border);">
                  ${cargador?`📋 Cargado por <strong style="color:var(--text);">${cargador.nombre}</strong>`:''}
                  ${attestador?` · ✍️ Attest: <strong style="color:#7B1FA2;">${attestador.nombre}</strong>`:''}
                </div>
` 
              :`<div style="padding:20px 0;text-align:center;color:var(--muted);font-size:13px;">
                ${jn.estado==='Planificada'?'⏳ Pendiente · Presiona "Cargar Resultados" al finalizar':'Sin resultados cargados'}
              </div>`}
              ${jn.fotos&&jn.fotos.length>0?`
              <div style="margin-top:12px;">
                <div class="text-11 text-muted font-bold" style="letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">📸 Fotos del día</div>
                <div style="position:relative;overflow:hidden;border-radius:12px;background:#111;cursor:pointer;" onclick="openCarousel('${jn.id}',0)">
                  <div id="carouselTrack_${jn.id}" style="display:flex;transition:transform 0.35s ease;">
                    ${jn.fotos.map(url=>'<img src="'+url+'" style="width:100%;flex-shrink:0;aspect-ratio:4/3;object-fit:cover;"/>').join('')}
                  </div>
                  ${jn.fotos.length>1?`
                  <button onclick="event.stopPropagation();slideCarousel('${jn.id}',-1)"
                    style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:26px;border-radius:50%;width:38px;height:38px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">&#8249;</button>
                  <button onclick="event.stopPropagation();slideCarousel('${jn.id}',1)"
                    style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:26px;border-radius:50%;width:38px;height:38px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">&#8250;</button>
                  <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:5px;">
                    ${jn.fotos.map((_,di)=>`<div id="dot_${jn.id}_${di}" style="width:7px;height:7px;border-radius:50%;background:${di===0?'#fff':'rgba(255,255,255,0.4)'}"></div>`).join('')}
                  </div>`:''}
                </div>
              </div>`:''}
            </div>`:``}
        </div>`;
    }).join('')}
  `;
}

function toggleJornada(id){ STATE.expandedJornada=STATE.expandedJornada===id?null:id; renderJornadas(); }

async function handleAttest(jornadaId){
  await db.collection('jornadas').doc(jornadaId).update({
    estado:'Jugado', attest_por:STATE.profile?.jugador_id||STATE.user.uid,
    attest_at:firebase.firestore.FieldValue.serverTimestamp()
  });
}
async function handleAprobar(jornadaId){
  await db.collection('jornadas').doc(jornadaId).update({
    estado:'Oficial', aprobado_por:STATE.user.uid,
    aprobado_at:firebase.firestore.FieldValue.serverTimestamp()
  });
}
async function deleteJornada(id){
  if(!confirm('¿Eliminar esta partida y sus resultados?'))return;
  const batch=db.batch();
  batch.delete(db.collection('jornadas').doc(id));
  STATE.resultados.filter(r=>r.jornada_id===id).forEach(r=>batch.delete(db.collection('resultados').doc(r.id)));
  await batch.commit();
}
