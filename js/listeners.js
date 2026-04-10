// ══════════════════════════════════════════════════════
// GOLFEADOS — Firestore Listeners
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// FIRESTORE LISTENERS
// ══════════════════════════════════════════════════════
function initListeners(){
  stopListeners();
  const uid=STATE.user?.uid;
  const isPlataformaAdmin=STATE.profile?.role==='admin';

  // Initialize linked_jugador_ids: find ALL jugadores linked to this user
  if(uid){
    STATE.linked_jugador_ids=new Set();
    if(STATE.profile?.jugador_id) STATE.linked_jugador_ids.add(STATE.profile.jugador_id);
    STATE.linked_jugador_ids.add(uid); // auto-jugador
    // Query Firestore for all jugadores with this user_uid
    db.collection('jugadores').where('user_uid','==',uid).get().then(snap=>{
      snap.docs.forEach(d=>STATE.linked_jugador_ids.add(d.id));
      console.log('[initListeners] linked_jugador_ids:', Array.from(STATE.linked_jugador_ids));
      _filterMyTorneos();
      renderCurrentTab();
    }).catch(e=>console.warn('linked jugadores query error:',e));
  }

  if(isPlataformaAdmin){
    // Admin de plataforma: read all (broad queries)
    _initBroadListeners(uid,true);
  } else {
    // Usuario normal: scoped queries que cumplen con las reglas de Firestore
    _initScopedListeners(uid);
  }
}

// ─── Broad listeners (only for platform admin) ─────────────
function _initBroadListeners(uid,isAdmin){
  STATE.unsubs.push(db.collection('torneos').orderBy('creado','desc')
    .onSnapshot(s=>{
      STATE.torneos=s.docs.map(d=>({id:d.id,...d.data()}));
      STATE.allTorneos=STATE.torneos; // admin sees all
      STATE.torneo=STATE.torneos.find(t=>t.estado==='Activo'||t.estado==='activo')||STATE.torneos[0]||null;
      if(!STATE.activeTorneoId&&STATE.torneo) STATE.activeTorneoId=STATE.torneo.id;
      if(STATE._connSetOnline)STATE._connSetOnline();
      subscribeParticipantes();
      renderCurrentTab();
    },err=>{
      console.error('torneos broad error:',err);
      // Fallback to scoped queries even for admin
      _initScopedListeners(uid);
    }));
  STATE.unsubs.push(db.collection('jornadas').orderBy('fecha')
    .onSnapshot(s=>{ STATE.jornadas=s.docs.map(d=>({id:d.id,...d.data()})); renderCurrentTab(); },
    err=>console.warn('jornadas error:',err)));
  STATE.unsubs.push(db.collection('resultados')
    .onSnapshot(s=>{ STATE.resultados=s.docs.map(d=>({id:d.id,...d.data()})); if(STATE._connSetOnline)STATE._connSetOnline(); renderCurrentTab(); },
    err=>console.warn('resultados error:',err)));
  STATE.unsubs.push(db.collection('clubes').orderBy('nombre')
    .onSnapshot(s=>{ STATE.clubes=s.docs.map(d=>({id:d.id,...d.data()})); renderCurrentTab(); },
    err=>console.warn('clubes error:',err)));
  ensureJugadoresGlobal();
}

// ─── Scoped listeners (for regular users) ──────────────────
// Load ALL torneos (rules allow read for authenticated users), filter client-side
let _torneosMergeMap={};
let _torneosReadyCount=0;
const _TORNEO_QUERY_COUNT=4;

function _initScopedListeners(uid){
  // Load ALL torneos broadly — Firestore rules allow read for any authenticated user
  STATE.unsubs.push(db.collection('torneos').orderBy('creado','desc')
    .onSnapshot(s=>{
      STATE.allTorneos=s.docs.map(d=>({id:d.id,...d.data()}));
      _filterMyTorneos();
      subscribeParticipantes();
      renderCurrentTab();
    },err=>{
      console.warn('torneos broad (user) error:',err.message||err);
      // Fallback: 4 parallel scoped queries
      _initScopedQueriesFallback(uid);
    }));

  // JORNADAS
  STATE.unsubs.push(db.collection('jornadas').orderBy('fecha')
    .onSnapshot(s=>{
      STATE.jornadas=s.docs.map(d=>({id:d.id,...d.data()}));
      _filterMyTorneos();
      renderCurrentTab();
    },err=>{
      console.warn('jornadas error:',err.message||err);
      _loadJornadasPerTorneo();
    }));

  // RESULTADOS
  STATE.unsubs.push(db.collection('resultados')
    .onSnapshot(s=>{
      STATE.resultados=s.docs.map(d=>({id:d.id,...d.data()}));
      if(STATE._connSetOnline)STATE._connSetOnline();
      _filterMyTorneos();
      renderCurrentTab();
    },err=>{
      console.warn('resultados error:',err.message||err);
      _loadResultadosPerTorneo();
    }));

  // CLUBES
  STATE.unsubs.push(db.collection('clubes').orderBy('nombre')
    .onSnapshot(s=>{ STATE.clubes=s.docs.map(d=>({id:d.id,...d.data()})); renderCurrentTab(); },
    err=>console.warn('clubes error:',err.message||err)));

  ensureJugadoresGlobal();
}

