// ══════════════════════════════════════════════════════
// GOLFEADOS — Auth & User Management
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// AUTH — Multi-method login + Registration + Verification
// ══════════════════════════════════════════════════════

// Show/hide login views
// ── Google Sign-In ─────────────────────────────────
async function handleGoogleSignIn(){
  const errEl=document.getElementById('loginError')||document.getElementById('registerError');
  if(errEl) errEl.style.display='none';
  try{
    const provider=new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    // signInWithPopup is more reliable on mobile than redirect
    // It works because it's called directly from a user tap (no await before it)
    await auth.signInWithPopup(provider);
    // onAuthStateChanged handles the rest automatically
  }catch(e){
    if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request') return;
    if(e.code==='auth/popup-blocked'){
      // Popup was blocked by browser — fall back to redirect
      const provider2=new firebase.auth.GoogleAuthProvider();
      await auth.signInWithRedirect(provider2);
      return;
    }
    if(errEl){ errEl.textContent='Error con Google: '+e.message; errEl.style.display='block'; }
  }
}

// ── Invite Code (Vincular cuenta) ──────────────────
function showVincular(){ showLoginView('vincularView'); }
function showVincularModal(){
  const existing=document.getElementById('vincularModal');
  if(existing){ existing.style.display='flex'; return; }
  const m=document.createElement('div');
  m.id='vincularModal';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  m.innerHTML=`<div style="background:var(--white);border-radius:20px;padding:28px 24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:40px;margin-bottom:8px;">⛳</div>
      <div style="font-size:16px;font-weight:700;color:var(--green);">Vincular perfil de jugador</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5;">Ingresa el código que te envió el administrador para ver tus estadísticas y puntos.</div>
    </div>
    <div id="vincularModalError" class="error-box" style="display:none;margin-bottom:12px;"></div>
    <input type="text" id="vincularModalCodigo" placeholder="GOLF-XXXX"
      style="width:100%;padding:14px;text-align:center;font-size:20px;font-weight:700;letter-spacing:3px;text-transform:uppercase;border:2px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);margin-bottom:12px;"
      oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9-]/g,'')"/>
    <button class="btn-login" id="vincularModalBtn" onclick="handleVincularModal()">Vincular 🏌️</button>
    <button class="btn-link" style="margin-top:8px;" onclick="document.getElementById('vincularModal').style.display='none'">Saltar por ahora</button>
  </div>`;
  document.body.appendChild(m);
}
async function handleVincularModal(){
  const code=document.getElementById('vincularModalCodigo').value.trim().toUpperCase();
  const err=document.getElementById('vincularModalError');
  const btn=document.getElementById('vincularModalBtn');
  err.style.display='none';
  if(!code||code.length<6){err.textContent='Ingresa el código.';err.style.display='block';return;}
  btn.disabled=true;btn.textContent='Verificando...';
  try{
    await vincularCodigo(code);
    document.getElementById('vincularModal').style.display='none';
    const vb=document.getElementById('vincularBadge');
    if(vb) vb.style.display='none';
    _filterMyTorneos();
    renderCurrentTab();
  }catch(e){
    const msg=e.message==='INVALID_CODE'?'Código inválido. Verifica con tu admin.'
      :e.message==='CODE_USED'?'Este código ya fue usado.'
      :'Error: '+e.message;
    err.textContent=msg;err.style.display='block';
  }finally{btn.disabled=false;btn.textContent='Vincular 🏌️';}
}
async function handleCompletarPerfil(){
  const nombre=document.getElementById('completarNombre').value.trim();
  const username=document.getElementById('completarUsername').value.trim().toLowerCase();
  const tel=document.getElementById('completarTel').value.trim();
  const pais=document.getElementById('completarPais').value;
  const err=document.getElementById('completarPerfilError');
  const btn=document.getElementById('completarBtn');
  err.style.display='none';
  if(!nombre){err.textContent='El nombre es obligatorio.';err.style.display='block';return;}
  if(!username||username.length<3){err.textContent='El usuario debe tener mínimo 3 caracteres.';err.style.display='block';return;}
  btn.disabled=true; btn.textContent='Guardando...';
  try{
    // Check username availability
    const usnap=await db.collection('users').where('username','==',username).limit(1).get();
    if(!usnap.empty){err.textContent='Ese usuario ya está tomado.';err.style.display='block';btn.disabled=false;btn.textContent='Entrar al Club 🏌️';return;}
    const upd={nombre, username, verified:true};
    if(tel){
      const telCompleto=normalizeTelVE(tel,pais);
      upd.telefono=tel; upd.codigoPais=pais; upd.telefonoCompleto=pais+tel; upd.phoneVerified=false;
    }
    await db.collection('users').doc(STATE.user.uid).update(upd);
    await STATE.user.updateProfile({displayName:nombre});
    STATE.profile={...STATE.profile,...upd};
    // Auto-create jugador profile (every user = jugador)
    await ensureAutoJugador(STATE.user.uid, STATE.profile);
    showApp_();
    initListeners();
  }catch(e){err.textContent='Error: '+e.message;err.style.display='block';btn.disabled=false;btn.textContent='Entrar al Club 🏌️';}
}

