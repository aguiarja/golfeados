// ══════════════════════════════════════════════════════
// GOLFEADOS — Cargar Resultados
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// CARGAR RESULTADOS
// ══════════════════════════════════════════════════════
let cargarEntries=[];

// ── CARGAR STATE ──────────────────────────────────────
let cargarStep=1; // 1=participantes, 2=posiciones
let cargarParticipantes=[]; // {jugador_id, jugador, asistio, dq}
let cargarPosiciones=[];    // [{pos, jugador_id, empate}] ordered list

function renderCargar(){
  const el=document.getElementById('tab-cargar');
  const jornadaId=STATE.cargarJornadaId;
  const partida=STATE.jornadas.find(j=>j.id===jornadaId);
  if(!partida){el.innerHTML='<p style="color:var(--muted);padding:20px;">Partida no encontrada.</p>';return;}

  // Init participantes if first load
  if(cargarParticipantes.length===0||cargarParticipantes[0]?._jid!==jornadaId){
    const existentes=STATE.resultados.filter(r=>r.jornada_id===jornadaId);
    // Use participants of the jornada's own torneo
    const jornadaTorneo=partida?.torneo_id||STATE.activeTorneoId;
    const jugsParaCargar=getJugadoresTorneo(jornadaTorneo).filter(j=>j.activo!==false);
    cargarParticipantes=jugsParaCargar.map(j=>{
      const ex=existentes.find(r=>r.jugador_id===j.id);
      return{_jid:jornadaId,jugador_id:j.id,jugador:j,asistio:ex?ex.asistencia!==false:true,dq:ex?.dq||false};
    });
    // Init posiciones from existing results if any
    if(existentes.length>0){
      const sorted=[...existentes].filter(r=>r.asistencia!==false).sort((a,b)=>a.pos-b.pos);
      cargarPosiciones=sorted.map(r=>({pos:r.pos,jugador_id:r.jugador_id,empate:false}));
    } else {
      cargarPosiciones=[];
    }
    cargarStep=1;
  }

  const header=`
    <div class="flex items-center gap-8 mb-16">
      <button class="btn-back" onclick="backFromCargar()">←</button>
      <div>
        <div class="text-15 font-bold font-georgia">${partida.sede} — ${fmtFecha(partida.fecha)}</div>
        <div class="text-12 text-muted">${badgeHTML(partida.estado)}</div>
      </div>
    </div>
    <div class="info-attest">✍️ Tú cargas → otro jugador confirma (Attest) → Admin aprueba como Oficial.</div>`;

  if(cargarStep===1){
    // ── STEP 1: Participantes ───────────────────────────
    el.innerHTML=header+`
    <div class="card mb-16">
      <div class="card-header">
        <span class="card-title">1️⃣ Participantes</span>
        <span class="text-11 text-muted">Desmarca quien no asistió</span>
      </div>
      ${cargarParticipantes.map(p=>`
        <div class="cargar-row" style="gap:10px;">
          ${p.jugador.fotoURL?`<img src="${p.jugador.fotoURL}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;"/>`:avatarHTML(p.jugador.foto,99,'sm')}
          <div style="flex:1;">
            <div class="text-13 font-bold">${p.jugador.nombre}</div>
            <div class="text-11 text-muted">${p.jugador.alias||''}</div>
          </div>
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;">
            <input type="checkbox" ${p.asistio?'checked':''} style="width:16px;height:16px;accent-color:var(--green);"
              onchange="toggleParticipante('${p.jugador_id}','asistio',this.checked)"/>
            <span>Jugó</span>
          </label>
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;${p.asistio?'':'opacity:0.4;pointer-events:none;'}">
            <input type="checkbox" ${p.dq?'checked':''} style="width:16px;height:16px;accent-color:var(--red);"
              ${p.asistio?'':'disabled'}
              onchange="toggleParticipante('${p.jugador_id}','dq',this.checked)"/>
            <span style="color:var(--red);">DQ</span>
          </label>
        </div>`).join('')}
    </div>
    <button class="btn-save" onclick="goCargarStep2()">Continuar → Asignar Posiciones</button>`;
  } else {
    // ── STEP 2: Posiciones ─────────────────────────────
    const asistentes=cargarParticipantes.filter(p=>p.asistio&&!p.dq);
    if(cargarPosiciones.length===0){
      // Start with ONE empty row
      cargarPosiciones=[{pos:1,jugador_id:'',empate:false}];
    }

    // Build set of already-used jugador_ids (one per row)
    const usados=new Set(cargarPosiciones.map(r=>r.jugador_id).filter(Boolean));
    const sinAsignar=asistentes.filter(p=>!usados.has(p.jugador_id));
    const totalAsistentes=asistentes.length;
    const totalAsignados=cargarPosiciones.filter(r=>r.jugador_id).length;
    const todoAsignado=totalAsignados>=totalAsistentes;

    el.innerHTML=header+`
    <div class="info-attest" style="background:#E3F2FD;border-color:#90CAF9;color:#1565C0;">
      📋 Asigna las posiciones de los <strong>${totalAsistentes}</strong> jugadores que participaron.
      ${todoAsignado?'<strong>✅ Todos asignados</strong>':`Faltan <strong>${totalAsistentes-totalAsignados}</strong>`}
    </div>
    <div class="card mb-16">
      <div class="card-header">
        <span class="card-title">2️⃣ Posiciones</span>
        <button class="btn-outline" style="font-size:11px;padding:4px 10px;" onclick="cargarStep=1;renderCargar()">← Volver</button>
      </div>
      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
        ${(()=>{
          return cargarPosiciones.map((row,idx)=>{
            const otherUsed=new Set(cargarPosiciones.filter((_,i)=>i!==idx).map(r=>r.jugador_id).filter(Boolean));
            const opts=asistentes
              .filter(p=>!otherUsed.has(p.jugador_id)||p.jugador_id===row.jugador_id)
              .map(p=>'<option value="'+p.jugador_id+'" '+(row.jugador_id===p.jugador_id?'selected':'')+'>'+p.jugador.nombre+'</option>').join('');
            const nextSamePos=!!(cargarPosiciones[idx+1]&&cargarPosiciones[idx+1].pos===row.pos);
            const posBg=row.pos===1?'var(--gold)':row.pos===2?'#78909C':row.pos===3?'#8D6E63':'var(--green)';
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--cardL);border-radius:10px;border:1px solid var(--border);">'+
              '<div style="width:36px;height:36px;border-radius:8px;background:'+posBg+';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;">'+row.pos+'\u00b0</div>'+
              '<select class="form-select" style="flex:1;" onchange="setPosJugador('+idx+',this.value)">'+
                '<option value="">— Seleccionar —</option>'+opts+
              '</select>'+
              '<label style="display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap;cursor:pointer;">'+
                '<input type="checkbox" '+(nextSamePos?'checked':'')+' style="accent-color:var(--blue);" onchange="toggleEmpate('+idx+',this.checked)"/> Empate'+
              '</label>'+
              '<button onclick="removePosRow('+idx+')" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;">\u2715</button>'+
            '</div>';
          }).join('');
        })()}

      </div>
    </div>

    <!-- FOTOS -->
    <div class="card mb-16" style="padding:16px;">
      <div class="card-header" style="margin-bottom:12px;"><span class="card-title">📷 Fotos del día (máx 3)</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;" id="jornadaFotoGrid">
        <div class="photo-upload-box" style="height:80px;padding:8px;" id="jornadaFotoSlot0" onclick="document.getElementById('jornadaFotoInput0').click()">
          <div style="font-size:22px;">📷</div><div style="font-size:10px;color:var(--muted);">Foto 1</div>
          <input type="file" id="jornadaFotoInput0" accept="image/*" style="display:none;" onchange="previewJornadaFoto(this,0)"/>
        </div>
        <div class="photo-upload-box" style="height:80px;padding:8px;" id="jornadaFotoSlot1" onclick="document.getElementById('jornadaFotoInput1').click()">
          <div style="font-size:22px;">📷</div><div style="font-size:10px;color:var(--muted);">Foto 2</div>
          <input type="file" id="jornadaFotoInput1" accept="image/*" style="display:none;" onchange="previewJornadaFoto(this,1)"/>
        </div>
        <div class="photo-upload-box" style="height:80px;padding:8px;" id="jornadaFotoSlot2" onclick="document.getElementById('jornadaFotoInput2').click()">
          <div style="font-size:22px;">📷</div><div style="font-size:10px;color:var(--muted);">Foto 3</div>
          <input type="file" id="jornadaFotoInput2" accept="image/*" style="display:none;" onchange="previewJornadaFoto(this,2)"/>
        </div>
      </div>
      <div class="upload-progress" style="margin-top:8px;"><div class="upload-progress-bar" id="jornadaFotoProgress"></div></div>
    </div>

    <div id="cargarError" class="error-box" style="display:none;"></div>
    <button class="btn-save" id="btnSave" onclick="saveResultados()">💾 Guardar y Enviar a Attest</button>`;
  }
}

