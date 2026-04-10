// ══════════════════════════════════════════════════════
// GOLFEADOS — Wallet (User Billetera)
// ══════════════════════════════════════════════════════

// Golf ball SVG icon (inline, scalable)
function golfBallSVG(size=20){
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
    <circle cx="20" cy="20" r="18" fill="#F5F5F5" stroke="#D0D0D0" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="2" fill="#E0E0E0"/><circle cx="22" cy="11" r="2" fill="#E0E0E0"/>
    <circle cx="28" cy="16" r="2" fill="#E0E0E0"/><circle cx="12" cy="22" r="2" fill="#E0E0E0"/>
    <circle cx="20" cy="20" r="2" fill="#E0E0E0"/><circle cx="27" cy="24" r="2" fill="#E0E0E0"/>
    <circle cx="16" cy="29" r="2" fill="#E0E0E0"/><circle cx="24" cy="29" r="2" fill="#E0E0E0"/>
  </svg>`;
}

// Update the header pelotas counter (called from any tab)
function updateHeaderPelotas(balance){
  const countEl=document.getElementById('headerPelotasCount');
  if(countEl) countEl.textContent=balance||0;
  const iconEl=document.getElementById('headerPelotasIcon');
  if(iconEl&&!iconEl.dataset.set){ iconEl.innerHTML=golfBallSVG(18); iconEl.dataset.set='1'; }
}

function renderWallet(){
  const el=document.getElementById('tab-wallet');
  if(!el) return;

  const balance=STATE.wallet?.balance||0;
  const txs=STATE.myTransactions||[];

  // Update header pill
  updateHeaderPelotas(balance);

  let html=`
    <div class="wallet-hero">
      <div class="wallet-balance-label">Tu saldo</div>
      <div class="wallet-balance">${golfBallSVG(44)} ${balance}</div>
      <div class="wallet-balance-label">pelotas de golf</div>
      <div class="wallet-actions">
        <button class="btn-wallet-recargar" onclick="openModalRecarga()">+ Recargar</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Historial de movimientos</span>
        <span class="text-11 text-muted">${txs.length} movimiento${txs.length!==1?'s':''}</span>
      </div>`;

  if(txs.length===0){
    html+=`<div class="card-body" style="text-align:center;padding:32px;">
      <div style="font-size:32px;margin-bottom:8px;">💰</div>
      <div class="text-13 text-muted">Aun no tienes movimientos</div>
      <div class="text-11 text-muted mt-8">Recarga tu billetera para empezar</div>
    </div>`;
  } else {
    html+=`<ul class="tx-list">`;
    txs.forEach(tx=>{
      const isCredit=tx.monto>0;
      const isPending=tx.estado==='pendiente';
      const cls=isPending?'pending':isCredit?'credit':'debit';
      const icon=_txIcon(tx.tipo);
      const sign=isCredit?'+':'';
      const fecha=_formatTxDate(tx.creado);
      const desc=tx.descripcion||_txDescDefault(tx.tipo);
      html+=`
        <li class="tx-item">
          <div class="tx-icon ${cls}">${icon}</div>
          <div class="tx-info">
            <div class="tx-desc">${desc}</div>
            <div class="tx-date">${fecha}</div>
          </div>
          <div style="text-align:right;">
            <div class="tx-amount ${cls}">${sign}${tx.monto}</div>
            <span class="tx-badge ${tx.estado}">${_txEstadoLabel(tx.estado)}</span>
          </div>
        </li>`;
    });
    html+=`</ul>`;
  }
  html+=`</div>`;
  el.innerHTML=html;
}

// ── Helpers ──────────────────────────────────────────
function _txIcon(tipo){
  const map={
    recarga_tarjeta:'💳', recarga_pago_movil:'📱',
    bono_bienvenida:'🎁', bono_referido:'👥',
    ajuste_admin:'⚙️', gasto:'🏌️'
  };
  return map[tipo]||'💰';
}

function _txDescDefault(tipo){
  const map={
    recarga_tarjeta:'Recarga con tarjeta',
    recarga_pago_movil:'Recarga por Pago Movil',
    bono_bienvenida:'Bono de bienvenida',
    bono_referido:'Bono por referido',
    ajuste_admin:'Ajuste administrativo',
    gasto:'Uso de pelotas'
  };
  return map[tipo]||'Movimiento';
}

function _txEstadoLabel(estado){
  const map={completado:'Completado',pendiente:'Pendiente',fallido:'Fallido',rechazado:'Rechazado'};
  return map[estado]||estado;
}

function _formatTxDate(ts){
  if(!ts) return '';
  const d=ts.toDate?ts.toDate():new Date(ts);
  return d.toLocaleDateString('es',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ── Modal Recarga ────────────────────────────────────
let _selectedPkg=null;

function openModalRecarga(){
  _selectedPkg=null;
  const body=document.getElementById('modalRecargaBody');
  const config=STATE.walletConfig||{};
  const precios=config.precios||[
    {pelotas:10,precio_usd:1,precio_bs:35},
    {pelotas:50,precio_usd:4.5,precio_bs:160},
    {pelotas:100,precio_usd:8,precio_bs:290}
  ];

  let html=`
    <div class="text-13 font-bold mb-12">Selecciona un paquete</div>
    <div class="pkg-grid">`;
  precios.forEach((p,i)=>{
    html+=`
      <div class="pkg-card" id="pkg-${i}" onclick="selectPkg(${i})">
        <div class="pkg-balls">⛳ ${p.pelotas}</div>
        <div class="pkg-label">pelotas</div>
        <div class="pkg-price">$${p.precio_usd.toFixed(2)} USD</div>
      </div>`;
  });
  html+=`</div>

    <div id="recargaPayMethods" style="display:none;margin-top:16px;">
      <div class="text-13 font-bold mb-12">Metodo de pago</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn-green" onclick="payWithStripe()" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;">
          💳 Tarjeta de Credito
        </button>`;

  // Pago Movil only for Venezuelan users
  const phone=STATE.profile?.telefonoCompleto||STATE.profile?.telefono||'';
  const isVenezuelan=phone.startsWith('+58');
  if(isVenezuelan){
    html+=`
        <button class="btn-blue" onclick="payWithPagoMovil()" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;">
          📱 Pago Movil
        </button>`;
  }
  html+=`
      </div>
    </div>

    <div id="recargaPagoMovilForm" style="display:none;margin-top:16px;">
      <div class="text-13 font-bold mb-12">📱 Datos del Pago Movil</div>
      <div style="background:var(--bluePale);border:1px solid #B3D9E8;border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px;color:var(--blue);line-height:1.6;">
        <strong>Enviar pago a:</strong><br/>
        Banco: <strong>Banesco</strong><br/>
        Telefono: <strong>04XX-XXX-XXXX</strong><br/>
        Cedula: <strong>V-XX.XXX.XXX</strong><br/>
        Monto: <strong id="pmMonto">Bs. 0</strong>
      </div>
      <div class="field">
        <label>Numero de referencia</label>
        <input type="text" class="form-input" id="pmReferencia" placeholder="Ultimos 6 digitos"/>
      </div>
      <div class="field">
        <label>Banco emisor</label>
        <select class="form-select" id="pmBanco" style="width:100%;">
          <option value="">Seleccionar banco...</option>
          <option>Banesco</option><option>Mercantil</option><option>Provincial</option>
          <option>Venezuela</option><option>BNC</option><option>Bicentenario</option>
          <option>Tesoro</option><option>Fondo Comun</option><option>Otro</option>
        </select>
      </div>
      <div class="field">
        <label>Telefono usado</label>
        <input type="text" class="form-input" id="pmTelefono" placeholder="04XX-XXXXXXX" value="${phone.replace('+58','0')}"/>
      </div>
      <button class="btn-save" onclick="submitPagoMovil()">Enviar comprobante</button>
    </div>

    <div id="recargaSuccess" style="display:none;margin-top:16px;">
      <div class="success-box">
        <div style="font-size:40px;margin-bottom:8px;">✅</div>
        <div class="text-15 font-bold">Solicitud enviada</div>
        <div class="text-12 text-muted mt-8">Tu recarga sera procesada pronto. Veras el saldo actualizado cuando sea aprobada.</div>
        <button class="btn-outline mt-16" onclick="closeModalRecarga()">Cerrar</button>
      </div>
    </div>`;

  body.innerHTML=html;
  document.getElementById('modalRecarga').style.display='flex';
}

function closeModalRecarga(){
  document.getElementById('modalRecarga').style.display='none';
  _selectedPkg=null;
}

function selectPkg(idx){
  _selectedPkg=idx;
  document.querySelectorAll('.pkg-card').forEach((c,i)=>c.classList.toggle('selected',i===idx));
  document.getElementById('recargaPayMethods').style.display='block';
  document.getElementById('recargaPagoMovilForm').style.display='none';
  document.getElementById('recargaSuccess').style.display='none';

  // Update Pago Movil amount
  const config=STATE.walletConfig||{};
  const precios=config.precios||[
    {pelotas:10,precio_usd:1,precio_bs:35},
    {pelotas:50,precio_usd:4.5,precio_bs:160},
    {pelotas:100,precio_usd:8,precio_bs:290}
  ];
  const pkg=precios[idx];
  const pmMonto=document.getElementById('pmMonto');
  if(pmMonto&&pkg) pmMonto.textContent='Bs. '+pkg.precio_bs;
}

function payWithStripe(){
  // Phase 3: Stripe integration via Cloud Function
  alert('Pago con tarjeta estara disponible pronto. Por ahora usa Pago Movil o contacta al admin.');
}

function payWithPagoMovil(){
  document.getElementById('recargaPayMethods').style.display='none';
  document.getElementById('recargaPagoMovilForm').style.display='block';
}

async function submitPagoMovil(){
  if(_selectedPkg===null) return;
  const config=STATE.walletConfig||{};
  const precios=config.precios||[
    {pelotas:10,precio_usd:1,precio_bs:35},
    {pelotas:50,precio_usd:4.5,precio_bs:160},
    {pelotas:100,precio_usd:8,precio_bs:290}
  ];
  const pkg=precios[_selectedPkg];
  const ref=document.getElementById('pmReferencia').value.trim();
  const banco=document.getElementById('pmBanco').value;
  const tel=document.getElementById('pmTelefono').value.trim();

  if(!ref||!banco||!tel){
    alert('Completa todos los campos');
    return;
  }

  try{
    const uid=STATE.user.uid;
    const batch=db.batch();

    // Create pago_movil_recargas doc
    const pmRef=db.collection('pago_movil_recargas').doc();
    batch.set(pmRef,{
      user_id:uid,
      monto_bs:pkg.precio_bs,
      referencia:ref,
      telefono:tel,
      banco:banco,
      paquete:{pelotas:pkg.pelotas,precio_bs:pkg.precio_bs,precio_usd:pkg.precio_usd},
      estado:'pendiente',
      creado:firebase.firestore.FieldValue.serverTimestamp()
    });

    // Create pending transaction
    const txRef=db.collection('transactions').doc();
    batch.set(txRef,{
      user_id:uid,
      tipo:'recarga_pago_movil',
      monto:pkg.pelotas,
      balance_antes:STATE.wallet?.balance||0,
      balance_despues:STATE.wallet?.balance||0, // won't change until approved
      estado:'pendiente',
      referencia:ref,
      descripcion:'Recarga Pago Movil - '+pkg.pelotas+' pelotas',
      metadata:{pago_movil_id:pmRef.id,banco:banco,telefono:tel,monto_bs:pkg.precio_bs},
      creado:firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Show success
    document.getElementById('recargaPagoMovilForm').style.display='none';
    document.getElementById('recargaSuccess').style.display='block';
  }catch(e){
    console.error('submitPagoMovil error:',e);
    alert('Error al enviar el comprobante: '+e.message);
  }
}
