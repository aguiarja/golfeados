// ══════════════════════════════════════════════════════
// GOLFEADOS — Inscripción a Torneos (multi-paso)
//   Paso 1: Detalles del torneo + datos del jugador (handicap)
//   Paso 2: Selección de modalidad de pago
//   Paso 3: Pago / comprobante
//   Paso 4: Confirmación
// ══════════════════════════════════════════════════════

let _inscState={ torneoId:null, step:1, handicap:'', categoria:'', metodoPagoId:'', referencia:'', nota:'' };

function _fmtCosto(t){
  if(!t.costoInscripcion||t.costoInscripcion<=0) return 'Gratis';
  const mon=t.monedaInscripcion;
  const sym=mon==='pelotas'?'⛳ pelotas':mon==='USD'?'USD':mon==='BS'?'Bs':mon;
  return `${t.costoInscripcion} ${sym}`;
}

function _fmtFechaInsc(v){
  if(!v) return '';
  const d=v.toDate?v.toDate():new Date(v);
  if(isNaN(d)) return '';
  return d.toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'numeric'});
}

function openModalInscripcion(torneoId){
  const t=(STATE.allTorneos||[]).find(x=>x.id===torneoId);
  if(!t){ alert('Torneo no encontrado'); return; }
  const uid=STATE.user?.uid;
  const yaInscrito=(STATE.inscripciones||[]).find(i=>i.torneo_id===torneoId&&i.user_id===uid);
  // Reset flow state
  _inscState={
    torneoId, step:1,
    handicap: yaInscrito?.handicap_thegreen||STATE.profile?.handicap_thegreen||'',
    categoria: yaInscrito?.categoria||'',
    metodoPagoId: yaInscrito?.metodo_pago_id||'',
    referencia: yaInscrito?.referencia||'',
    nota: yaInscrito?.nota||''
  };
  document.getElementById('modalInscripcionTitle').textContent=t.nombre;
  _renderInscripcionStep(t, yaInscrito);
  document.getElementById('modalInscripcion').style.display='flex';
}

function closeModalInscripcion(){ document.getElementById('modalInscripcion').style.display='none'; }

function _renderInscripcionStep(t, yaInscrito){
  const body=document.getElementById('modalInscripcionBody');
  // Always show torneo header
  const header=_torneoHeaderHTML(t, yaInscrito);
  // If already inscribed, show status + torneo details, allow viewing
  if(yaInscrito){
    body.innerHTML=header+_inscripcionEstadoHTML(yaInscrito,t);
    return;
  }
  // Si la fecha límite de inscripción ya venció y el usuario NO está inscrito,
  // solo mostramos info del torneo + mensaje. Sin formulario, sin botones de continuar.
  if(_isInscripcionVencida(t)){
    body.innerHTML=header+_renderVencidoHTML(t);
    return;
  }
  if(_inscState.step===1) body.innerHTML=header+_renderStep1(t);
  else if(_inscState.step===2) body.innerHTML=header+_renderStep2(t);
  else if(_inscState.step===3) body.innerHTML=header+_renderStep3(t);
}

function _isInscripcionVencida(t){
  if(!t.fecha_limite_inscripcion) return false;
  const d=t.fecha_limite_inscripcion.toDate?t.fecha_limite_inscripcion.toDate():new Date(t.fecha_limite_inscripcion);
  return !isNaN(d)&&d<new Date();
}

function _renderVencidoHTML(t){
  const fechaL=_fmtFechaInsc(t.fecha_limite_inscripcion);
  return `
    <div style="background:#FFEBEE;border:1px solid #FFCDD2;color:#C62828;border-radius:10px;padding:14px;margin-bottom:14px;text-align:center;">
      <div style="font-size:32px;margin-bottom:6px;">⏰</div>
      <div class="text-14 font-bold" style="margin-bottom:4px;">El proceso de inscripción para este torneo finalizó</div>
      ${fechaL?`<div class="text-12">La fecha límite fue el <strong>${fechaL}</strong>.</div>`:''}
    </div>
    <button class="btn-outline" onclick="closeModalInscripcion()" style="width:100%;">Cerrar</button>`;
}