function toggleParticipante(jugadorId,field,value){
  const p=cargarParticipantes.find(p=>p.jugador_id===jugadorId);
  if(!p)return;
  p[field]=value;
  if(field==='asistio'&&!value) p.dq=false;
  renderCargar();
}

function goCargarStep2(){
  cargarStep=2;
  cargarPosiciones=[];
  STATE._jornadaFotoFiles=[null,null,null];  // reset file refs on step2
  renderCargar();
  // Initialize foto slots immediately after render (DOM is ready)
  const jn=STATE.jornadas.find(j=>j.id===STATE.cargarJornadaId);
  const fotos=jn?.fotos||[];
  STATE._jornadaFotosExistentes=[...fotos];
  [0,1,2].forEach(i=>{ if(fotos[i]) setJornadaFotoSlot(i,fotos[i]); else resetJornadaFotoSlot(i); });
}

function setPosJugador(idx,jugadorId){
  if(!cargarPosiciones[idx]) return;
  cargarPosiciones[idx].jugador_id=jugadorId;
  // Auto-add next row if players still unassigned and no empty row waiting
  if(jugadorId){
    const asistentes=cargarParticipantes.filter(p=>p.asistio&&!p.dq);
    const usados=new Set(cargarPosiciones.map(r=>r.jugador_id).filter(Boolean));
    const hayPendientes=asistentes.some(p=>!usados.has(p.jugador_id));
    const lastIsEmpty=!cargarPosiciones[cargarPosiciones.length-1]?.jugador_id;
    if(hayPendientes && !lastIsEmpty){ addPosRow(); return; }
  }
  renderCargar();
}

