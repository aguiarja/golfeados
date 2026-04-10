// ══════════════════════════════════════════════════════
// GOLFEADOS — Admin Wallet (Recargas & Config)
// ══════════════════════════════════════════════════════

function renderAdminWallet(){
  const el=document.getElementById('tab-admin-wallet');
  if(!el) return;
  if(STATE.profile?.role!=='admin'){ el.innerHTML=''; return; }

  const txs=STATE.allTransactions||[];
  const pending=STATE.pagoMovilPendientes||[];
  const config=STATE.walletConfig||{};

  // Stats
  const totalBalls=txs.filter(t=>t.estado==='completado').reduce((s,t)=>s+t.monto,0);
  const todayTxs=txs.filter(t=>{
    if(!t.creado) return false;
    const d=t.creado.toDate?t.creado.toDate():new Date(t.creado);
    const now=new Date();
    return d.toDateString()===now.toDateString();
  });
  const todayBalls=todayTxs.filter(t=>t.estado==='completado'&&t.monto>0).reduce((s,t)=>s+t.monto,0);

  let html=`
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${pending.length}</div>
        <div class="stat-label">Pago Movil pendientes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${todayBalls}</div>
        <div class="stat-label">Pelotas hoy</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${txs.length}</div>
        <div class="stat-label">Total transacciones</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${config.bono_bienvenida||0}</div>
        <div class="stat-label">Bono bienvenida</div>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button class="btn-green" onclick="openModalAjuste()">⚙️ Ajustar saldo</button>
      <button class="btn-outline" onclick="openModalWalletConfig()">🔧 Configuracion</button>
    </div>`;

  // ── Pending Pago Movil ──
  if(pending.length>0){
    html+=`
    <div class="card">
      <div class="card-header">
        <span class="card-title">📱 Pago Movil Pendientes</span>
        <span class="badge badge-validar">${pending.length}</span>
      </div>`;
    pending.forEach(pm=>{
      const user=STATE.allUsers.find(u=>u.id===pm.user_id);
      const nombre=user?.nombre||user?.username||pm.user_id;
      const fecha=_formatTxDate(pm.creado);
      html+=`
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);">
        <div class="flex items-center justify-between mb-8">
          <div>
            <div class="text-13 font-bold">${nombre}</div>
            <div class="text-11 text-muted">${fecha}</div>
          </div>
          <div style="text-align:right;">
            <div class="text-15 font-bold text-green">⛳ ${pm.paquete?.pelotas||0}</div>
            <div class="text-11 text-muted">Bs. ${pm.monto_bs||0}</div>
          </div>
        </div>
        <div class="text-12" style="background:var(--bg);padding:8px 10px;border-radius:8px;margin-bottom:8px;">
          Ref: <strong>${pm.referencia}</strong> · Banco: <strong>${pm.banco}</strong> · Tel: <strong>${pm.telefono}</strong>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-approve" onclick="approvePagoMovil('${pm.id}')">✓ Aprobar</button>
          <button class="btn-danger" onclick="rejectPagoMovil('${pm.id}')">✕ Rechazar</button>
        </div>
      </div>`;
    });
    html+=`</div>`;
  }

  // ── Recent Transactions ──
  html+=`
    <div class="card mt-16">
      <div class="card-header">
        <span class="card-title">Ultimas transacciones</span>
      </div>`;

  if(txs.length===0){
    html+=`<div class="card-body text-13 text-muted" style="text-align:center;padding:24px;">No hay transacciones aun</div>`;
  } else {
    html+=`<div style="overflow-x:auto;"><table class="admin-table">
      <thead><tr>
        <th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Monto</th><th>Estado</th>
      </tr></thead><tbody>`;
    txs.slice(0,50).forEach(tx=>{
      const user=STATE.allUsers.find(u=>u.id===tx.user_id);
      const nombre=user?.nombre||user?.username||tx.user_id?.substring(0,8);
      const fecha=_formatTxDate(tx.creado);
      const cls=tx.monto>0?'credit':'debit';
      const sign=tx.monto>0?'+':'';
      html+=`<tr>
        <td class="text-11">${fecha}</td>
        <td class="text-12 font-bold">${nombre}</td>
        <td><span class="text-11">${_txIcon(tx.tipo)} ${_txDescDefault(tx.tipo)}</span></td>
        <td class="tx-amount ${cls}" style="font-size:13px;">${sign}${tx.monto}</td>
        <td><span class="tx-badge ${tx.estado}">${_txEstadoLabel(tx.estado)}</span></td>
      </tr>`;
    });
    html+=`</tbody></table></div>`;
  }
  html+=`</div>`;

  el.innerHTML=html;
}