function skipVincular(){
  // User skips — goes to main app without jugador linked
  // Mark as skipped so we don't ask again every login
  if(STATE.user) db.collection('users').doc(STATE.user.uid).update({vincular_skipped:true}).catch(()=>{});
  if(STATE.profile) STATE.profile.vincular_skipped=true;
  showApp_();
  initListeners();
}
async function handleVincular(){
  const code=document.getElementById('vincularCodigo').value.trim().toUpperCase();
  const err=document.getElementById('vincularError');
  const btn=document.getElementById('vincularBtn');
  err.style.display='none';
  if(!code||code.length<6){ err.textContent='Ingresa el código de invitación.'; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='Verificando...';
  try{
    await vincularCodigo(code);
    STATE.profile.vincular_skipped=false;
    await db.collection('users').doc(STATE.user.uid).update({vincular_skipped:false}).catch(()=>{});
    document.getElementById('loginScreen').style.display='none';
    showApp_();
    initListeners();
  }catch(e){
    const msg=e.message==='INVALID_CODE'?'Código inválido. Verifica con tu administrador.'
      :e.message==='CODE_USED'?'Este código ya fue usado.'
      :'Error: '+e.message;
    err.textContent=msg; err.style.display='block';
  }finally{ btn.disabled=false; btn.textContent='Vincular mi perfil 🏌️'; }
}

// ── Sync user profile data to linked jugador + all participantes ──
// Uses set({merge:true}) which is more permissive than update()
async function _syncLinkedPlayerData(jugadorId, uid){
  console.log('[sync] START jugadorId='+jugadorId+' uid='+uid);
  const profile=STATE.profile||{};
  const user=STATE.user;
  const nombre=profile.nombre||user?.displayName||'';
  const alias=profile.username||profile.alias||nombre.split(' ')[0]||'';
  const foto=nombre.split(' ').filter(Boolean).map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?';

  const profileData={
    nombre, alias, foto,
    nombre_lower:nombre.toLowerCase(),
    email:profile.email||user?.email||'',
    telefonoCompleto:profile.telefonoCompleto||'',
    telefono:profile.telefono||'',
    codigoPais:profile.codigoPais||'',
    handicap:profile.handicap||0,
    fotoURL:profile.fotoURL||user?.photoURL||null
  };
  console.log('[sync] profileData nombre='+nombre+' alias='+alias);

  // ═══ Write jugador global doc: user_uid + profile data (single set+merge) ═══
  try{
    await db.collection('jugadores').doc(jugadorId).set(
      {user_uid:uid, ...profileData}, {merge:true}
    );
    console.log('[sync] jugador doc set+merge OK');
  }catch(e){
    console.error('[sync] jugador doc FAILED:', e.message);
    // Fallback: try user_uid only
    try{
      await db.collection('jugadores').doc(jugadorId).set({user_uid:uid},{merge:true});
      console.log('[sync] jugador doc user_uid-only fallback OK');
    }catch(e2){
      console.error('[sync] jugador doc user_uid-only ALSO FAILED:', e2.message);
      alert('[DEBUG] No se pudo escribir en jugador doc: '+e2.message);
    }
  }

  // ═══ Write participante docs in ALL torneos ═══
  const partData={user_uid:uid, nombre, alias, foto, fotoURL:profileData.fotoURL, telefonoCompleto:profileData.telefonoCompleto};
  const allTids=new Set();
  (STATE.allTorneos||[]).forEach(t=>allTids.add(t.id));
  (STATE.torneos||[]).forEach(t=>allTids.add(t.id));
  Object.keys(STATE.jugadores_by_torneo||{}).forEach(tid=>allTids.add(tid));

  let updated=0;
  for(const tid of allTids){
    try{
      const pRef=db.collection('torneos').doc(tid).collection('participantes').doc(jugadorId);
      const pDoc=await pRef.get();
      if(!pDoc.exists) continue;
      // set+merge on participante
      await pRef.set(partData, {merge:true});
      updated++;
      console.log('[sync] participante OK in '+tid);
    }catch(e){
      console.warn('[sync] participante FAIL in '+tid+':', e.message);
      // Fallback: try user_uid only on participante
      try{
        await db.collection('torneos').doc(tid).collection('participantes').doc(jugadorId)
          .set({user_uid:uid},{merge:true});
        updated++;
      }catch(e2){ console.warn('[sync] participante user_uid-only also failed '+tid); }
    }
  }

  // If found nothing, do full Firestore scan
  if(updated===0){
    console.warn('[sync] 0 participantes in cache, scanning ALL torneos...');
    try{
      const allSnap=await db.collection('torneos').orderBy('creado','desc').get();
      for(const tDoc of allSnap.docs){
        if(allTids.has(tDoc.id)) continue;
        try{
          const pRef=db.collection('torneos').doc(tDoc.id).collection('participantes').doc(jugadorId);
          const pDoc=await pRef.get();
          if(!pDoc.exists) continue;
          await pRef.set(partData, {merge:true}).catch(()=>{});
          updated++;
        }catch(e2){/* skip */}
      }
    }catch(e3){ console.warn('[sync] full scan failed:', e3.message); }
  }

  // ═══ Update local caches (instant UI) ═══
  const fullLocal={user_uid:uid, ...profileData};
  for(const [tid, jugs] of Object.entries(STATE.jugadores_by_torneo||{})){
    const p=jugs.find(j=>j.id===jugadorId||j.jugador_id===jugadorId);
    if(p) Object.assign(p, fullLocal);
  }
  const gIdx=(STATE.jugadores_global||[]).findIndex(j=>j.id===jugadorId);
  if(gIdx>=0) Object.assign(STATE.jugadores_global[gIdx], fullLocal);
  else STATE.jugadores_global.push({id:jugadorId, ...fullLocal});

  console.log('[sync] DONE. '+updated+' participante docs updated');
}

// ── Unified vincular function ───────────────────────
// Handles first vincular AND subsequent ones correctly
async function vincularCodigo(code){
  console.log('[vincularCodigo] code='+code);
  const snap=await db.collection('jugadores').where('invite_code','==',code).limit(1).get();
  if(snap.empty) throw new Error('INVALID_CODE');
  const jugDoc=snap.docs[0];
  if(jugDoc.data().user_uid) throw new Error('CODE_USED');

  const uid=STATE.user.uid;
  const manualId=jugDoc.id;
  const existingJugadorId=STATE.profile?.jugador_id;
  const isFirstVincular=!existingJugadorId || existingJugadorId===uid;
  console.log('[vincularCodigo] uid='+uid+' manualId='+manualId+' isFirst='+isFirstVincular);

  // ═══ STEP 1: Write to OWN user doc (ALWAYS succeeds) ═══
  try{
    const userUpd={
      linked_jugadores: firebase.firestore.FieldValue.arrayUnion(manualId),
      has_linked_jugadores: true
    };
    if(isFirstVincular) userUpd.jugador_id=manualId;
    await db.collection('users').doc(uid).update(userUpd);
    if(isFirstVincular) STATE.profile.jugador_id=manualId;
    console.log('[vincularCodigo] users/{uid} updated OK');
  }catch(e){
    console.error('[vincularCodigo] users/{uid} update FAILED:', e.message);
  }

  STATE.linked_jugador_ids.add(manualId);

  // ═══ STEP 2: Write user_uid to jugador doc (best effort) ═══
  try{
    await db.collection('jugadores').doc(manualId).set({user_uid:uid},{merge:true});
    console.log('[vincularCodigo] jugadores/{manualId}.user_uid OK');
  }catch(e){
    console.warn('[vincularCodigo] jugadores/{manualId} write failed (permissions?):', e.message);
  }

  // ═══ STEP 3: Delete auto-jugador if first vincular ═══
  if(isFirstVincular && manualId!==uid){
    await db.collection('jugadores').doc(uid).delete().catch(()=>{});
  }

  // ═══ STEP 4: Sync full profile data to jugador + participantes (best effort) ═══
  await _syncLinkedPlayerData(manualId, uid);

  // Re-filter torneos
  _filterMyTorneos();
  console.log('[vincularCodigo] Done. torneos='+STATE.torneos.length);

  return { manualId, nombre: STATE.profile?.nombre||jugDoc.data().nombre||manualId, isFirstVincular };
}

// ── Generate invite code ────────────────────────────
function generateInviteCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0,O,1,I)
  let code='GOLF-';
  for(let i=0;i<4;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}