function toggleEmpate(idx,checked){
  if(checked){
    const samePos=cargarPosiciones[idx].pos;
    // Insert empty row with SAME position right after
    cargarPosiciones.splice(idx+1,0,{pos:samePos,jugador_id:'',empate:true});
    // Subsequent rows: shift pos by 1 each (one extra player consumed this position)
    for(let i=idx+2;i<cargarPosiciones.length;i++) cargarPosiciones[i].pos++;
  } else {
    // Remove next row with same pos ONLY if it was added as empate
    if(cargarPosiciones[idx+1]&&cargarPosiciones[idx+1].pos===cargarPosiciones[idx].pos&&cargarPosiciones[idx+1].empate){
      const hadPlayer=!!cargarPosiciones[idx+1].jugador_id;
      cargarPosiciones.splice(idx+1,1);
      if(hadPlayer){
        // Restore subsequent positions
        for(let i=idx+1;i<cargarPosiciones.length;i++) cargarPosiciones[i].pos--;
      }
    }
  }
  renderCargar();
}

function addPosRow(){
  const last=cargarPosiciones[cargarPosiciones.length-1];
  // Next position = last pos + number of players at last pos (to account for empates)
  const sameAsLast=cargarPosiciones.filter(r=>r.pos===last?.pos).length;
  const nextPos=last?(last.pos+sameAsLast):1;
  cargarPosiciones.push({pos:nextPos,jugador_id:'',empate:false});
  renderCargar();
}