// ── Approve / Reject Pago Movil ──────────────────────
async function approvePagoMovil(pmId){
  if(!confirm('Aprobar esta recarga?')) return;
  try{
    const pmDoc=await db.collection('pago_movil_recargas').doc(pmId).get();
    if(!pmDoc.exists){ alert('Solicitud no encontrada'); return; }
    const pm=pmDoc.data();
    const uid=pm.user_id;
    const pelotas=pm.paquete?.pelotas||0;

    await db.runTransaction(async(transaction)=>{
      const walletRef=db.collection('wallets').doc(uid);
      const walletDoc=await transaction.get(walletRef);
      const currentBalance=walletDoc.exists?walletDoc.data().balance||0:0;
      const newBalance=currentBalance+pelotas;

      // Update or create wallet
      transaction.set(walletRef,{
        balance:newBalance,
        actualizado:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});

      // Update pago movil status
      transaction.update(db.collection('pago_movil_recargas').doc(pmId),{
        estado:'aprobado',
        procesado_por:STATE.user.uid,
        procesado_at:firebase.firestore.FieldValue.serverTimestamp()
      });

      // Find and update pending transaction
      const txSnap=await db.collection('transactions')
        .where('user_id','==',uid)
        .where('tipo','==','recarga_pago_movil')
        .where('estado','==','pendiente')
        .where('referencia','==',pm.referencia)
        .limit(1).get();

      if(!txSnap.empty){
        transaction.update(txSnap.docs[0].ref,{
          estado:'completado',
          balance_despues:newBalance,
          procesado:firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create transaction if not found
        transaction.set(db.collection('transactions').doc(),{
          user_id:uid,
          tipo:'recarga_pago_movil',
          monto:pelotas,
          balance_antes:currentBalance,
          balance_despues:newBalance,
          estado:'completado',
          referencia:pm.referencia,
          descripcion:'Recarga Pago Movil - '+pelotas+' pelotas',
          metadata:{pago_movil_id:pmId},
          creado:firebase.firestore.FieldValue.serverTimestamp(),
          procesado:firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    console.log('[Admin] Pago movil approved:',pmId);
  }catch(e){
    console.error('approvePagoMovil error:',e);
    alert('Error al aprobar: '+e.message);
  }
}

async function rejectPagoMovil(pmId){
  if(!confirm('Rechazar esta recarga?')) return;
  try{
    const pmDoc=await db.collection('pago_movil_recargas').doc(pmId).get();
    if(!pmDoc.exists) return;
    const pm=pmDoc.data();

    const batch=db.batch();
    batch.update(db.collection('pago_movil_recargas').doc(pmId),{
      estado:'rechazado',
      procesado_por:STATE.user.uid,
      procesado_at:firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update pending transaction
    const txSnap=await db.collection('transactions')
      .where('user_id','==',pm.user_id)
      .where('tipo','==','recarga_pago_movil')
      .where('estado','==','pendiente')
      .where('referencia','==',pm.referencia)
      .limit(1).get();

    if(!txSnap.empty){
      batch.update(txSnap.docs[0].ref,{
        estado:'rechazado',
        procesado:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
    console.log('[Admin] Pago movil rejected:',pmId);
  }catch(e){
    console.error('rejectPagoMovil error:',e);
    alert('Error al rechazar: '+e.message);
  }
}

// ── Manual Adjustment ────────────────────────────────
let _ajusteSelectedUid=null;

function openModalAjuste(){
  _ajusteSelectedUid=null;
  document.getElementById('ajusteSearchUser').value='';
  document.getElementById('ajusteUserResults').innerHTML='';
  document.getElementById('ajusteSelectedUser').style.display='none';
  document.getElementById('ajusteMonto').value='';
  document.getElementById('ajusteDescripcion').value='';
  document.getElementById('modalAjuste').style.display='flex';
}

function closeModalAjuste(){
  document.getElementById('modalAjuste').style.display='none';
  _ajusteSelectedUid=null;
}

function searchAjusteUser(q){
  const container=document.getElementById('ajusteUserResults');
  if(!q||q.length<2){ container.innerHTML=''; return; }
  const low=q.toLowerCase();
  const matches=(STATE.allUsers||[]).filter(u=>
    (u.nombre||'').toLowerCase().includes(low)||
    (u.username||'').toLowerCase().includes(low)||
    (u.email||'').toLowerCase().includes(low)
  ).slice(0,8);

  container.innerHTML=matches.map(u=>`
    <div class="user-card" style="cursor:pointer;" onclick="selectAjusteUser('${u.id}','${(u.nombre||u.username||u.email||'').replace(/'/g,'')}')">
      <div class="avatar" style="width:32px;height:32px;font-size:12px;background:var(--green);">${(u.nombre||u.username||'?')[0].toUpperCase()}</div>
      <div class="user-card-info">
        <div class="user-card-name">${u.nombre||u.username||'Sin nombre'}</div>
        <div class="user-card-email">${u.email||''}</div>
      </div>
    </div>
  `).join('');
}

function selectAjusteUser(uid,nombre){
  _ajusteSelectedUid=uid;
  document.getElementById('ajusteUserResults').innerHTML='';
  document.getElementById('ajusteSearchUser').value='';
  const sel=document.getElementById('ajusteSelectedUser');
  sel.style.display='block';
  sel.textContent='✓ '+nombre;
}

async function saveAjuste(){
  if(!_ajusteSelectedUid){alert('Selecciona un usuario');return;}
  const monto=parseInt(document.getElementById('ajusteMonto').value);
  if(!monto||monto===0){alert('Ingresa una cantidad valida');return;}
  const desc=document.getElementById('ajusteDescripcion').value.trim()||'Ajuste administrativo';

  try{
    await db.runTransaction(async(transaction)=>{
      const walletRef=db.collection('wallets').doc(_ajusteSelectedUid);
      const walletDoc=await transaction.get(walletRef);
      const currentBalance=walletDoc.exists?walletDoc.data().balance||0:0;
      const newBalance=currentBalance+monto;
      if(newBalance<0){throw new Error('El saldo no puede quedar negativo');}

      transaction.set(walletRef,{
        balance:newBalance,
        actualizado:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});

      transaction.set(db.collection('transactions').doc(),{
        user_id:_ajusteSelectedUid,
        tipo:'ajuste_admin',
        monto:monto,
        balance_antes:currentBalance,
        balance_despues:newBalance,
        estado:'completado',
        referencia:'ADJ-'+Date.now(),
        descripcion:desc,
        metadata:{admin_uid:STATE.user.uid},
        creado:firebase.firestore.FieldValue.serverTimestamp(),
        procesado:firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    closeModalAjuste();
  }catch(e){
    console.error('saveAjuste error:',e);
    alert('Error: '+e.message);
  }
}

// ── Wallet Config Modal ──────────────────────────────
function openModalWalletConfig(){
  const body=document.getElementById('modalWalletConfigBody');
  const config=STATE.walletConfig||{};
  const precios=config.precios||[
    {pelotas:10,precio_usd:1,precio_bs:35},
    {pelotas:50,precio_usd:4.5,precio_bs:160},
    {pelotas:100,precio_usd:8,precio_bs:290}
  ];

  let html=`
    <div class="config-section">
      <div class="text-12 font-bold mb-8" style="color:var(--green);">BONOS AUTOMATICOS</div>
      <div class="config-row">
        <span class="config-label">🎁 Bono de bienvenida</span>
        <div class="flex items-center gap-8">
          <input type="number" class="config-input" id="cfgBonoBienvenida" value="${config.bono_bienvenida||0}" min="0"/>
          <span class="text-11 text-muted">pelotas</span>
        </div>
      </div>
      <div class="config-row">
        <span class="config-label">👥 Bono referido (quien refiere)</span>
        <div class="flex items-center gap-8">
          <input type="number" class="config-input" id="cfgBonoReferrer" value="${config.bono_referido_referrer||0}" min="0"/>
          <span class="text-11 text-muted">pelotas</span>
        </div>
      </div>
      <div class="config-row">
        <span class="config-label">👤 Bono referido (nuevo usuario)</span>
        <div class="flex items-center gap-8">
          <input type="number" class="config-input" id="cfgBonoReferido" value="${config.bono_referido_referido||0}" min="0"/>
          <span class="text-11 text-muted">pelotas</span>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="text-12 font-bold mb-8" style="color:var(--green);">PAQUETES DE PELOTAS</div>`;
  precios.forEach((p,i)=>{
    html+=`
      <div class="config-row">
        <div class="flex items-center gap-8">
          <input type="number" class="config-input" id="cfgPkg${i}Balls" value="${p.pelotas}" min="1" style="width:60px;"/>
          <span class="text-11 text-muted">pelotas</span>
        </div>
        <div class="flex items-center gap-8">
          <span class="text-11">$</span>
          <input type="number" class="config-input" id="cfgPkg${i}USD" value="${p.precio_usd}" min="0" step="0.5" style="width:70px;"/>
          <span class="text-11">Bs.</span>
          <input type="number" class="config-input" id="cfgPkg${i}BS" value="${p.precio_bs}" min="0" style="width:70px;"/>
        </div>
      </div>`;
  });
  html+=`
    </div>
    <button class="btn-save" onclick="saveWalletConfig()">Guardar configuracion</button>`;

  body.innerHTML=html;
  document.getElementById('modalWalletConfig').style.display='flex';
}

function closeModalWalletConfig(){
  document.getElementById('modalWalletConfig').style.display='none';
}

async function saveWalletConfig(){
  try{
    const precios=[];
    for(let i=0;i<3;i++){
      const balls=parseInt(document.getElementById('cfgPkg'+i+'Balls').value)||0;
      const usd=parseFloat(document.getElementById('cfgPkg'+i+'USD').value)||0;
      const bs=parseFloat(document.getElementById('cfgPkg'+i+'BS').value)||0;
      if(balls>0) precios.push({pelotas:balls,precio_usd:usd,precio_bs:bs});
    }

    await db.doc('app_config/wallet').set({
      bono_bienvenida:parseInt(document.getElementById('cfgBonoBienvenida').value)||0,
      bono_referido_referrer:parseInt(document.getElementById('cfgBonoReferrer').value)||0,
      bono_referido_referido:parseInt(document.getElementById('cfgBonoReferido').value)||0,
      precios:precios,
      actualizado:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});

    closeModalWalletConfig();
  }catch(e){
    console.error('saveWalletConfig error:',e);
    alert('Error: '+e.message);
  }
}