// ── Auto-create jugador profile ─────────────────────
// Every registered user gets a jugador/{uid} doc automatically
async function ensureAutoJugador(uid, profileData){
  if(!uid) return;
  try{
    const jugRef=db.collection('jugadores').doc(uid);
    const existing=await jugRef.get();
    if(existing.exists) return; // already has auto-jugador
    const nombre=profileData?.nombre||'';
    const jugData={
      nombre,
      alias:profileData?.alias||nombre.split(' ')[0]||'',
      foto:nombre.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?',
      nombre_lower:(nombre||'').toLowerCase(),
      email:profileData?.email||'',
      user_uid:uid,
      telefonoCompleto:profileData?.telefonoCompleto||'',
      telefono:profileData?.telefono||'',
      codigoPais:profileData?.codigoPais||'',
      handicap:profileData?.handicap||0,
      fotoURL:profileData?.fotoURL||null,
      invite_code:null, // auto-created jugadores don't need invite codes
      creado:firebase.firestore.FieldValue.serverTimestamp()
    };
    await jugRef.set(jugData);
    // Also update user profile to link jugador_id = uid
    await db.collection('users').doc(uid).update({jugador_id:uid}).catch(()=>{});
    if(STATE.profile) STATE.profile.jugador_id=uid;
    // Add to local cache
    STATE.jugadores_global.push({id:uid,...jugData});
    console.log('[ensureAutoJugador] Created jugador profile for uid:',uid);
  }catch(e){
    console.error('ensureAutoJugador error:',e);
  }
}

function showLoginView(id){
  ['loginView','registerView','verifyChoiceView','smsCodeView',
   'emailSentView','pendingVerifyView','resetView','vincularView','completarPerfilView'].forEach(v=>{
    const el=document.getElementById(v);
    if(el) el.style.display=v===id?'block':'none';
  });
}
function showLogin(){ showLoginView('loginView'); }
function showRegister(){ showLoginView('registerView'); }
function showVerifyChoice(){ showLoginView('verifyChoiceView'); }