// Filter allTorneos → STATE.torneos: only torneos user is involved in
function _filterMyTorneos(){
  if(!STATE.allTorneos||STATE.allTorneos.length===0) return;
  // Platform admin sees ALL torneos — no filtering needed
  if(STATE.profile?.role==='admin'){
    STATE.torneos=STATE.allTorneos;
    STATE.torneo=STATE.torneos.find(t=>t.estado==='Activo'||t.estado==='activo')||STATE.torneos[0]||null;
    if(!STATE.activeTorneoId&&STATE.torneo) STATE.activeTorneoId=STATE.torneo.id;
    return;
  }
  const uid=STATE.user?.uid;
  const jugadorId=STATE.profile?.jugador_id;

  // Build complete set of jugador IDs linked to this user
  const allMyIds=new Set(STATE.linked_jugador_ids);
  if(jugadorId) allMyIds.add(jugadorId);
  if(uid) allMyIds.add(uid); // auto-jugador has id = uid

  // Torneos where user has results (check ALL linked jugador IDs)
  const torneoIdsFromResults=new Set();
  if(allMyIds.size>0 && STATE.jornadas.length>0 && STATE.resultados.length>0){
    const myJornadaIds=new Set(
      STATE.resultados.filter(r=>allMyIds.has(r.jugador_id)).map(r=>r.jornada_id)
    );
    STATE.jornadas.forEach(j=>{
      if(myJornadaIds.has(j.id) && j.torneo_id) torneoIdsFromResults.add(j.torneo_id);
    });
  }

  // Torneos where user is in participantes subcollection
  const torneoIdsFromParticipantes=new Set();
  for(const [tid, jugs] of Object.entries(STATE.jugadores_by_torneo||{})){
    if(jugs.some(j=>
      j.user_uid===uid
      || allMyIds.has(j.jugador_id)
      || allMyIds.has(j.id)
    )){
      torneoIdsFromParticipantes.add(tid);
    }
  }

  STATE.torneos=STATE.allTorneos.filter(t=>{
    if(t.creado_por===uid) return true;
    if(t.adminId===uid) return true;
    if((t.admins||[]).includes(uid)) return true;
    if((t.cargadores||[]).includes(uid)) return true;
    if(torneoIdsFromParticipantes.has(t.id)) return true;
    if(torneoIdsFromResults.has(t.id)) return true;
    return false;
  });

  STATE.torneo=STATE.torneos.find(t=>t.estado==='Activo'||t.estado==='activo')||STATE.torneos[0]||null;
  if(!STATE.activeTorneoId&&STATE.torneo) STATE.activeTorneoId=STATE.torneo.id;
}

// Fallback: 4 parallel scoped queries if broad torneos read fails
function _initScopedQueriesFallback(uid){
  _torneosMergeMap={};
  _torneosReadyCount=0;
  [
    db.collection('torneos').where('creado_por','==',uid),
    db.collection('torneos').where('adminId','==',uid),
    db.collection('torneos').where('admins','array-contains',uid),
    db.collection('torneos').where('cargadores','array-contains',uid)
  ].forEach(q=>{
    STATE.unsubs.push(q.onSnapshot(s=>{
      s.docs.forEach(d=>{ _torneosMergeMap[d.id]={id:d.id,...d.data()}; });
      _torneosReadyCount++;
      _syncTorneos();
    },err=>{ _torneosReadyCount++; _syncTorneos(); }));
  });
}

// Merge and sync torneos from scoped queries
function _syncTorneos(){
  const arr=Object.values(_torneosMergeMap);
  arr.sort((a,b)=>((b.creado?.seconds||0)-(a.creado?.seconds||0)));
  STATE.torneos=arr;
  STATE.torneo=STATE.torneos.find(t=>t.estado==='Activo'||t.estado==='activo')||STATE.torneos[0]||null;
  if(!STATE.activeTorneoId&&STATE.torneo) STATE.activeTorneoId=STATE.torneo.id;
  if(STATE._connSetOnline)STATE._connSetOnline();
  subscribeParticipantes();
  renderCurrentTab();
}

