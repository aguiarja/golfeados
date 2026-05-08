// ══════════════════════════════════════════════════════
// GOLFEADOS — Inscripción a Torneos
// ══════════════════════════════════════════════════════

function openModalInscripcion(torneoId){
  const t=(STATE.allTorneos||[]).find(x=>x.id===torneoId);
  if(!t){ alert('Torneo no encontrado'); return; }
  const body=document.getElementById('modalInscripcionBody');
  const title=document.getElementById('modalInscripcionTitle');
  title.textContent='Inscripción: '+t.nombre;
  const uid=STATE.user?.uid;
  const costoTxt=t.costoInscripcion>0
    ?(t.costoInscripcion+' '+(t.monedaInscripcion==='pelotas'?'⛳ pelotas':t.monedaInscripcion))
    :'Gratis';
  const yaInscrito=(STATE.inscripciones||[]).find(i=>i.torneo_id===torneoId&&i.user_id===uid);
  if(yaInscrito){ body.innerHTML=_inscripcionEstadoHTML(yaInscrito,t); document.getElementById('modalInscripcion').style.display='flex'; return; }
  const logoEl=t.logoURL
    ?`<img src="${t.logoURL}" style="width:64px;height:64px;border-radius:14px;object-fit:cover;margin-bottom:8px;border:1px solid var(--border);"/>`
    :`<div style="width:64px;height:64px;border-radius:14px;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;margin:0 auto 8px;">🏆</div>`;
  let html=`
    <div style="text-align:center;margin-bottom:16px;">${logoEl}
      <div class="text-15 font-bold">${t.nombre}</div>
      ${t.descripcion?`<div class="text-12 text-muted" style="margin-top:6px;">${t.descripcion}</div>`:''}
    </div>
    <div style="background:var(--cardL);border-radius:10px;padding:12px;margin-bottom:16px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="text-12 text-muted">Costo</span>
        <span class="text-14 font-bold" style="color:var(--green);">${costoTxt}</span>
      </div>
      ${t.costoInscripcion>0&&t.monedaInscripcion==='pelotas'?`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">
        <span class="text-12 text-muted">Tu saldo</span>
        <span class="text-14 font-bold">${STATE.wallet?.balance||0} ⛳</span>
      </div>`:''}
    </div>`;
  if(t.costoInscripcion>0){
    if(t.monedaInscripcion==='pelotas'){
      const balance=STATE.wallet?.balance||0;
      const canPay=balance>=t.costoInscripcion;
      html+=canPay
        ?`<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:10px;padding:12px;font-size:12px;color:#2E7D32;margin-bottom:16px;">✅ Se descontarán <strong>${t.costoInscripcion} pelotas</strong> al inscribirte.</div>
          <button class="btn-green" onclick="submitInscripcion('${torneoId}','pelotas')" style="width:100%;padding:14px;font-size:14px;">⛳ Inscribirme (${t.costoInscripcion} pelotas)</button>`
        :`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:10px;padding:12px;font-size:12px;color:#E65100;margin-bottom:16px;">⚠️ Saldo insuficiente. Necesitas ${t.costoInscripcion} y tienes ${balance} pelotas.</div>
          <button class="btn-outline" onclick="closeModalInscripcion();goTab('wallet');" style="width:100%;padding:12px;">Recargar pelotas ⛳</button>`;
    } else {
      html+=`<div style="background:var(--cardL);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;line-height:1.7;">
          Realiza el pago de <strong>${t.costoInscripcion} ${t.monedaInscripcion}</strong> y envía el comprobante. El organizador aprobará tu inscripción.
        </div>
        <div style="margin-bottom:12px;"><label class="form-label">Referencia de pago *</label>
          <input type="text" class="form-input" id="inscRef" placeholder="Nro. de referencia"/></div>
        <div style="margin-bottom:16px;"><label class="form-label">Nota (opcional)</label>
          <input type="text" class="form-input" id="inscNota" placeholder="Titular, banco, etc."/></div>
        <button class="btn-green" onclick="submitInscripcion('${torneoId}','referencia')" style="width:100%;padding:14px;font-size:14px;">Enviar solicitud</button>`;
    }
  } else {
    html+=`<button class="btn-green" onclick="submitInscripcion('${torneoId}','gratis')" style="width:100%;padding:14px;font-size:14px;">🏌️ Inscribirme gratis</button>`;
  }
  body.innerHTML=html;
  document.getElementById('modalInscripcion').style.display='flex';
}

function _inscripcionEstadoHTML(insc,t){
  const cfg={
    pendiente:{icon:'⏳',color:'#E65100',label:'Pendiente de aprobación',desc:'El organizador revisará tu inscripción pronto.'},
    aprobada:{icon:'✅',color:'var(--green)',label:'Inscripción aprobada',desc:'¡Ya estás inscrito en este torneo!'},
    rechazada:{icon:'❌',color:'#C62828',label:'Inscripción rechazada',desc:insc.motivo_rechazo||'Tu inscripción fue rechazada.'}
  };
  const e=cfg[insc.estado]||cfg.pendiente;
  return`<div style="text-align:center;padding:20px 0;">
    <div style="font-size:48px;margin-bottom:12px;">${e.icon}</div>
    <div class="text-15 font-bold" style="color:${e.color};">${e.label}</div>
    <div class="text-12 text-muted" style="margin-top:8px;">${e.desc}</div>
    <button class="btn-outline" onclick="closeModalInscripcion()" style="margin-top:16px;">Cerrar</button>
  </div>`;
}