// ─── onAuthStateChanged ───────────────────────────────
auth.onAuthStateChanged(async user=>{
  if(user){
    STATE.user=user;
    try{
      // Load or create user profile
      const snap=await db.collection('users').doc(user.uid).get();
      if(snap.exists){
        STATE.profile=snap.data();
      } else {
        const p={email:user.email,nombre:user.displayName||user.email,
                 role:'jugador',jugador_id:user.uid,verified:false,username:''};
        await db.collection('users').doc(user.uid).set(p);
        STATE.profile=p;
        // Auto-create jugador for brand new user
        await ensureAutoJugador(user.uid, p);
      }
      // Google users are auto-verified
      const isGoogle=user.providerData&&user.providerData[0]&&user.providerData[0].providerId==='google.com';
      if(isGoogle && !STATE.profile.verified){
        await db.collection('users').doc(user.uid).update({verified:true}).catch(()=>{});
        STATE.profile.verified=true;
      }
      // Ensure existing users have a jugador profile (migration)
      if(STATE.profile.jugador_id!==user.uid){
        // User exists but might not have auto-jugador yet
        ensureAutoJugador(user.uid, STATE.profile); // fire-and-forget for migration
      }
      // Check email verification (skip for Google, phone-verified, or legacy accounts)
      await user.reload();
      const emailVerif=user.emailVerified;
      const phoneVerif=STATE.profile?.phoneVerified||false;
      const isLegacy=STATE.profile?.legacy||false;
      if(!emailVerif && !phoneVerif && !isLegacy && !isGoogle){
        showLogin_();
        document.getElementById('loginScreen').style.display='flex';
        document.getElementById('verifyEmailAddr').textContent=user.email||'';
        const tc=STATE.profile?.telefonoCompleto;
        if(tc) document.getElementById('verifyPhoneNum').textContent=tc;
        showLoginView('pendingVerifyView');
        return;
      }
      // New Google user with no username → must complete profile first
      if(isGoogle && !STATE.profile.username){
        document.getElementById('loginScreen').style.display='flex';
        document.getElementById('app').style.display='none';
        document.getElementById('completarNombre').value=user.displayName||'';
        showLoginView('completarPerfilView');
        return;
      }
      // All good — enter app
      showApp_();
      initListeners();
    }catch(e){
      console.error('Auth state error:',e);
      // Show error but don't crash — user is authenticated, try to continue
      if((e.code==='permission-denied'||(e.message||'').includes('permission'))&&!STATE.profile){
        // Can't read profile — create minimal fallback
        STATE.profile={email:user.email,nombre:user.displayName||user.email,role:'jugador',jugador_id:null};
      }
      showApp_();
      initListeners();
    }
    // Note: vincular (invite code linking) is done from INSIDE the app
  } else {
    STATE.user=null; STATE.profile=null;
    stopListeners(); showLogin_();
  }
});

function showLogin_(){
  document.getElementById('loading').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('app').style.display='none';
  showLoginView('loginView');
}

function showApp_(){
  document.getElementById('loading').style.display='none';
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('headerUser').textContent=STATE.profile?.username||STATE.profile?.alias||STATE.profile?.nombre?.split(' ')[0]||STATE.user?.email||'';
  document.getElementById('adminBadge').style.display=STATE.profile?.role==='admin'?'inline':'none';
  const navClubes=document.getElementById('navClubes');
  if(navClubes) navClubes.style.display=STATE.profile?.role==='admin'?'':'none';
  const navAdminWallet=document.getElementById('navAdminWallet');
  if(navAdminWallet) navAdminWallet.style.display=STATE.profile?.role==='admin'?'':'none';
  const navAdminUsers=document.getElementById('navAdminUsers');
  if(navAdminUsers) navAdminUsers.style.display=STATE.profile?.role==='admin'?'':'none';
  // Show vincular badge if no jugador linked
  const vBadge=document.getElementById('vincularBadge');
  if(vBadge) vBadge.style.display=(!STATE.profile?.jugador_id&&STATE.profile?.role!=='admin')?'inline-flex':'none';
  initConnectionMonitor();
  initUpdateChecker();
}

// Keep showApp as alias
function showApp(){ showApp_(); }

// ─── LOGIN: email / username / phone ─────────────────
function updateLoginHint(input){
  const v=input.value.trim();
  const hint=document.getElementById('loginHint');
  if(!v){ hint.textContent=''; return; }
  if(v.includes('@')&&v.includes('.')){ hint.textContent='📧 Entrando con email'; }
  else if(/^[+0-9]/.test(v)){ hint.textContent='📱 Entrando con teléfono'; }
  else { hint.textContent='👤 Entrando con usuario'; }
}

async function resolveEmail(identifier){
  // Returns email for any identifier type
  if(identifier.includes('@')&&identifier.includes('.')) return identifier;
  // Search Firestore users (may fail if rules require auth)
  try{
    let snap;
    if(/^[+0-9]/.test(identifier)){
      // Phone: normalize
      const normalized=identifier.replace(/[^0-9+]/g,'');
      snap=await db.collection('users').where('telefonoCompleto','==',normalized).limit(1).get();
      if(snap.empty){
        // Try without country code variants
        snap=await db.collection('users').where('telefono','==',normalized.replace(/^\+[0-9]{1,3}/,'')).limit(1).get();
      }
    } else {
      // Username: strip leading @
      const uname=identifier.replace(/^@/,'').toLowerCase();
      snap=await db.collection('users').where('username','==',uname).limit(1).get();
    }
    if(!snap||snap.empty) return null;
    return snap.docs[0].data().email||null;
  }catch(e){
    console.warn('resolveEmail permission error:',e.message||e);
    // Firestore rules may block pre-auth reads — throw specific error
    if(e.code==='permission-denied'||(e.message||'').includes('permission')){
      throw new Error('Para entrar con usuario o teléfono, usa tu email directamente. Las reglas de seguridad no permiten búsquedas sin autenticación.');
    }
    throw e;
  }
}