function removePosRow(idx){
  cargarPosiciones.splice(idx,1);
  // Recalculate positions
  let curPos=1;
  for(let i=0;i<cargarPosiciones.length;i++){
    if(i>0&&cargarPosiciones[i].pos===cargarPosiciones[i-1].pos){
      // keep same pos (empate)
    } else {
      cargarPosiciones[i].pos=curPos;
    }
    curPos=cargarPosiciones[i].pos+1;
  }
  renderCargar();
}

// Legacy updateEntry kept for backward compat
function updateEntry(jugadorId,field,value){ toggleParticipante(jugadorId,field,value); }

async function saveResultados(){
  const jornadaId=STATE.cargarJornadaId;
  const btn=document.getElementById('btnSave');
  const err=document.getElementById('cargarError');
  err.style.display='none';
  // Validate all asistentes have a position assigned
  const asistentesActivos=cargarParticipantes.filter(p=>p.asistio&&!p.dq);
  const asignadosIds=new Set(cargarPosiciones.filter(r=>r.jugador_id).map(r=>r.jugador_id));
  const sinPos=asistentesActivos.filter(p=>!asignadosIds.has(p.jugador_id));
  if(sinPos.length>0){
    err.textContent='Faltan posiciones para: '+sinPos.map(p=>p.jugador.nombre).join(', ');
    err.style.display='block'; return;
  }
  btn.disabled=true; btn.textContent='Guardando...';
  try{
    // Upload fotos — use stored File refs (DOM input loses files after innerHTML replace)
    let fotos=[...(STATE._jornadaFotosExistentes||[])];
    const fotoFiles=STATE._jornadaFotoFiles||[null,null,null];
    for(let i=0;i<3;i++){
      const file=fotoFiles[i];
      if(file){
        try{
          const compressed=await resizeAndCompress(file,1200,0.82);
          const url=await uploadPhoto(compressed,'jornadas/'+jornadaId+'_foto'+i+'.jpg','jornadaFotoProgress');
          fotos[i]=url;
          console.log('Foto '+i+' uploaded OK:', url.substring(0,60));
        }catch(uploadErr){
          console.error('Foto '+i+' upload failed:', uploadErr);
        }
      }
    }
    fotos=fotos.filter(Boolean);
    console.log('Total fotos to save:', fotos.length, fotos);

    const batch=db.batch();
    // Build results from new cargar model
    const partida=STATE.jornadas.find(j=>j.id===jornadaId);
    const torneoId=partida?.torneo_id||STATE.activeTorneoId||STATE.torneo?.id;
    const _baseReglas=getReglas(torneoId);
    const reglas=partida?.reglasOverride?Object.assign({},_baseReglas,{
      puntos:partida.reglasOverride.puntos||_baseReglas.puntos,
      bonusAsistencia:partida.reglasOverride.bonusAsistencia!=null?partida.reglasOverride.bonusAsistencia:_baseReglas.bonusAsistencia,
      penalNoAsistencia:partida.reglasOverride.penalNoAsistencia!=null?partida.reglasOverride.penalNoAsistencia:_baseReglas.penalNoAsistencia,
      penalDQ:partida.reglasOverride.penalDQ!=null?partida.reglasOverride.penalDQ:_baseReglas.penalDQ
    }):_baseReglas;

    // Merge participantes + posiciones
    cargarParticipantes.forEach(p=>{
      const posRow=cargarPosiciones.find(r=>r.jugador_id===p.jugador_id);
      const pos=posRow?.pos||99;
      // Calculate pts with empate logic
      const groupSize=cargarPosiciones.filter(r=>r.pos===pos).length;
      let basePts=0;
      if(p.asistio&&!p.dq){
        if(reglas.empates==='comparten'&&groupSize>1){
          let sum=0;
          for(let k=0;k<groupSize;k++) sum+=getPtsPosicion(pos+k,reglas);
          basePts=Math.round((sum/groupSize)*100)/100;
        } else {
          basePts=getPtsPosicion(pos,reglas);
        }
        basePts+=(reglas.bonusAsistencia||0);
        if(p.dq) basePts+=(reglas.penalDQ||0);
      } else if(!p.asistio){
        basePts=reglas.penalNoAsistencia||0;
      }
      batch.set(db.collection('resultados').doc(`${jornadaId}_${p.jugador_id}`),{
        jornada_id:jornadaId,jugador_id:p.jugador_id,
        pos:p.asistio?pos:99,pts:basePts,
        asistencia:p.asistio,dq:p.dq||false,
        cargado_por:STATE.profile?.jugador_id||STATE.user?.email,
        updated_at:firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    batch.update(db.collection('jornadas').doc(jornadaId),{
      estado:'Pendiente Attest',cargado_por:STATE.profile?.jugador_id||null,
      cargado_at:firebase.firestore.FieldValue.serverTimestamp(),
      ...(fotos.length?{fotos}:{})
    });
    await batch.commit();
    cargarEntries=[];
    cargarParticipantes=[]; cargarPosiciones=[]; cargarStep=1;
    // Update local fotos in STATE immediately
    if(fotos.length){
      const jnIdx=STATE.jornadas.findIndex(j=>j.id===jornadaId);
      if(jnIdx>-1) STATE.jornadas[jnIdx]={...STATE.jornadas[jnIdx],fotos};
    }
    STATE.expandedJornada=jornadaId;
    goTab('jornadas');
  }catch(e){
    err.textContent='Error: '+e.message; err.style.display='block';
    btn.disabled=false; btn.textContent='💾 Guardar y Enviar a Attest';
  }
}
function backFromCargar(){
  cargarEntries=[]; cargarParticipantes=[]; cargarPosiciones=[]; cargarStep=1;
  const ct=document.getElementById('tab-cargar'); if(ct) ct.style.display='none';
  goTab('jornadas');
}

// ── Carousel ──────────────────────────────────────────
const carouselIdx={};
function slideCarousel(jid,dir){
  const track=document.getElementById('carouselTrack_'+jid);
  if(!track) return;
  const n=track.querySelectorAll('img').length;
  carouselIdx[jid]=((carouselIdx[jid]||0)+dir+n)%n;
  track.style.transform='translateX(-'+(carouselIdx[jid]*100)+'%)';
  for(let i=0;i<n;i++){
    const dot=document.getElementById('dot_'+jid+'_'+i);
    if(dot) dot.style.background=i===carouselIdx[jid]?'#fff':'rgba(255,255,255,0.45)';
  }
}
function openCarousel(jid,startIdx){
  const jn=STATE.jornadas.find(j=>j.id===jid);
  if(!jn||!jn.fotos||!jn.fotos.length) return;
  let cur=startIdx||carouselIdx[jid]||0;
  const n=jn.fotos.length;
  const ov=document.createElement('div');
  ov.id='lightbox';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:9999;display:flex;align-items:center;justify-content:center;';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  function renderLB(){
    // Build lightbox content without nested quote issues
    const img=document.createElement('img');
    img.src=jn.fotos[cur];
    img.style.cssText='max-width:95vw;max-height:88vh;object-fit:contain;border-radius:8px;user-select:none;';
    ov.innerHTML='';
    ov.appendChild(img);
    // Counter
    const ctr=document.createElement('div');
    ctr.style.cssText='position:absolute;bottom:18px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:13px;';
    ctr.textContent=(cur+1)+' / '+n;
    ov.appendChild(ctr);
    // Close button
    const closeBtn=document.createElement('button');
    closeBtn.textContent='✕';
    closeBtn.style.cssText='position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:22px;border-radius:50%;width:42px;height:42px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    closeBtn.onclick=function(){ov.remove();};
    ov.appendChild(closeBtn);
    // Nav buttons
    if(n>1){
      const prev=document.createElement('button');
      prev.innerHTML='&#8249;';
      prev.style.cssText='position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:36px;border-radius:50%;width:52px;height:52px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      prev.onclick=function(e){e.stopPropagation();cur=(cur-1+n)%n;renderLB();};
      ov.appendChild(prev);
      const next=document.createElement('button');
      next.innerHTML='&#8250;';
      next.style.cssText='position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:36px;border-radius:50%;width:52px;height:52px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      next.onclick=function(e){e.stopPropagation();cur=(cur+1)%n;renderLB();};
      ov.appendChild(next);
    }
  }
  renderLB();
  document.body.appendChild(ov);
}