function _torneoHeaderHTML(t, yaInscrito){
  const logoEl=t.logoURL
    ?`<img src="${t.logoURL}" data-torneo-id="${t.id}" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid var(--border);" onerror="this.style.display='none';this.nextSibling.style.display='flex';"/><div style="display:none;width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,var(--green),var(--teal));align-items:center;justify-content:center;color:#fff;font-size:24px;flex-shrink:0;">🏆</div>`
    :`<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,var(--green),var(--teal));display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;flex-shrink:0;">🏆</div>`;
  const infoLine=[t.club_nombre?`⛳ ${t.club_nombre}`:'', t.ciudad?`📍 ${t.ciudad}`:''].filter(Boolean).join(' · ');
  const fechaT=_fmtFechaInsc(t.fecha_torneo);
  const fechaL=_fmtFechaInsc(t.fecha_limite_inscripcion);
  const statusBadge=yaInscrito
    ?`<div style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;margin-top:4px;background:${yaInscrito.estado==='aprobada'?'#E8F5E9;color:#2E7D32':yaInscrito.estado==='rechazada'?'#FFEBEE;color:#C62828':'#FFF3E0;color:#E65100'};">${yaInscrito.estado==='aprobada'?'✅ Aprobada':yaInscrito.estado==='rechazada'?'❌ Rechazada':'⏳ Pendiente'}</div>`
    :'';
  return `
    <div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:var(--cardL);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;">
      ${logoEl}
      <div style="flex:1;min-width:0;">
        <div class="text-15 font-bold">${t.nombre}</div>
        ${infoLine?`<div class="text-12 text-muted" style="margin-top:2px;">${infoLine}</div>`:''}
        ${fechaT||fechaL?`<div class="text-11 text-muted" style="margin-top:2px;">${fechaT?`🗓 ${fechaT}`:''}${fechaT&&fechaL?' · ':''}${fechaL?`⏰ Cierra ${fechaL}`:''}</div>`:''}
        ${statusBadge}
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div class="text-13 font-bold" style="color:${t.costoInscripcion>0?'var(--green)':'var(--teal)'};">${_fmtCosto(t)}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
      <button class="btn-blue" style="font-size:12px;padding:7px 14px;" onclick="shareTorneoWA('${t.id}',event)">📲 Compartir por WhatsApp</button>
      ${t.docURL?`<a href="${t.docURL}" target="_blank" class="text-12" style="color:var(--blue);text-decoration:none;padding:7px 4px;">${t.docType==='pdf'?'📄 Ver reglamento':'🖼️ Ver imagen / reglamento'}</a>`:''}
    </div>
    ${t.descripcion?`<details style="margin-bottom:14px;"><summary style="font-size:12px;color:var(--muted);cursor:pointer;">📝 Ver descripción del torneo</summary><div class="text-12" style="margin-top:8px;padding:10px;background:var(--cardL);border-radius:8px;white-space:pre-wrap;line-height:1.5;">${t.descripcion}</div></details>`:''}`;
}

// ── PASO 1: Datos del jugador ──
function _renderStep1(t){
  const nombre=STATE.profile?.nombre||STATE.user?.displayName||STATE.user?.email||'';
  const vencido=_isInscripcionVencida(t);
  return `
    ${_stepIndicator(1,t)}
    <div class="text-13 font-bold" style="margin-bottom:10px;">Tus datos</div>
    <div style="margin-bottom:12px;">
      <label class="form-label">Nombre</label>
      <input class="form-input" value="${nombre}" disabled style="background:var(--cardL);"/>
    </div>
    <div style="margin-bottom:14px;">
      <label class="form-label">Handicap (TheGreen) *</label>
      <input type="number" step="0.1" class="form-input" id="inscHandicap" value="${_inscState.handicap}" placeholder="Ej: 18.5"/>
      <div class="text-11 text-muted" style="margin-top:4px;">Tu índice handicap registrado en TheGreen.</div>
    </div>
    ${_categoriasHTML(t)}
    <div style="display:flex;gap:10px;">
      <button class="btn-outline" onclick="closeModalInscripcion()" style="flex:1;">Cancelar</button>
      <button class="btn-green" onclick="inscNextStep()" style="flex:1;" ${vencido?'disabled':''}>Continuar →</button>
    </div>`;
}