async function handleLogin(){
  const identifier=document.getElementById('loginIdentifier').value.trim();
  const pass=document.getElementById('loginPassword').value;
  const btn=document.getElementById('loginBtn');
  const err=document.getElementById('loginError');
  err.style.display='none'; btn.disabled=true; btn.textContent='Entrando...';
  try{
    const email=await resolveEmail(identifier);
    if(!email){ err.textContent='Usuario no encontrado.'; err.style.display='block'; return; }
    await auth.signInWithEmailAndPassword(email,pass);
  }catch(e){
    const m={
      'auth/user-not-found':'Usuario no encontrado.',
      'auth/wrong-password':'Contraseña incorrecta.',
      'auth/invalid-credential':'Credenciales incorrectas.',
      'auth/too-many-requests':'Demasiados intentos. Espera un momento.'
    };
    err.textContent=m[e.code]||'Error: '+e.message; err.style.display='block';
  } finally{ btn.disabled=false; btn.textContent='Entrar al Club'; }
}

// ─── REGISTER ────────────────────────────────────────
function formatUsername(input){
  input.value=input.value.toLowerCase().replace(/[^a-z0-9_]/g,'');
  const hint=document.getElementById('usernameHint');
  if(input.value.length>0&&input.value.length<3){
    hint.textContent='⚠️ Mínimo 3 caracteres'; hint.style.color='var(--red)';
  } else if(input.value.length>=3){
    hint.textContent='✅ @'+input.value; hint.style.color='var(--green)';
  } else { hint.textContent='Solo letras, números y guión bajo'; hint.style.color='var(--muted)'; }
}

function checkStrength(input){
  const v=input.value;
  const bar=document.getElementById('strengthBar');
  const lbl=document.getElementById('strengthLabel');
  let score=0;
  if(v.length>=6)score++;
  if(v.length>=10)score++;
  if(/[A-Z]/.test(v))score++;
  if(/[0-9]/.test(v))score++;
  if(/[^A-Za-z0-9]/.test(v))score++;
  const levels=[
    {w:'0%',bg:'var(--border)',t:''},
    {w:'25%',bg:'var(--red)',t:'Muy débil'},
    {w:'50%',bg:'#FF9800',t:'Débil'},
    {w:'75%',bg:'#2196F3',t:'Buena'},
    {w:'100%',bg:'var(--green)',t:'Muy segura'},
  ];
  const lv=levels[Math.min(score,4)];
  bar.style.width=lv.w; bar.style.background=lv.bg;
  lbl.textContent=lv.t; lbl.style.color=lv.bg;
}

function togglePass(id,btn){
  const inp=document.getElementById(id);
  if(inp.type==='password'){ inp.type='text'; btn.textContent='🙈'; }
  else { inp.type='password'; btn.textContent='👁'; }
}

