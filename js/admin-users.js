// ══════════════════════════════════════════════════════
// GOLFEADOS — Admin User Management
// ══════════════════════════════════════════════════════

let _adminUsersSearch='';

function renderAdminUsers(){
  const el=document.getElementById('tab-admin-users');
  if(!el) return;
  if(STATE.profile?.role!=='admin'){ el.innerHTML=''; return; }

  const users=STATE.allUsers||[];
  const q=_adminUsersSearch.toLowerCase();
  const filtered=q?users.filter(u=>
    (u.nombre||'').toLowerCase().includes(q)||
    (u.username||'').toLowerCase().includes(q)||
    (u.email||'').toLowerCase().includes(q)||
    (u.telefonoCompleto||'').includes(q)
  ):users;

  // Stats
  const totalUsers=users.length;
  const admins=users.filter(u=>u.role==='admin').length;
  const verified=users.filter(u=>u.verified).length;

  let html=`
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalUsers}</div>
        <div class="stat-label">Total usuarios</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${admins}</div>
        <div class="stat-label">Admins</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${verified}</div>
        <div class="stat-label">Verificados</div>
      </div>
    </div>

    <div class="search-wrap">
      <input type="text" class="search-bar" placeholder="Buscar por nombre, email, username o telefono..."
        value="${_adminUsersSearch}" oninput="_adminUsersSearch=this.value;renderAdminUsers();"/>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Usuarios registrados</span>
        <span class="text-11 text-muted">${filtered.length} de ${totalUsers}</span>
      </div>`;

  if(filtered.length===0){
    html+=`<div class="card-body text-13 text-muted" style="text-align:center;padding:24px;">No se encontraron usuarios</div>`;
  } else {
    filtered.slice(0,50).forEach(u=>{
      const initials=(u.nombre||u.username||u.email||'?')[0].toUpperCase();
      const roleBadge=u.role==='admin'
        ?'<span class="badge-admin" style="font-size:9px;padding:2px 6px;">ADMIN</span>'
        :'<span class="text-11 text-muted">Jugador</span>';
      const verifiedIcon=u.verified?'✅':'⏳';
      const fecha=_formatUserDate(u.creado);
      const phone=u.telefonoCompleto||'';
      const linkedJugador=u.jugador_id?'🔗':'';

      html+=`
      <div class="user-card" style="cursor:pointer;" onclick="openModalUserDetail('${u.id}')">
        <div class="avatar" style="width:38px;height:38px;font-size:14px;background:${u.role==='admin'?'var(--green)':'var(--blue)'};">${initials}</div>
        <div class="user-card-info">
          <div class="user-card-name">${u.nombre||'Sin nombre'} ${linkedJugador}</div>
          <div class="user-card-email">${u.email||''}</div>
          <div class="user-card-meta">
            ${roleBadge}
            <span class="text-11 text-muted">${verifiedIcon}</span>
            ${phone?'<span class="text-11 text-muted">📱 '+phone+'</span>':''}
            <span class="text-11 text-muted">${fecha}</span>
          </div>
        </div>
      </div>`;
    });
    if(filtered.length>50){
      html+=`<div class="card-body text-12 text-muted" style="text-align:center;">Mostrando 50 de ${filtered.length} resultados. Usa el buscador para filtrar.</div>`;
    }
  }
  html+=`</div>`;
  el.innerHTML=html;
}

// ── User Detail Modal ────────────────────────────────
function openModalUserDetail(uid){
  const user=STATE.allUsers.find(u=>u.id===uid);
  if(!user) return;

  document.getElementById('modalUserDetailTitle').textContent=user.nombre||user.username||'Usuario';

  const fecha=_formatUserDate(user.creado);
  const jugador=STATE.jugadores_global?.find(j=>j.id===user.jugador_id);

  // Get user's wallet balance
  let walletInfo='<span class="text-muted">Sin billetera</span>';
  // We need to fetch wallet for this specific user
  db.collection('wallets').doc(uid).get().then(wDoc=>{
    const bal=wDoc.exists?wDoc.data().balance||0:0;
    const wEl=document.getElementById('userDetailWallet');
    if(wEl) wEl.textContent='⛳ '+bal+' pelotas';
  }).catch(()=>{});

  let html=`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
      <div class="avatar" style="width:52px;height:52px;font-size:20px;background:${user.role==='admin'?'var(--green)':'var(--blue)'};">
        ${(user.nombre||user.username||'?')[0].toUpperCase()}
      </div>
      <div>
        <div class="text-15 font-bold">${user.nombre||'Sin nombre'}</div>
        <div class="text-12 text-muted">${user.username?'@'+user.username:''}</div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-row">
        <span class="config-label">Email</span>
        <span class="text-12">${user.email||'—'}</span>
      </div>
      <div class="config-row">
        <span class="config-label">Telefono</span>
        <span class="text-12">${user.telefonoCompleto||'—'}</span>
      </div>
      <div class="config-row">
        <span class="config-label">Rol</span>
        <select class="form-select" id="userDetailRole" onchange="changeUserRole('${uid}',this.value)" style="padding:4px 8px;font-size:12px;">
          <option value="jugador" ${user.role!=='admin'?'selected':''}>Jugador</option>
          <option value="admin" ${user.role==='admin'?'selected':''}>Admin</option>
        </select>
      </div>
      <div class="config-row">
        <span class="config-label">Verificado</span>
        <span class="text-12">${user.verified?'✅ Si':'⏳ No'}</span>
      </div>
      <div class="config-row">
        <span class="config-label">Registro</span>
        <span class="text-12">${fecha}</span>
      </div>
      <div class="config-row">
        <span class="config-label">Billetera</span>
        <span class="text-12 font-bold text-green" id="userDetailWallet">Cargando...</span>
      </div>
      <div class="config-row">
        <span class="config-label">Jugador vinculado</span>
        <span class="text-12">${jugador?jugador.nombre+' ('+jugador.alias+')':'—'}</span>
      </div>
      ${user.invite_code?`<div class="config-row">
        <span class="config-label">Codigo invitacion</span>
        <span class="text-12" style="font-family:monospace;letter-spacing:2px;">${user.invite_code}</span>
      </div>`:''}
    </div>`;

  document.getElementById('modalUserDetailBody').innerHTML=html;
  document.getElementById('modalUserDetail').style.display='flex';
}

function closeModalUserDetail(){
  document.getElementById('modalUserDetail').style.display='none';
}

async function changeUserRole(uid,newRole){
  if(!confirm('Cambiar rol a "'+newRole+'" para este usuario?')) {
    // Reset select
    const user=STATE.allUsers.find(u=>u.id===uid);
    document.getElementById('userDetailRole').value=user?.role||'jugador';
    return;
  }
  try{
    await db.collection('users').doc(uid).update({role:newRole});
    console.log('[Admin] Role changed:',uid,'→',newRole);
  }catch(e){
    console.error('changeUserRole error:',e);
    alert('Error: '+e.message);
  }
}

// ── Helpers ──────────────────────────────────────────
function _formatUserDate(ts){
  if(!ts) return '—';
  const d=ts.toDate?ts.toDate():new Date(ts);
  return d.toLocaleDateString('es',{day:'2-digit',month:'short',year:'numeric'});
}