function _categoriasHTML(t){
  const cats=Array.isArray(t.categorias)?t.categorias.filter(c=>c&&c.nombre):[];
  if(cats.length===0) return '';
  return `<div style="margin-bottom:16px;">
    <label class="form-label">Categoría *</label>
    <select class="form-select" id="inscCategoria" style="width:100%;">
      <option value="">— Selecciona tu categoría —</option>
      ${cats.map(c=>`<option value="${c.nombre}" ${_inscState.categoria===c.nombre?'selected':''}>${c.nombre}</option>`).join('')}
    </select>
    <div class="text-11 text-muted" style="margin-top:4px;">Categoría en la que participarás en este torneo.</div>
  </div>`;
}

// ── PASO 2: Selección modalidad de pago ──
function _renderStep2(t){
  const costo=t.costoInscripcion||0;
  // Gratis → saltarse a paso 3 (confirmación)
  if(costo<=0){ _inscState.step=3; _renderInscripcionStep(t); return ''; }
  // Pagar en pelotas → modalidad única
  if(t.monedaInscripcion==='pelotas'){
    return `${_stepIndicator(2,t)}
      <div class="text-13 font-bold" style="margin-bottom:10px;">Modalidad de pago</div>
      <div class="card" style="margin-bottom:14px;">
        <div style="padding:14px;display:flex;align-items:center;gap:12px;">
          <div style="font-size:28px;">⛳</div>
          <div style="flex:1;">
            <div class="text-14 font-bold">Pelotas (saldo en app)</div>
            <div class="text-11 text-muted">Tu saldo: ${STATE.wallet?.balance||0} ⛳</div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn-outline" onclick="inscPrevStep()" style="flex:1;">← Atrás</button>
        <button class="btn-green" onclick="_inscState.metodoPagoId='__pelotas__';inscNextStep()" style="flex:1;">Continuar →</button>
      </div>`;
  }
  // Modalidades configuradas por el dueño
  const metodos=(t.metodos_pago_aceptados||[]).map(id=>getMetodoPago(id)).filter(m=>m&&m.activo!==false);
  if(metodos.length===0){
    return `${_stepIndicator(2,t)}
      <div style="background:#FFF3E0;border:1px solid #FFB74D;color:#E65100;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;">
        ⚠️ El organizador no ha configurado modalidades de pago para este torneo.
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn-outline" onclick="inscPrevStep()" style="flex:1;">← Atrás</button>
      </div>`;
  }
  return `${_stepIndicator(2,t)}
    <div class="text-13 font-bold" style="margin-bottom:10px;">Selecciona modalidad de pago</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
      ${metodos.map(m=>`
        <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid ${_inscState.metodoPagoId===m.id?'var(--green)':'var(--border)'};border-radius:10px;cursor:pointer;background:${_inscState.metodoPagoId===m.id?'#E8F5E9':'var(--white)'};">
          <input type="radio" name="inscMetodo" value="${m.id}" ${_inscState.metodoPagoId===m.id?'checked':''} onchange="_inscState.metodoPagoId=this.value;_renderInscripcionStep((STATE.allTorneos||[]).find(x=>x.id==='${t.id}'))" style="width:18px;height:18px;accent-color:var(--green);"/>
          <div style="font-size:22px;">${_iconForTipo(m.tipo)}</div>
          <div style="flex:1;">
            <div class="text-14 font-bold">${m.nombre}</div>
            <div class="text-11 text-muted">${_labelForTipo(m.tipo)}</div>
          </div>
        </label>`).join('')}
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn-outline" onclick="inscPrevStep()" style="flex:1;">← Atrás</button>
      <button class="btn-green" onclick="inscNextStep()" style="flex:1;" ${_inscState.metodoPagoId?'':'disabled'}>Continuar →</button>
    </div>`;
}