async function handleRegister(){
  const nombre=document.getElementById('regNombre').value.trim();
  const username=document.getElementById('regUsername').value.trim().toLowerCase();
  const email=document.getElementById('regEmail').value.trim();
  const tel=document.getElementById('regTelefono').value.trim();
  const codigo=document.getElementById('regPaisCodigo').value;
  const pass=document.getElementById('regPassword').value;
  const err=document.getElementById('registerError');
  const btn=document.getElementById('regBtn');
  err.style.display='none';

  if(!nombre){ err.textContent='El nombre es obligatorio.'; err.style.display='block'; return; }
  if(!username||username.length<3){ err.textContent='El usuario debe tener mínimo 3 caracteres.'; err.style.display='block'; return; }
  if(!email||!email.includes('@')){ err.textContent='Email inválido.'; err.style.display='block'; return; }
  if(pass.length<6){ err.textContent='La contraseña debe tener mínimo 6 caracteres.'; err.style.display='block'; return; }

  btn.disabled=true; btn.textContent='Creando cuenta...';
  try{
    // Check username availability
    const usnap=await db.collection('users').where('username','==',username).limit(1).get();
    if(!usnap.empty){ err.textContent='Ese nombre de usuario ya está tomado.'; err.style.display='block'; return; }

    // Create Firebase Auth user
    const cred=await auth.createUserWithEmailAndPassword(email,pass);
    await cred.user.updateProfile({displayName:nombre});

    // Save profile to Firestore
    const telNorm=normalizeTelVE(tel,codigo);
    const telefonoCompleto=telNorm?(codigo+telNorm):'';
    const profile={
      email, nombre, username, role:'jugador', jugador_id:cred.user.uid,
      telefono:tel||'', codigoPais:tel?codigo:'', telefonoCompleto,
      verified:false, phoneVerified:false, legacy:false,
      creado:firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(cred.user.uid).set(profile);
    STATE.profile=profile;

    // Auto-create jugador profile (every user = jugador)
    await ensureAutoJugador(cred.user.uid, profile);

    // Go to verification choice
    document.getElementById('verifyEmailAddr').textContent=email;
    if(telefonoCompleto) document.getElementById('verifyPhoneNum').textContent=telefonoCompleto;
    else document.getElementById('optSMS').style.opacity='0.4';
    showVerifyChoice();
  }catch(e){
    const m={
      'auth/email-already-in-use':'Ese email ya tiene una cuenta.',
      'auth/invalid-email':'Email inválido.',
      'auth/weak-password':'Contraseña muy débil.'
    };
    err.textContent=m[e.code]||'Error: '+e.message; err.style.display='block';
  } finally{ btn.disabled=false; btn.textContent='Continuar →'; }
}

// ─── VERIFICATION ─────────────────────────────────────
let verifyMethod=null;
let confirmationResult=null;
let appVerifier=null;

function chooseVerify(method){
  verifyMethod=method;
  document.getElementById('optEmail').classList.toggle('selected',method==='email');
  document.getElementById('optSMS').classList.toggle('selected',method==='sms');
}

async function sendVerification(){
  const err=document.getElementById('verifyChoiceError');
  const btn=document.getElementById('btnSendVerify');
  err.style.display='none';
  if(!verifyMethod){ err.textContent='Selecciona un método.'; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='Enviando...';

  try{
    if(verifyMethod==='email'){
      await auth.currentUser.sendEmailVerification({
        url:window.location.origin+window.location.pathname
      });
      document.getElementById('emailSentAddr').textContent=
        'Enviamos un link a '+auth.currentUser.email+'. Ábrelo y luego vuelve aquí.';
      showLoginView('emailSentView');
    } else {
      // SMS via Firebase Phone Auth
      const profile=STATE.profile||(await db.collection('users').doc(auth.currentUser.uid).get()).data();
      const phone=profile?.telefonoCompleto;
      if(!phone){ err.textContent='No tienes teléfono registrado. Elige email.'; err.style.display='block'; return; }

      if(!appVerifier){
        appVerifier=new firebase.auth.RecaptchaVerifier('recaptcha-container',{
          size:'invisible',
          callback:()=>{}
        });
      }
      confirmationResult=await auth.signInWithPhoneNumber(phone,appVerifier);
      document.getElementById('smsSentTo').textContent='Código enviado a '+phone;
      // Clear OTP inputs
      [0,1,2,3,4,5].forEach(i=>{ const el=document.getElementById('otp'+i); if(el)el.value=''; });
      showLoginView('smsCodeView');
      document.getElementById('otp0').focus();
      // Show resend after 30s
      setTimeout(()=>{ const b=document.getElementById('btnResendSMS'); if(b)b.style.display='block'; },30000);
    }
  }catch(e){
    err.textContent='Error: '+e.message; err.style.display='block';
    if(appVerifier){ try{appVerifier.clear();}catch(ex){} appVerifier=null; }
  } finally{ btn.disabled=false; btn.textContent='Enviar código'; }
}

// OTP input helpers
function otpNext(input,i){
  input.value=input.value.replace(/[^0-9]/g,'');
  if(input.value&&i<5) document.getElementById('otp'+(i+1)).focus();
  // Auto-confirm when all 6 filled
  const code=[0,1,2,3,4,5].map(n=>document.getElementById('otp'+n).value).join('');
  if(code.length===6) confirmSMS();
}
function otpBack(e,i){
  if(e.key==='Backspace'&&!e.target.value&&i>0) document.getElementById('otp'+(i-1)).focus();
}

async function confirmSMS(){
  const code=[0,1,2,3,4,5].map(i=>document.getElementById('otp'+i).value).join('');
  const err=document.getElementById('smsError');
  const btn=document.getElementById('btnConfirmSMS');
  err.style.display='none';
  if(code.length<6){ err.textContent='Ingresa los 6 dígitos.'; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='Verificando...';
  try{
    // Get phone credential and link to current user
    const credential=firebase.auth.PhoneAuthProvider.credential(
      confirmationResult.verificationId, code
    );
    await auth.currentUser.linkWithCredential(credential);
    // Mark verified in Firestore
    await db.collection('users').doc(auth.currentUser.uid).update({
      phoneVerified:true, verified:true,
      verifiedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    STATE.profile.phoneVerified=true; STATE.profile.verified=true;
    showApp_(); initListeners();
  }catch(e){
    const m={'auth/invalid-verification-code':'Código incorrecto.','auth/code-expired':'Código expirado, reenvía.'};
    err.textContent=m[e.code]||'Error: '+e.message; err.style.display='block';
  } finally{ btn.disabled=false; btn.textContent='Confirmar código'; }
}

async function resendSMS(){
  if(appVerifier){ try{appVerifier.clear();}catch(e){} appVerifier=null; }
  confirmationResult=null;
  showVerifyChoice();
  verifyMethod='sms';
  chooseVerify('sms');
}

async function recheckEmail(){
  await auth.currentUser.reload();
  if(auth.currentUser.emailVerified){
    await db.collection('users').doc(auth.currentUser.uid).update({verified:true,verifiedAt:firebase.firestore.FieldValue.serverTimestamp()});
    STATE.profile.verified=true;
    showApp_(); initListeners();
  } else {
    const err=document.getElementById('verifyChoiceError');
    showLoginView('emailSentView');
    alert('El email aún no ha sido verificado. Por favor abre el link en tu correo.');
  }
}

async function resendEmail(){
  try{ await auth.currentUser.sendEmailVerification({url:window.location.origin+window.location.pathname}); }
  catch(e){ alert('Error al reenviar: '+e.message); }
}

function skipVerify(){
  // Allow limited access — can be restricted later
  showApp_(); initListeners();
}

async function handleLogout(){ await auth.signOut(); }

// ══════════════════════════════════════════════════════
// PERFIL DE USUARIO — Modal de gestión
// ══════════════════════════════════════════════════════
let _perfilFotoURL=null; // temp storage for new photo URL

function openPerfilModal(){
  const p=STATE.profile||{};
  const u=STATE.user;
  const err=document.getElementById('perfilError');
  const suc=document.getElementById('perfilSuccess');
  err.style.display='none'; suc.style.display='none';

  // Fill fields
  document.getElementById('perfilUsername').value=p.username?'@'+p.username:'Sin usuario';
  document.getElementById('perfilNombre').value=p.nombre||u?.displayName||'';
  document.getElementById('perfilAlias').value=p.alias||'';
  document.getElementById('perfilEmail').value=u?.email||p.email||'';
  document.getElementById('perfilHandicap').value=p.handicap||'';

  // Photo preview
  _perfilFotoURL=null;
  const preview=document.getElementById('perfilFotoPreview');
  if(p.fotoURL||u?.photoURL){
    preview.innerHTML=`<img src="${p.fotoURL||u.photoURL}" style="width:100%;height:100%;object-fit:cover;"/>`;
  } else {
    const initials=(p.nombre||u?.email||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    preview.innerHTML=`<span>${initials}</span>`;
  }

  // Show/hide password section (only for email/password users)
  const isEmailUser=u?.providerData?.some(pd=>pd.providerId==='password');
  document.getElementById('perfilPasswordSection').style.display=isEmailUser?'block':'none';
  document.getElementById('perfilPassActual').value='';
  document.getElementById('perfilPassNueva').value='';
  document.getElementById('perfilPassConfirm').value='';

  // Jugador vinculado info
  const jugId=p.jugador_id;
  const vinc=document.getElementById('perfilJugadorInfo');
  if(jugId){
    const j=getJugador(jugId);
    vinc.innerHTML=`<span style="color:var(--green);font-weight:600;">✅ ${j?.nombre||jugId}</span>`;
  } else {
    vinc.innerHTML=`<span style="color:var(--muted);">No vinculado — usa un código de invitación para vincular tu perfil de jugador</span>`;
  }

  document.getElementById('modalPerfil').style.display='flex';
}

function closePerfilModal(){
  document.getElementById('modalPerfil').style.display='none';
}

async function handlePerfilFotoChange(event){
  const file=event.target.files[0];
  if(!file) return;
  const err=document.getElementById('perfilError');
  err.style.display='none';

  if(file.size>5*1024*1024){
    err.textContent='La imagen no puede superar 5MB.';
    err.style.display='block';
    return;
  }

  try{
    // Show preview immediately
    const reader=new FileReader();
    reader.onload=e=>{
      document.getElementById('perfilFotoPreview').innerHTML=
        `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;"/>`;
    };
    reader.readAsDataURL(file);

    // Resize and upload
    const compressed=await resizeAndCompress(file, 400, 0.8);
    const path=`perfiles/${STATE.user.uid}/foto_${Date.now()}.jpg`;
    const prog=document.getElementById('perfilFotoProgress');
    const bar=document.getElementById('perfilFotoBar');
    prog.style.display='block';

    const ref=storage.ref(path);
    const task=ref.put(compressed);
    task.on('state_changed',
      snap=>{
        const pct=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
        bar.style.width=pct+'%';
      },
      error=>{
        prog.style.display='none';
        err.textContent='Error al subir foto: '+error.message;
        err.style.display='block';
      },
      async()=>{
        _perfilFotoURL=await task.snapshot.ref.getDownloadURL();
        prog.style.display='none';
        bar.style.width='0%';
        document.getElementById('perfilSuccess').textContent='✅ Foto cargada. Guarda los cambios para aplicar.';
        document.getElementById('perfilSuccess').style.display='block';
      }
    );
  }catch(e){
    err.textContent='Error procesando imagen: '+e.message;
    err.style.display='block';
  }
}

async function savePerfilModal(){
  const err=document.getElementById('perfilError');
  const suc=document.getElementById('perfilSuccess');
  err.style.display='none'; suc.style.display='none';

  const nombre=document.getElementById('perfilNombre').value.trim();
  const alias=document.getElementById('perfilAlias').value.trim();
  const handicap=parseFloat(document.getElementById('perfilHandicap').value)||0;

  if(!nombre){ err.textContent='El nombre es obligatorio.'; err.style.display='block'; return; }

  try{
    // Update user profile in Firestore
    const upd={nombre, alias, handicap};
    if(_perfilFotoURL) upd.fotoURL=_perfilFotoURL;
    await db.collection('users').doc(STATE.user.uid).update(upd);

    // Update Firebase Auth displayName and photoURL
    const authUpd={displayName:nombre};
    if(_perfilFotoURL) authUpd.photoURL=_perfilFotoURL;
    await STATE.user.updateProfile(authUpd);

    // Update local state
    Object.assign(STATE.profile, upd);
    document.getElementById('headerUser').textContent=STATE.profile?.username||alias||nombre.split(' ')[0]||nombre;

    // Also update linked jugador(es) if exists
    const jugId=STATE.profile?.jugador_id;
    if(jugId){
      const jugUpd={nombre, alias:alias||nombre.split(' ')[0], handicap,
        foto:nombre.split(' ').filter(Boolean).map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'};
      if(_perfilFotoURL) jugUpd.fotoURL=_perfilFotoURL;

      // Update ALL linked jugadores (primary + any extra from multi-vincular)
      const allIds=new Set(STATE.linked_jugador_ids);
      allIds.add(jugId);
      for(const jid of allIds){
        await db.collection('jugadores').doc(jid).update(jugUpd).catch(()=>{});
      }

      // Update participantes in all torneos for ALL linked jugadores
      for(const [tid, jugs] of Object.entries(STATE.jugadores_by_torneo)){
        for(const jid of allIds){
          const p=jugs.find(j=>j.id===jid||j.jugador_id===jid);
          if(p){
            Object.assign(p, jugUpd); // local cache
            await db.collection('torneos').doc(tid).collection('participantes').doc(p.id)
              .update(jugUpd).catch(()=>{});
          }
        }
      }
    }

    // Handle password change
    const passActual=document.getElementById('perfilPassActual').value;
    const passNueva=document.getElementById('perfilPassNueva').value;
    const passConfirm=document.getElementById('perfilPassConfirm').value;
    if(passNueva){
      if(passNueva.length<6){ err.textContent='La nueva contraseña debe tener al menos 6 caracteres.'; err.style.display='block'; return; }
      if(passNueva!==passConfirm){ err.textContent='Las contraseñas no coinciden.'; err.style.display='block'; return; }
      if(!passActual){ err.textContent='Ingresa tu contraseña actual para cambiarla.'; err.style.display='block'; return; }
      // Re-authenticate
      const cred=firebase.auth.EmailAuthProvider.credential(STATE.user.email, passActual);
      await STATE.user.reauthenticateWithCredential(cred);
      await STATE.user.updatePassword(passNueva);
      document.getElementById('perfilPassActual').value='';
      document.getElementById('perfilPassNueva').value='';
      document.getElementById('perfilPassConfirm').value='';
    }

    suc.textContent='✅ Perfil actualizado correctamente.';
    suc.style.display='block';
    _perfilFotoURL=null;
    renderCurrentTab();

    // Auto-close after a moment
    setTimeout(()=>{ if(document.getElementById('modalPerfil').style.display==='flex') closePerfilModal(); }, 1500);
  }catch(e){
    const msg=e.code==='auth/wrong-password'?'Contraseña actual incorrecta.':
              e.code==='auth/requires-recent-login'?'Debes re-iniciar sesión para cambiar la contraseña.':
              'Error: '+e.message;
    err.textContent=msg;
    err.style.display='block';
  }
}

async function handlePerfilVincular(){
  const code=document.getElementById('perfilVincularCodigo').value.trim().toUpperCase();
  const msgEl=document.getElementById('perfilVincularMsg');
  msgEl.style.display='none';
  if(!code||code.length<6){
    msgEl.textContent='Ingresa el código completo.';
    msgEl.style.cssText='display:block;margin-top:8px;font-size:12px;padding:8px;border-radius:8px;background:#FFEBEE;color:#C62828;';
    return;
  }
  try{
    const result=await vincularCodigo(code);
    // Update UI
    const vinc=document.getElementById('perfilJugadorInfo');
    if(vinc) vinc.innerHTML=`<span style="color:var(--green);font-weight:600;">✅ ${result.nombre}</span>`;
    document.getElementById('perfilVincularCodigo').value='';
    msgEl.textContent=result.isFirstVincular
      ?'✅ ¡Vinculación exitosa! Tu perfil ahora está conectado con tus resultados.'
      :'✅ ¡Torneo vinculado! Se agregó a tu lista de torneos.';
    msgEl.style.cssText='display:block;margin-top:8px;font-size:12px;padding:8px;border-radius:8px;background:#E8F5E9;color:#2E7D32;font-weight:600;';
    _filterMyTorneos();
    renderCurrentTab();
  }catch(e){
    const msg=e.message==='INVALID_CODE'?'Código inválido. Verifica con tu admin.'
      :e.message==='CODE_USED'?'Este código ya fue utilizado por otro jugador.'
      :'Error: '+e.message;
    msgEl.textContent=msg;
    msgEl.style.cssText='display:block;margin-top:8px;font-size:12px;padding:8px;border-radius:8px;background:#FFEBEE;color:#C62828;';
  }
}

async function handleReset(){
  const email=document.getElementById('resetEmail').value.trim();
  const err=document.getElementById('resetError'); err.style.display='none';
  try{
    await auth.sendPasswordResetEmail(email);
    document.getElementById('resetForm').style.display='none';
    document.getElementById('resetSuccess').style.display='block';
  }catch{ err.textContent='No se encontró ese email.'; err.style.display='block'; }
}

function showReset(){
  showLoginView('resetView');
  document.getElementById('resetForm').style.display='block';
  document.getElementById('resetSuccess').style.display='none';
}

