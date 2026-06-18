// ══════════════════════════════════════════════════════
// GOLFEADOS — Admin Configuración
// Modalidades de pago + futuras secciones de configuración
// ══════════════════════════════════════════════════════

const _MP_TIPOS = {
  transferencia:'🏦 Transferencia',
  pago_movil:'📱 Pago Móvil',
  zelle:'💵 Zelle',
  tarjeta:'💳 Tarjeta',
  efectivo:'💰 Efectivo',
  cripto:'₿ Cripto',
  otro:'🔧 Otro'
};

function renderAdminConfig(){
  const el=document.getElementById('tab-admin-config');
  if(!el) return;
  if(STATE.profile?.role!=='admin'){
    el.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);">Solo administradores.</div>';
    return;
  }
  const metodos=STATE.metodosPago||[];
  el.innerHTML=`
    <div style="margin-bottom:14px;">
      <div class="text-15 font-bold">⚙️ Configuración</div>
      <div class="text-12 text-muted">Opciones globales de la plataforma.</div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <span class="card-title">💳 Modalidades de Pago</span>
        <button class="btn-green" style="font-size:12px;padding:6px 12px;" onclick="openModalMetodoPago()">+ Nueva</button>
      </div>
      <div class="card-body" style="padding:0;">
        ${metodos.length===0
          ?`<div style="padding:18px;text-align:center;color:var(--muted);font-size:13px;">No hay modalidades de pago configuradas. Crea una para que los dueños de torneos puedan ofrecerla como opción de pago.</div>`
          :metodos.map(m=>`
            <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--border);">
              <div style="font-size:22px;flex-shrink:0;">${(_MP_TIPOS[m.tipo]||'🔧').slice(0,2)}</div>
              <div style="flex:1;min-width:0;">
                <div class="text-14 font-bold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.nombre}</div>
                <div class="text-11 text-muted">${(_MP_TIPOS[m.tipo]||m.tipo||'').replace(/^.. /,'')}${m.activo===false?' · 🚫 Inactivo':''}</div>
              </div>
              <button class="btn-outline" style="font-size:11px;padding:5px 10px;" onclick="openModalMetodoPago('${m.id}')">✏️</button>
              <button class="btn-danger" style="font-size:11px;padding:5px 10px;" onclick="deleteMetodoPago('${m.id}')">🗑</button>
            </div>`).join('')}
      </div>
    </div>`;
}

// ─── Modal Modalidad de Pago ──────────────────────────────
let _editingMpId=null;
function openModalMetodoPago(mpId=null){
  _editingMpId=mpId;
  const m=mpId?(STATE.metodosPago||[]).find(x=>x.id===mpId):null;
  document.getElementById('modalMetodoPagoTitle').textContent=mpId?'Editar Modalidad de Pago':'Nueva Modalidad de Pago';
  document.getElementById('modalMetodoPagoError').style.display='none';
  document.getElementById('mpNombre').value=m?.nombre||'';
  document.getElementById('mpTipo').value=m?.tipo||'transferencia';
  document.getElementById('mpInstrucciones').value=m?.instrucciones||'';
  document.getElementById('mpUrl').value=m?.url||'';
  document.getElementById('mpRequiereRef').checked=m?.requiere_ref!==false;
  document.getElementById('mpActivo').checked=m?.activo!==false;
  document.getElementById('modalMetodoPago').style.display='flex';
}

function closeModalMetodoPago(ev){
  if(ev&&ev.target&&ev.target.id!=='modalMetodoPago') return;
  document.getElementById('modalMetodoPago').style.display='none';
}

async function saveMetodoPago(){
  const err=document.getElementById('modalMetodoPagoError');
  err.style.display='none';
  const nombre=document.getElementById('mpNombre').value.trim();
  const tipo=document.getElementById('mpTipo').value;
  const instrucciones=document.getElementById('mpInstrucciones').value.trim();
  const url=document.getElementById('mpUrl').value.trim();
  const requiere_ref=document.getElementById('mpRequiereRef').checked;
  const activo=document.getElementById('mpActivo').checked;
  if(!nombre){ err.textContent='El nombre es obligatorio.'; err.style.display='block'; return; }
  if(!instrucciones){ err.textContent='Las instrucciones / datos de pago son obligatorios.'; err.style.display='block'; return; }
  try{
    const data={nombre,tipo,instrucciones,url,requiere_ref,activo,
      updated_at:firebase.firestore.FieldValue.serverTimestamp()};
    if(_editingMpId){
      await db.collection('metodos_pago').doc(_editingMpId).update(data);
    } else {
      data.creado=firebase.firestore.FieldValue.serverTimestamp();
      data.creado_por=STATE.user.uid;
      await db.collection('metodos_pago').add(data);
    }
    closeModalMetodoPago();
  }catch(e){
    console.error('saveMetodoPago:',e);
    err.textContent='Error: '+e.message; err.style.display='block';
  }
}

async function deleteMetodoPago(mpId){
  const m=(STATE.metodosPago||[]).find(x=>x.id===mpId);
  if(!m) return;
  if(!confirm(`¿Eliminar la modalidad "${m.nombre}"?\n\nLos torneos que la tengan seleccionada seguirán mostrándola hasta que se edite el torneo.`)) return;
  try{
    await db.collection('metodos_pago').doc(mpId).delete();
  }catch(e){ alert('Error: '+e.message); }
}

// Helper: get a payment method by id (for tournament/inscription views)
function getMetodoPago(mpId){
  return (STATE.metodosPago||[]).find(m=>m.id===mpId)||null;
}