// ── PASO 3: Datos de pago / comprobante ──
function _renderStep3(t){
  const costo=t.costoInscripcion||0;
  if(costo<=0){
    return `${_stepIndicator(3,t)}
      <div class="text-13" style="background:var(--cardL);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
        Este torneo es <strong>gratis</strong>. Tu inscripción será enviada al organizador para aprobación.
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn-outline" onclick="inscPrevStep()" style="flex:1;">← Atrás</button>
        <button class="btn-green" onclick="submitInscripcion()" style="flex:1;">Confirmar inscripción</button>
      </div>`;
  }
  if(_inscState.metodoPagoId==='__pelotas__'){
    const balance=STATE.wallet?.balance||0;
    const canPay=balance>=costo;
    return `${_stepIndicator(3,t)}
      <div style="background:var(--cardL);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span class="text-muted">Costo</span><strong>${costo} ⛳</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px;border-top:1px solid var(--border);padding-top:8px;">
          <span class="text-muted">Tu saldo</span><strong>${balance} ⛳</strong>
        </div>
      </div>
      ${canPay
        ?`<div style="background:#E8F5E9;border:1px solid #A5D6A7;color:#2E7D32;border-radius:8px;padding:10px;margin-bottom:14px;font-size:12px;">✅ Se descontarán ${costo} pelotas al inscribirte.</div>`
        :`<div style="background:#FFF3E0;border:1px solid #FFB74D;color:#E65100;border-radius:8px;padding:10px;margin-bottom:14px;font-size:12px;">⚠️ Saldo insuficiente. Necesitas ${costo} ⛳ y tienes ${balance} ⛳.</div>`}
      <div style="display:flex;gap:10px;">
        <button class="btn-outline" onclick="inscPrevStep()" style="flex:1;">← Atrás</button>
        ${canPay
          ?`<button class="btn-green" onclick="submitInscripcion()" style="flex:1;">⛳ Confirmar pago</button>`
          :`<button class="btn-teal" onclick="closeModalInscripcion();goTab('wallet')" style="flex:1;">Recargar pelotas</button>`}
      </div>`;
  }
  const m=getMetodoPago(_inscState.metodoPagoId);
  if(!m){
    return `${_stepIndicator(3,t)}
      <div style="background:#FFEBEE;color:#C62828;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;">Modalidad de pago no disponible.</div>
      <button class="btn-outline" onclick="inscPrevStep()" style="width:100%;">← Atrás</button>`;
  }
  return `${_stepIndicator(3,t)}
    <div style="background:var(--cardL);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span class="text-12 text-muted">Total a pagar</span>
        <span class="text-15 font-bold" style="color:var(--green);">${_fmtCosto(t)}</span>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:10px;">
        <div class="text-12 font-bold" style="margin-bottom:4px;">${_iconForTipo(m.tipo)} ${m.nombre}</div>
        <div class="text-12" style="white-space:pre-wrap;line-height:1.6;color:var(--text);">${m.instrucciones||''}</div>
        ${m.url?`<a href="${m.url}" target="_blank" class="text-12" style="display:inline-block;margin-top:8px;color:var(--blue);">🔗 Abrir link de pago</a>`:''}
      </div>
    </div>
    ${m.requiere_ref!==false?`
      <div style="margin-bottom:10px;"><label class="form-label">Número de referencia / comprobante *</label>
        <input class="form-input" id="inscRef" value="${_inscState.referencia}" placeholder="Ej: 00123456"/></div>`:''}
    <div style="margin-bottom:14px;"><label class="form-label">Nota (opcional)</label>
      <input class="form-input" id="inscNota" value="${_inscState.nota}" placeholder="Titular, banco, fecha, etc."/></div>
    <div style="display:flex;gap:10px;">
      <button class="btn-outline" onclick="inscPrevStep()" style="flex:1;">← Atrás</button>
      <button class="btn-green" onclick="submitInscripcion()" style="flex:1;">Enviar inscripción</button>
    </div>`;
}

function _stepIndicator(step,t){
  const costo=t.costoInscripcion||0;
  const totalSteps=costo>0?3:2;
  return `<div style="display:flex;justify-content:center;gap:6px;margin-bottom:12px;">
    ${Array.from({length:totalSteps}).map((_,i)=>{
      const n=i+1;
      const active=n===step, done=n<step;
      return `<div style="width:24px;height:6px;border-radius:3px;background:${done?'var(--green)':active?'var(--green)':'var(--border)'};"></div>`;
    }).join('')}
  </div>
  <div class="text-11 text-muted" style="text-align:center;margin-bottom:14px;">Paso ${step} de ${totalSteps}</div>`;
}