// Fallback: load jornadas per-torneo (when broad query fails)
function _loadJornadasPerTorneo(){
  const ids=STATE.torneos.map(t=>t.id);
  if(!ids.length) return;
  // Firestore 'in' supports up to 30 values — batch if needed
  const batches=[];
  for(let i=0;i<ids.length;i+=30) batches.push(ids.slice(i,i+30));
  STATE.jornadas=[];
  batches.forEach(batch=>{
    db.collection('jornadas').where('torneo_id','in',batch).get().then(s=>{
      const newJornadas=s.docs.map(d=>({id:d.id,...d.data()}));
      // Merge without duplicates
      const existing=new Set(STATE.jornadas.map(j=>j.id));
      newJornadas.forEach(j=>{ if(!existing.has(j.id)) STATE.jornadas.push(j); });
      STATE.jornadas.sort((a,b)=>{
        const fa=a.fecha?.seconds||0, fb=b.fecha?.seconds||0;
        return fa-fb;
      });
      renderCurrentTab();
    }).catch(e=>console.warn('jornadas per-torneo fallback:',e.message||e));
  });
}

// Fallback: load resultados for known jornadas (when broad query fails)
function _loadResultadosPerTorneo(){
  const jids=STATE.jornadas.map(j=>j.id);
  if(!jids.length){
    // Jornadas might not be loaded yet — retry after short delay
    setTimeout(_loadResultadosPerTorneo,2000);
    return;
  }
  const batches=[];
  for(let i=0;i<jids.length;i+=30) batches.push(jids.slice(i,i+30));
  STATE.resultados=[];
  batches.forEach(batch=>{
    db.collection('resultados').where('jornada_id','in',batch).get().then(s=>{
      const newRes=s.docs.map(d=>({id:d.id,...d.data()}));
      const existing=new Set(STATE.resultados.map(r=>r.id));
      newRes.forEach(r=>{ if(!existing.has(r.id)) STATE.resultados.push(r); });
      if(STATE._connSetOnline)STATE._connSetOnline();
      renderCurrentTab();
    }).catch(e=>console.warn('resultados per-torneo fallback:',e.message||e));
  });
}

// Subscribe to participantes subcollection for ALL torneos (to discover participation)
let _participantesUnsubs={};  // { torneoId: unsubFn }
let _participantesTorneoId=null;  // kept for compat
function subscribeParticipantes(){
  // Use allTorneos if populated, else fall back to filtered torneos
  const source=(STATE.allTorneos&&STATE.allTorneos.length>0)?STATE.allTorneos:STATE.torneos||[];
  if(source.length===0) return;
  const uid=STATE.user?.uid;
  source.forEach(t=>{
    const tid=t.id;
    if(_participantesUnsubs[tid]) return; // already subscribed
    _participantesUnsubs[tid]=db.collection('torneos').doc(tid)
      .collection('participantes').orderBy('nombre')
      .onSnapshot(s=>{
        const jugs=s.docs.map(d=>({id:d.id,...d.data()}));
        STATE.jugadores_by_torneo[tid]=jugs;
        if(tid===STATE.activeTorneoId){
          STATE.jugadores=jugs;
        }
        // Discover linked jugador IDs from participantes
        if(uid){
          jugs.forEach(j=>{
            if(j.user_uid===uid){
              STATE.linked_jugador_ids.add(j.id);
              if(j.jugador_id) STATE.linked_jugador_ids.add(j.jugador_id);
            }
          });
        }
        // Re-filter torneos: might discover user is participant in this torneo
        _filterMyTorneos();
        renderCurrentTab();
      }, err=>console.error('participantes['+tid+'] error:',err));
  });
  if(STATE.activeTorneoId && STATE.jugadores_by_torneo[STATE.activeTorneoId]){
    STATE.jugadores=STATE.jugadores_by_torneo[STATE.activeTorneoId];
  }
}

// Call when active torneo changes (tab switch, etc)
function switchActiveTorneo(tid){
  if(STATE.activeTorneoId===tid) return;
  STATE.activeTorneoId=tid;
  STATE.torneo=STATE.torneos.find(t=>t.id===tid)||null;
  STATE.jugadores=[];
  _participantesTorneoId=null;
  subscribeParticipantes();
  renderCurrentTab();
}

function stopListeners(){
  STATE.unsubs.forEach(u=>u()); STATE.unsubs=[];
  Object.values(_participantesUnsubs).forEach(u=>{ try{u();}catch(e){} });
  _participantesUnsubs={};
  _participantesTorneoId=null;
  _jugadoresGlobalUnsub=null;
  STATE.jugadores_by_torneo={};
  STATE.jugadores_global=[];
  STATE.allTorneos=[];
  STATE.linked_jugador_ids=new Set();
  STATE.users_cache={};
  STATE._jugadorToUserMap={};
  STATE._lastEnrichTime=0;
  STATE._expandedJugTorneo=null;
  _torneosMergeMap={};
  _torneosReadyCount=0;
}
