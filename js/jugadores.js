// ══════════════════════════════════════════════════════
// GOLFEADOS — Jugadores (Player Management)
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// JUGADORES — Single-torneo view (opened from Mis Torneos)
// ══════════════════════════════════════════════════════
let showAddJugador=false;
let editingJugadorId=null;

function openJugadoresTorneo(tid){
  STATE._jugadoresTorneoId=tid;
  // Ensure participantes are subscribed for this torneo
  STATE.activeTorneoId=tid;
  STATE.torneo=STATE.torneos.find(t=>t.id===tid)||null;
  if(!_participantesUnsubs[tid]) subscribeParticipantes();
  ensureJugadoresGlobal();
  goTab('jugadores');
}

function closeJugadoresTorneo(){
  STATE._jugadoresTorneoId=null;
  goTab('mistorneos');
}

function renderJugadores(){
  const el=document.getElementById('tab-jugadores');
  const myJugadorId=STATE.profile?.jugador_id;
  const uid=STATE.user?.uid;
  const tid=STATE._jugadoresTorneoId;

  // Trigger user profile enrichment (throttled — max once per 10 seconds)
  const now=Date.now();
  if(!STATE._lastEnrichTime || now-STATE._lastEnrichTime>10000){
    STATE._lastEnrichTime=now;
    _enrichJugadoresWithUserProfiles();
  }

  if(!tid){
    el.innerHTML=`<div style="text-align:center;padding:40px 20px;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:12px;">👤</div>
      <div style="font-size:15px;font-weight:600;">Selecciona un torneo</div>
      <button class="btn-outline" style="margin-top:12px;" onclick="goTab('mistorneos')">← Mis Torneos</button>
    </div>`;
    return;
  }

  const t=STATE.torneos.find(t=>t.id===tid);
  if(!t){
    el.innerHTML=`<div style="text-align:center;padding:40px;color:var(--muted);">Torneo no encontrado</div>`;
    return;
  }

  const canManage=isTorneoAdmin(t);
  const allJugadores=getJugadoresTorneo(tid);
  const jugadoresActivos=allJugadores.filter(j=>j.activo!==false);
  const jugadoresEliminados=allJugadores.filter(j=>j.activo===false||j.eliminado===true);

  const jugadoresHTML=[...jugadoresActivos,...jugadoresEliminados].map(j=>{
    const global=(STATE.jugadores_global||[]).find(g=>g.id===j.id||g.id===j.jugador_id);
    const raw_user_uid=global?.user_uid||j.user_uid||null;
    const userProfile=raw_user_uid
      ? (STATE.users_cache[raw_user_uid]||null)
      : ((STATE._jugadorToUserMap||{})[j.id]||(STATE._jugadorToUserMap||{})[j.jugador_id]||null);
    const effective_user_uid=raw_user_uid||(userProfile?userProfile.uid||userProfile._uid:null)||null;
    const nombre=userProfile?.nombre||global?.nombre||j.nombre||'';
    const alias=userProfile?.username||userProfile?.alias||global?.alias||j.alias||'';
    const foto=userProfile?.nombre
      ?userProfile.nombre.split(' ').filter(Boolean).map(n=>n[0]).join('').toUpperCase().slice(0,2)
      :(global?.foto||j.foto||'');
    const fotoURL=userProfile?.fotoURL||global?.fotoURL||j.fotoURL||null;
    const telefonoCompleto=userProfile?.telefonoCompleto||global?.telefonoCompleto||j.telefonoCompleto||'';
    const user_uid=effective_user_uid;
    const invite_code=j.invite_code||global?.invite_code||null;

    const isMe=j.id===myJugadorId||j.jugador_id===myJugadorId||user_uid===uid;
    const isElim=j.activo===false||j.eliminado===true;
    const initials=foto||alias?.slice(0,2)||nombre?.slice(0,2)||'?';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);${isElim?'opacity:0.5;':''}">
      ${fotoURL
        ?`<img src="${fotoURL}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;${isElim?'filter:grayscale(1);':''}"/>`
        :`<div style="width:40px;height:40px;border-radius:50%;background:${isElim?'var(--muted)':'var(--green)'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>`}
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;${isElim?'text-decoration:line-through;color:var(--muted);':''}">${nombre}${isMe?` <span style="font-size:10px;background:#E8F5E9;color:#2E7D32;padding:1px 5px;border-radius:6px;">Tú</span>`:''}${isElim?` <span style="font-size:10px;background:#FFEBEE;color:#C62828;padding:1px 5px;border-radius:6px;">Eliminado</span>`:''}</div>
        <div style="font-size:11px;color:var(--muted);">
          ${alias&&alias!==nombre?`@${alias}`:''} ${telefonoCompleto?'· '+telefonoCompleto:''}
        </div>
        ${canManage?`<div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${
          invite_code&&!user_uid
          ?`<span style="background:#E8F5E9;color:#2E7D32;font-size:10px;font-weight:700;padding:2px 6px;border-radius:5px;font-family:monospace;">🔑 ${invite_code}</span><button onclick="enviarInvitacionWA('${(nombre||'').replace(/'/g,"\\'")}','${invite_code}','${telefonoCompleto||''}',event)" style="background:#25D366;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.657 0-3.216-.5-4.51-1.348l-.324-.194-2.866.852.852-2.866-.194-.324A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg> Invitar</button>`
          :user_uid
          ?`<span style="background:#E3F2FD;color:#1565C0;font-size:10px;padding:2px 6px;border-radius:5px;">✅ Con cuenta</span>`
          :''
        }</div>`:''}
      </div>
      ${canManage&&!isElim?`<button onclick="removeParticipante('${j.id}','${(nombre||'').replace(/'/g,"\\'")}','${tid}',event)"
        style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;color:var(--muted);font-size:12px;cursor:pointer;">✕</button>`:''}
      ${canManage&&isElim?`<button onclick="reactivarParticipante('${j.id}','${tid}',event)"
        style="background:none;border:1px solid #A5D6A7;border-radius:6px;padding:3px 8px;color:var(--green);font-size:11px;cursor:pointer;font-weight:600;">↩ Restaurar</button>`:''}
    </div>`;
  }).join('');

  el.innerHTML=`
    <!-- Sticky header -->
    <div style="position:sticky;top:96px;z-index:50;background:var(--white);border-bottom:1px solid var(--border);padding:12px 16px;box-shadow:0 2px 4px rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:${canManage?'10px':'0'};">
        <button onclick="closeJugadoresTorneo()" style="background:none;border:none;font-size:18px;cursor:pointer;padding:4px;color:var(--text);">←</button>
        ${t.logoURL?`<img src="${t.logoURL}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0;"/>`:''}
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:800;color:var(--green);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.nombre}</div>
          <div style="font-size:11px;color:var(--muted);">${jugadoresActivos.length} jugador${jugadoresActivos.length!==1?'es':''}${jugadoresEliminados.length>0?' · '+jugadoresEliminados.length+' eliminado'+(jugadoresEliminados.length!==1?'s':''):''}</div>
        </div>
      </div>
      ${canManage?`<button class="btn-green" style="width:100%;padding:10px;font-size:13px;font-weight:700;" onclick="openAgregarJugadorModal('${tid}')">
        + Invitar / Agregar Jugador
      </button>`:''}
    </div>
    <!-- Player list -->
    <div>
      ${allJugadores.length===0
        ?`<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px;">Sin jugadores aún. Agrega el primer jugador.</div>`
        :jugadoresHTML}
    </div>`;
}


// toggleJugadoresTorneo removed — now uses openJugadoresTorneo/closeJugadoresTorneo

function openAgregarJugadorModal(torneoId){
  // Set active torneo for add flow
  if(torneoId){
    STATE.activeTorneoId=torneoId;
    STATE._expandedJugTorneo=torneoId;
    STATE.torneo=STATE.torneos.find(t=>t.id===torneoId)||null;
    if(!_participantesUnsubs[torneoId]) subscribeParticipantes();
  }
  // Ensure global jugadores listener is active
  ensureJugadoresGlobal();
  // Show modal
  const m=document.getElementById('agregarJugadorModal');
  if(!m) return;
  m.style.display='flex';
  const t=getActiveTorneo();
  const title=document.getElementById('modalAgregarTitle');
  if(title&&t) title.textContent='Agregar a: '+t.nombre;
  // Reset form
  switchAgregarTab('buscar');
  const inp=document.getElementById('buscarJugadorInput');
  if(inp){ inp.value=''; }
  const res=document.getElementById('buscarResultados');
  if(res) res.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px;">Escribe al menos 2 caracteres</div>';
  setTimeout(()=>{ if(inp) inp.focus(); },100);
}
function closeAgregarJugadorModal(){
  const m=document.getElementById('agregarJugadorModal');
  if(m) m.style.display='none';
  // Clean form fields
  const fields=['newNombre','newAlias','newFoto','newTelefono','buscarJugadorInput'];
  fields.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const err=document.getElementById('addJugadorError');
  if(err) err.style.display='none';
  const res=document.getElementById('buscarResultados');
  if(res) res.innerHTML='';
}
function switchAgregarTab(tab){
  const isBuscar=tab==='buscar';
  document.getElementById('panelBuscar').style.display=isBuscar?'block':'none';
  document.getElementById('panelCrear').style.display=isBuscar?'none':'block';
  document.getElementById('tabBuscar').style.background=isBuscar?'var(--green)':'transparent';
  document.getElementById('tabBuscar').style.color=isBuscar?'#fff':'var(--text)';
  document.getElementById('tabBuscar').style.borderColor=isBuscar?'var(--green)':'var(--border)';
  document.getElementById('tabCrear').style.background=isBuscar?'transparent':'var(--green)';
  document.getElementById('tabCrear').style.color=isBuscar?'var(--text)':'#fff';
  document.getElementById('tabCrear').style.borderColor=isBuscar?'var(--border)':'var(--green)';
}

let _buscarTimer=null;
function buscarJugadorGlobal(q){
  clearTimeout(_buscarTimer);
  const res=document.getElementById('buscarResultados');
  if(!q||q.length<2){ res.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px;">Escribe al menos 2 caracteres</div>'; return; }
  res.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px;">Buscando...</div>';
  _buscarTimer=setTimeout(()=>{
    const ql=normalizeStr(q);
    // Search in already-loaded global (normalized — ignores accents/diacritics)
    let found=STATE.jugadores_global.filter(j=>{
      return normalizeStr(j.nombre).includes(ql)
          || normalizeStr(j.alias).includes(ql)
          || (j.telefonoCompleto||'').includes(ql)
          || (j.telefono||'').includes(ql)
          || normalizeStr(j.email).includes(ql);
    });
    // Exclude already in torneo
    // Exclude players already in the ACTIVE torneo (not all torneos)
    const activeTid=STATE.activeTorneoId;
    const inTorneo=new Set((STATE.jugadores_by_torneo[activeTid]||STATE.jugadores||[]).map(j=>j.id||j.jugador_id));
    found=found.filter(j=>!inTorneo.has(j.id));
    if(found.length===0){
      res.innerHTML=`<div style="text-align:center;padding:16px;color:var(--muted);">
        <div style="font-size:13px;">No encontrado.</div>
        <button class="btn-link" style="margin-top:8px;" onclick="switchAgregarTab('crear')">+ Crear jugador nuevo</button>
      </div>`;
      return;
    }
    res.innerHTML=found.slice(0,8).map(j=>`
      <div onclick="agregarParticipante('${j.id}')" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-bottom:8px;cursor:pointer;background:var(--cardL);">
        <div class="avatar-initials" style="width:38px;height:38px;font-size:13px;">${j.foto||j.alias?.slice(0,2)||j.nombre?.slice(0,2)||'?'}</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">${j.nombre}</div>
          <div style="font-size:12px;color:var(--muted);">${j.alias||''} ${j.telefonoCompleto?'· '+j.telefonoCompleto:''}</div>
        </div>
        <span style="color:var(--green);font-size:20px;">+</span>
      </div>`).join('');
  }, 300);
}

async function agregarParticipante(jugadorId){
  const torneo=getActiveTorneo();
  if(!torneo) return;
  const j=STATE.jugadores_global.find(x=>x.id===jugadorId);
  if(!j) return;
  try{
    await db.collection('torneos').doc(torneo.id)
      .collection('participantes').doc(jugadorId).set({
        jugador_id: jugadorId,
        nombre: j.nombre||'',
        alias: j.alias||'',
        foto: j.foto||'',
        fotoURL: j.fotoURL||null,
        telefonoCompleto: j.telefonoCompleto||null,
        invite_code: j.invite_code||null,
        user_uid: j.user_uid||null,
        handicap: j.handicap||0,
        activo: true,
        fecha_ingreso: firebase.firestore.FieldValue.serverTimestamp()
      });
    // Update count on torneo
    closeAgregarJugadorModal();
  }catch(e){ alert('Error: '+e.message); }
}

async function crearYAgregarJugador(){
  console.log('[crearYAgregarJugador] START');
  let err;
  try{
    const nombre=(document.getElementById('newNombre')?.value||'').trim();
    const alias=(document.getElementById('newAlias')?.value||'').trim();
    const foto=(document.getElementById('newFoto')?.value||'').trim().toUpperCase().slice(0,2);
    let telefono=(document.getElementById('newTelefono')?.value||'').trim().replace(/\D/g,'');
    const codigoPais=(document.getElementById('newPaisCodigo')?.value)||'+58';
    telefono=normalizeTelVE(telefono,codigoPais);
    err=document.getElementById('addJugadorError');
    if(err) err.style.display='none';
    if(!nombre){
      if(err){err.textContent='El nombre es obligatorio.';err.style.display='block';}
      else alert('El nombre es obligatorio.');
      return;
    }
    if(telefono&&!validarFormatoTel(telefono,codigoPais)){
      if(err){err.textContent='Formato de teléfono inválido.';err.style.display='block';}
      return;
    }
    const torneo=getActiveTorneo();
    console.log('[crearYAgregarJugador] torneo:', torneo?.id, torneo?.nombre);
    if(!torneo){
      if(err){err.textContent='No hay torneo activo.';err.style.display='block';}
      else alert('No hay torneo activo.');
      return;
    }
    const initials=foto||nombre.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    const invite_code=generateInviteCode();
    const nombre_lower=nombre.toLowerCase();
    const jugData={
      nombre, alias:alias||nombre.split(' ')[0], foto:initials,
      nombre_lower, invite_code, user_uid:null,
      creado:firebase.firestore.FieldValue.serverTimestamp()
    };
    if(telefono){ jugData.telefono=telefono; jugData.codigoPais=codigoPais; jugData.telefonoCompleto=codigoPais+telefono; }
    const id=nombre_lower.replace(/\s+/g,'_')+'_'+Date.now();
    console.log('[crearYAgregarJugador] Creating jugador:', id);
    await db.collection('jugadores').doc(id).set(jugData);
    // Add to jugadores_global cache
    STATE.jugadores_global.push({id,...jugData});
    // Add to torneo participantes
    await db.collection('torneos').doc(torneo.id)
      .collection('participantes').doc(id).set({
        jugador_id:id, nombre, alias:alias||nombre.split(' ')[0],
        foto:initials, fotoURL:null, telefonoCompleto:jugData.telefonoCompleto||null,
        invite_code, user_uid:null, handicap:0, activo:true,
        fecha_ingreso:firebase.firestore.FieldValue.serverTimestamp()
      });
    console.log('[crearYAgregarJugador] SUCCESS');
    closeAgregarJugadorModal();
    // Show invite toast with WhatsApp button
    showInviteToast(nombre, invite_code, jugData.telefonoCompleto||'');
  }catch(e){
    console.error('[crearYAgregarJugador] ERROR:', e);
    if(err){err.textContent='Error: '+e.message;err.style.display='block';}
    else alert('Error al crear jugador: '+e.message);
  }
}

// ── WhatsApp Invitation ─────────────────────────────
function getAppURL(){
  return window.location.origin + window.location.pathname;
}

function buildInviteMessage(nombre, code){
  return `🏌️ *¡Te invitaron a Golfeados!*\n\n`
    +`Hola${nombre?' '+nombre.split(' ')[0]:''}, te agregaron a un torneo de golf.\n\n`
    +`Tu código de vinculación es: *${code}*\n\n`
    +`1️⃣ Regístrate aquí: ${getAppURL()}\n`
    +`2️⃣ Una vez dentro, ve a tu *Perfil* (toca tu nombre arriba) y usa el código para vincular tu cuenta.\n\n`
    +`¡Nos vemos en el campo! ⛳`;
}

function enviarInvitacionWA(nombre, code, telefono, event){
  if(event) event.stopPropagation();
  const msg=encodeURIComponent(buildInviteMessage(nombre, code));
  // Clean phone: remove spaces, dashes, keep + and digits
  const phone=(telefono||'').replace(/[^0-9+]/g,'').replace(/^\+/,'');
  const url=phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
  window.open(url, '_blank');
}

function copyInviteCode(code, event){
  if(event) event.stopPropagation();
  navigator.clipboard.writeText(code).then(()=>{
    const btn=event?.target;
    if(btn){
      const orig=btn.textContent;
      btn.textContent='✅ Copiado';
      setTimeout(()=>{ btn.textContent=orig; }, 1500);
    }
  }).catch(()=>{ prompt('Copia el código:', code); });
}

function showInviteToast(nombre, code, telefono){
  // Remove any existing toast
  const old=document.getElementById('inviteToast');
  if(old) old.remove();

  const toast=document.createElement('div');
  toast.id='inviteToast';
  toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10000;background:var(--white);border-radius:16px;padding:20px;box-shadow:0 8px 32px rgba(0,0,0,0.25);max-width:360px;width:calc(100% - 40px);border:2px solid var(--green);';
  toast.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:14px;font-weight:800;color:var(--green);">✅ Jugador creado</div>
      <button onclick="this.closest('#inviteToast').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text);margin-bottom:10px;">
      <strong>${nombre}</strong> fue agregado al torneo.
    </div>
    <div style="background:var(--bg);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600;">Código de vinculación</div>
        <div style="font-size:20px;font-weight:800;font-family:monospace;letter-spacing:3px;color:var(--green);">${code}</div>
      </div>
      <button onclick="copyInviteCode('${code}',event)" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:11px;cursor:pointer;color:var(--text);font-weight:600;">📋 Copiar</button>
    </div>
    <button onclick="enviarInvitacionWA('${(nombre||'').replace(/'/g,"\\'")}','${code}','${telefono||''}');this.closest('#inviteToast').remove();"
      style="width:100%;padding:12px;border:none;border-radius:10px;background:#25D366;color:#fff;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 8px rgba(37,211,102,0.3);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.657 0-3.216-.5-4.51-1.348l-.324-.194-2.866.852.852-2.866-.194-.324A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>
      Enviar invitación por WhatsApp
    </button>
    <div style="text-align:center;margin-top:8px;">
      <button onclick="this.closest('#inviteToast').remove()" style="background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;">Cerrar</button>
    </div>`;
  document.body.appendChild(toast);

  // Auto-dismiss after 15 seconds
  setTimeout(()=>{ const t=document.getElementById('inviteToast'); if(t) t.remove(); }, 15000);
}

async function removeParticipante(jugadorId, nombre, torneoId, event){
  if(event) event.stopPropagation();
  const tid=torneoId||STATE.activeTorneoId;
  if(!tid) return;
  const t=STATE.torneos.find(x=>x.id===tid)||findTorneo(tid);
  const msg=`¿Eliminar a ${nombre} de ${t?.nombre||'este torneo'}? Se marcará como eliminado y sus resultados se mantienen.`;
  if(!confirm(msg)) return;
  try{
    // ALWAYS soft-delete — never hard-delete participantes
    await db.collection('torneos').doc(tid)
      .collection('participantes').doc(jugadorId).update({
        activo:false,
        eliminado:true,
        eliminado_fecha:firebase.firestore.FieldValue.serverTimestamp()
      });
  }catch(e){ alert('Error: '+e.message); }
}

async function reactivarParticipante(jugadorId, torneoId, event){
  if(event) event.stopPropagation();
  const tid=torneoId||STATE.activeTorneoId;
  if(!tid) return;
  try{
    await db.collection('torneos').doc(tid)
      .collection('participantes').doc(jugadorId).update({
        activo:true,
        eliminado:false,
        eliminado_fecha:null
      });
  }catch(e){ alert('Error: '+e.message); }
}