function _iconForTipo(tipo){
  return {transferencia:'🏦',pago_movil:'📱',zelle:'💵',tarjeta:'💳',efectivo:'💰',cripto:'₿',otro:'🔧'}[tipo]||'💳';
}
function _labelForTipo(tipo){
  return {transferencia:'Transferencia bancaria',pago_movil:'Pago Móvil',zelle:'Zelle',tarjeta:'Tarjeta / link de pago',efectivo:'Efectivo',cripto:'Cripto',otro:'Otro'}[tipo]||tipo;
}

function inscNextStep(){
  const t=(STATE.allTorneos||[]).find(x=>x.id===_inscState.torneoId);
  if(!t) return;
  if(_inscState.step===1){
    const hcap=document.getElementById('inscHandicap')?.value.trim();
    if(!hcap){ alert('Ingresa tu handicap de TheGreen.'); return; }
    _inscState.handicap=hcap;
    // Categoría si el torneo la requiere
    const hasCats=Array.isArray(t.categorias)&&t.categorias.filter(c=>c&&c.nombre).length>0;
    if(hasCats){
      const catSel=document.getElementById('inscCategoria');
      const catVal=catSel?catSel.value:'';
      if(!catVal){ alert('Selecciona tu categoría.'); return; }
      _inscState.categoria=catVal;
    }
    // If free → skip to confirm
    if(!t.costoInscripcion||t.costoInscripcion<=0){ _inscState.step=3; }
    else { _inscState.step=2; }
  } else if(_inscState.step===2){
    if(!_inscState.metodoPagoId){ alert('Selecciona una modalidad de pago.'); return; }
    _inscState.step=3;
  }
  _renderInscripcionStep(t);
}
function inscPrevStep(){
  const t=(STATE.allTorneos||[]).find(x=>x.id===_inscState.torneoId);
  if(!t) return;
  // Persist current step inputs before going back
  if(_inscState.step===3){
    _inscState.referencia=document.getElementById('inscRef')?.value.trim()||_inscState.referencia;
    _inscState.nota=document.getElementById('inscNota')?.value.trim()||_inscState.nota;
    _inscState.step=(t.costoInscripcion>0)?2:1;
  } else if(_inscState.step===2){
    _inscState.step=1;
  }
  _renderInscripcionStep(t);
}

function _inscripcionEstadoHTML(insc,t){
  const cfg={
    pendiente:{icon:'⏳',color:'#E65100',label:'Pendiente de aprobación',desc:'El organizador revisará tu inscripción pronto.'},
    aprobada:{icon:'✅',color:'var(--green)',label:'Inscripción aprobada',desc:'¡Ya estás inscrito en este torneo!'},
    rechazada:{icon:'❌',color:'#C62828',label:'Inscripción rechazada',desc:insc.motivo_rechazo||'Tu inscripción fue rechazada.'}
  };
  const e=cfg[insc.estado]||cfg.pendiente;
  const m=insc.metodo_pago_id&&insc.metodo_pago_id!=='__pelotas__'?getMetodoPago(insc.metodo_pago_id):null;
  return `<div style="text-align:center;padding:14px 0;">
    <div style="font-size:42px;margin-bottom:8px;">${e.icon}</div>
    <div class="text-14 font-bold" style="color:${e.color};">${e.label}</div>
    <div class="text-12 text-muted" style="margin-top:6px;">${e.desc}</div>
  </div>
  <div style="background:var(--cardL);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;">
    ${insc.handicap_thegreen?`<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span class="text-muted">Handicap (TheGreen)</span><strong>${insc.handicap_thegreen}</strong></div>`:''}
    ${insc.categoria?`<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span class="text-muted">Categoría</span><strong>🏷️ ${insc.categoria}</strong></div>`:''}
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span class="text-muted">Modalidad</span><strong>${m?m.nombre:insc.metodo_pago_id==='__pelotas__'?'⛳ Pelotas':'—'}</strong></div>
    ${insc.referencia?`<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span class="text-muted">Referencia</span><strong>${insc.referencia}</strong></div>`:''}
    <div style="display:flex;justify-content:space-between;"><span class="text-muted">Monto</span><strong>${insc.costo} ${insc.moneda}</strong></div>
  </div>
  <button class="btn-outline" onclick="closeModalInscripcion()" style="width:100%;">Cerrar</button>`;
}