function closeModalInscripcion(){ document.getElementById('modalInscripcion').style.display='none'; }

async function submitInscripcion(torneoId, metodo){
  const t=(STATE.allTorneos||[]).find(x=>x.id===torneoId);
  if(!t) return;
  const uid=STATE.user.uid;
  try{
    const data={torneo_id:torneoId,user_id:uid,user_nombre:STATE.profile?.nombre||STATE.user.displayName||'',
      user_email:STATE.user.email||'',metodo_pago:metodo,costo:t.costoInscripcion||0,
      moneda:t.monedaInscripcion||'pelotas',estado:metodo==='gratis'?'aprobada':'pendiente',
      creado:firebase.firestore.FieldValue.serverTimestamp()};
    if(metodo==='referencia'){
      const ref=document.getElementById('inscRef')?.value.trim();
      if(!ref){ alert('Ingresa la referencia de pago'); return; }
      data.referencia=ref; data.nota=document.getElementById('inscNota')?.value.trim()||'';
    }
    if(metodo==='pelotas'){
      const balance=STATE.wallet?.balance||0;
      if(balance<t.costoInscripcion){ alert('Saldo insuficiente'); return; }
      const batch=db.batch();
      batch.update(db.collection('wallets').doc(uid),{balance:firebase.firestore.FieldValue.increment(-t.costoInscripcion),updated_at:firebase.firestore.FieldValue.serverTimestamp()});
      batch.set(db.collection('transactions').doc(),{user_id:uid,tipo:'gasto',monto:-t.costoInscripcion,balance_antes:balance,balance_despues:balance-t.costoInscripcion,estado:'completado',descripcion:'Inscripción: '+t.nombre,metadata:{torneo_id:torneoId},creado:firebase.firestore.FieldValue.serverTimestamp()});
      data.estado='aprobada';
      batch.set(db.collection('inscripciones').doc(),data);
      await batch.commit();
    } else {
      await db.collection('inscripciones').add(data);
    }
    const ok=data.estado==='aprobada';
    document.getElementById('modalInscripcionBody').innerHTML=`
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:48px;margin-bottom:12px;">${ok?'✅':'⏳'}</div>
        <div class="text-15 font-bold" style="color:${ok?'var(--green)':'#E65100'};">${ok?'¡Inscripción exitosa!':'Solicitud enviada'}</div>
        <div class="text-12 text-muted" style="margin-top:8px;">${ok?'Ya estás inscrito en '+t.nombre+'.':'El organizador revisará tu solicitud pronto.'}</div>
        <button class="btn-outline" onclick="closeModalInscripcion()" style="margin-top:16px;">Cerrar</button>
      </div>`;
  }catch(e){ console.error('submitInscripcion:',e); alert('Error: '+e.message); }
}

function openModalPendientes(torneoId){
  const t=(STATE.allTorneos||STATE.torneos||[]).find(x=>x.id===torneoId);
  if(!t) return;
  document.getElementById('modalPendientesTitle').textContent='Pendientes: '+t.nombre;
  const pendientes=(STATE.inscripciones||[]).filter(i=>i.torneo_id===torneoId&&i.estado==='pendiente');
  const body=document.getElementById('modalPendientesBody');
  body.innerHTML=pendientes.length===0
    ?`<div style="text-align:center;padding:24px;color:var(--muted);">No hay inscripciones pendientes.</div>`
    :pendientes.map(insc=>`
      <div class="card" style="margin-bottom:10px;"><div style="padding:12px 16px;">
        <div class="text-14 font-bold">${insc.user_nombre||insc.user_email}</div>
        <div class="text-12 text-muted">${insc.user_email}</div>
        ${insc.referencia?`<div class="text-12" style="margin-top:4px;">Ref: <strong>${insc.referencia}</strong></div>`:''}
        ${insc.nota?`<div class="text-11 text-muted">${insc.nota}</div>`:''}
        <div class="text-12" style="margin-top:4px;">Pago: <strong>${insc.costo} ${insc.moneda}</strong></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-green" style="flex:1;font-size:12px;padding:8px;" onclick="aprobarInscripcion('${insc.id}','${torneoId}')">✅ Aprobar</button>
          <button class="btn-danger" style="flex:1;font-size:12px;padding:8px;" onclick="rechazarInscripcion('${insc.id}','${torneoId}')">❌ Rechazar</button>
        </div>
      </div></div>`).join('');
  document.getElementById('modalPendientes').style.display='flex';
}

function closeModalPendientes(){ document.getElementById('modalPendientes').style.display='none'; }

async function aprobarInscripcion(inscId,torneoId){
  try{
    await db.collection('inscripciones').doc(inscId).update({estado:'aprobada',aprobado_en:firebase.firestore.FieldValue.serverTimestamp()});
    openModalPendientes(torneoId);
  }catch(e){ alert('Error: '+e.message); }
}

async function rechazarInscripcion(inscId,torneoId){
  const motivo=prompt('Motivo del rechazo (opcional):')||'';
  try{
    await db.collection('inscripciones').doc(inscId).update({estado:'rechazada',motivo_rechazo:motivo,rechazado_en:firebase.firestore.FieldValue.serverTimestamp()});
    openModalPendientes(torneoId);
  }catch(e){ alert('Error: '+e.message); }
}