async function submitInscripcion(){
  const t=(STATE.allTorneos||[]).find(x=>x.id===_inscState.torneoId);
  if(!t) return;
  const uid=STATE.user.uid;
  // Read latest inputs from step 3 if present
  const refEl=document.getElementById('inscRef'); if(refEl) _inscState.referencia=refEl.value.trim();
  const notaEl=document.getElementById('inscNota'); if(notaEl) _inscState.nota=notaEl.value.trim();
  const costo=t.costoInscripcion||0;
  const m=_inscState.metodoPagoId&&_inscState.metodoPagoId!=='__pelotas__'?getMetodoPago(_inscState.metodoPagoId):null;
  if(costo>0&&_inscState.metodoPagoId!=='__pelotas__'&&m&&m.requiere_ref!==false&&!_inscState.referencia){
    alert('Ingresa el número de referencia del pago.'); return;
  }
  const m_nombre=m?m.nombre:_inscState.metodoPagoId==='__pelotas__'?'Pelotas':'';
  try{
    const data={
      torneo_id:t.id, user_id:uid,
      user_nombre:STATE.profile?.nombre||STATE.user.displayName||'',
      user_email:STATE.user.email||'',
      handicap_thegreen:_inscState.handicap||'',
      categoria:_inscState.categoria||'',
      metodo_pago_id:_inscState.metodoPagoId||'',
      metodo_pago_nombre:m_nombre,
      costo, moneda:t.monedaInscripcion||'pelotas',
      referencia:_inscState.referencia||'',
      nota:_inscState.nota||'',
      estado: costo<=0?'pendiente':(_inscState.metodoPagoId==='__pelotas__'?'aprobada':'pendiente'),
      creado:firebase.firestore.FieldValue.serverTimestamp()
    };
    // Pelotas → wallet transaction + aprobar al toque
    if(_inscState.metodoPagoId==='__pelotas__'){
      const balance=STATE.wallet?.balance||0;
      if(balance<costo){ alert('Saldo insuficiente.'); return; }
      const batch=db.batch();
      batch.update(db.collection('wallets').doc(uid),{
        balance:firebase.firestore.FieldValue.increment(-costo),
        updated_at:firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection('transactions').doc(),{
        user_id:uid, tipo:'gasto', monto:-costo,
        balance_antes:balance, balance_despues:balance-costo,
        estado:'completado', descripcion:'Inscripción: '+t.nombre,
        metadata:{torneo_id:t.id},
        creado:firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection('inscripciones').doc(),data);
      await batch.commit();
    } else {
      await db.collection('inscripciones').add(data);
    }
    // Persist handicap_thegreen in user profile too (for future inscriptions)
    if(_inscState.handicap){
      try{ await db.collection('users').doc(uid).update({handicap_thegreen:_inscState.handicap}); }catch(e){}
    }
    const ok=data.estado==='aprobada';
    document.getElementById('modalInscripcionBody').innerHTML=`
      ${_torneoHeaderHTML(t,null)}
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:48px;margin-bottom:12px;">${ok?'✅':'⏳'}</div>
        <div class="text-15 font-bold" style="color:${ok?'var(--green)':'#E65100'};">${ok?'¡Inscripción exitosa!':'Solicitud enviada'}</div>
        <div class="text-12 text-muted" style="margin-top:8px;">${ok?'Ya estás inscrito en '+t.nombre+'.':'El organizador revisará tu solicitud pronto.'}</div>
        <button class="btn-outline" onclick="closeModalInscripcion()" style="margin-top:16px;">Cerrar</button>
      </div>`;
  }catch(e){
    console.error('submitInscripcion:',e);
    alert('Error: '+e.message);
  }
}

// ─── Admin: Pendientes ──────────────────────────────────────
function openModalPendientes(torneoId){
  const t=(STATE.allTorneos||STATE.torneos||[]).find(x=>x.id===torneoId);
  if(!t) return;
  document.getElementById('modalPendientesTitle').textContent='Pendientes: '+t.nombre;
  const pendientes=(STATE.inscripciones||[]).filter(i=>i.torneo_id===torneoId&&i.estado==='pendiente');
  const body=document.getElementById('modalPendientesBody');
  body.innerHTML=pendientes.length===0
    ?`<div style="text-align:center;padding:24px;color:var(--muted);">No hay inscripciones pendientes.</div>`
    :pendientes.map(insc=>{
      const m=insc.metodo_pago_id&&insc.metodo_pago_id!=='__pelotas__'?getMetodoPago(insc.metodo_pago_id):null;
      const metodoTxt=m?m.nombre:insc.metodo_pago_id==='__pelotas__'?'⛳ Pelotas':(insc.metodo_pago_nombre||'—');
      return `
      <div class="card" style="margin-bottom:10px;"><div style="padding:12px 16px;">
        <div class="text-14 font-bold">${insc.user_nombre||insc.user_email}</div>
        <div class="text-11 text-muted">${insc.user_email}</div>
        ${insc.handicap_thegreen?`<div class="text-12" style="margin-top:6px;">⛳ Handicap TheGreen: <strong>${insc.handicap_thegreen}</strong></div>`:''}
        <div class="text-12" style="margin-top:2px;">💳 ${metodoTxt}</div>
        ${insc.referencia?`<div class="text-12" style="margin-top:2px;">Ref: <strong>${insc.referencia}</strong></div>`:''}
        ${insc.nota?`<div class="text-11 text-muted" style="margin-top:2px;">${insc.nota}</div>`:''}
        <div class="text-12" style="margin-top:4px;">Pago: <strong>${insc.costo} ${insc.moneda}</strong></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-green" style="flex:1;font-size:12px;padding:8px;" onclick="aprobarInscripcion('${insc.id}','${torneoId}')">✅ Aprobar</button>
          <button class="btn-danger" style="flex:1;font-size:12px;padding:8px;" onclick="rechazarInscripcion('${insc.id}','${torneoId}')">❌ Rechazar</button>
        </div>
      </div></div>`;
    }).join('');
  document.getElementById('modalPendientes').style.display='flex';
}

function closeModalPendientes(){ document.getElementById('modalPendientes').style.display='none'; }

async function aprobarInscripcion(inscId,torneoId){
  try{
    const insc=(STATE.inscripciones||[]).find(i=>i.id===inscId);
    const batch=db.batch();
    batch.update(db.collection('inscripciones').doc(inscId),{estado:'aprobada',aprobado_en:firebase.firestore.FieldValue.serverTimestamp()});
    // Crea / actualiza el participante en el torneo con nombre, categoría, handicap
    if(insc&&insc.user_id){
      const partRef=db.collection('torneos').doc(torneoId).collection('participantes').doc(insc.user_id);
      const initials=(insc.user_nombre||insc.user_email||'?').split(' ').map(s=>s[0]).join('').toUpperCase().slice(0,2);
      batch.set(partRef,{
        jugador_id:insc.user_id,
        user_uid:insc.user_id,
        nombre:insc.user_nombre||insc.user_email||'',
        foto:initials,
        fotoURL:null,
        handicap:Number(insc.handicap_thegreen)||0,
        handicap_thegreen:insc.handicap_thegreen||'',
        categoria:insc.categoria||'',
        inscripcion_id:inscId,
        activo:true,
        fecha_ingreso:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
    }
    await batch.commit();
    openModalPendientes(torneoId);
  }catch(e){ console.error('aprobar:',e); alert('Error: '+e.message); }
}

async function rechazarInscripcion(inscId,torneoId){
  const motivo=prompt('Motivo del rechazo (opcional):')||'';
  try{
    await db.collection('inscripciones').doc(inscId).update({estado:'rechazada',motivo_rechazo:motivo,rechazado_en:firebase.firestore.FieldValue.serverTimestamp()});
    openModalPendientes(torneoId);
  }catch(e){ alert('Error: '+e.message); }
}
