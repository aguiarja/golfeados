// ══════════════════════════════════════════════════════
// GOLFEADOS — Modals (Torneo, Jornada, Club)
// ══════════════════════════════════════════════════════

function previewTorneoDoc(input){
  const file=input.files[0];
  if(!file)return;
  const isPDF=file.type==='application/pdf';
  const box=document.getElementById('tDocBox');
  document.getElementById('tDocLabel').textContent=isPDF?'📄 '+file.name:'🖼️ '+file.name;
  if(!isPDF){
    const reader=new FileReader();
    reader.onload=e=>{
      document.getElementById('tDocPreview').src=e.target.result;
      document.getElementById('tDocPreview').style.display='block';
    };
    reader.readAsDataURL(file);
  }
}

function clearTorneoDoc(){
  STATE._torneoDocURL=null;
  STATE._torneoDocCleared=true;
  document.getElementById('tDocExisting').style.display='none';
  document.getElementById('tDocInput').value='';
  document.getElementById('tDocPreview').style.display='none';
  document.getElementById('tDocLabel').textContent='📎 Toca para subir PDF, imagen o reglamento';
}

function previewTorneoLogo(input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    document.getElementById('tLogoPreview').src=e.target.result;
    document.getElementById('tLogoPreview').style.display='block';
    document.getElementById('tLogoPlaceholder').style.display='none';
    document.getElementById('tLogoClearBtn').style.display='inline';
  };
  reader.readAsDataURL(file);
}

function clearTorneoLogo(){
  STATE._torneoLogoURL=null;
  STATE._torneoLogoCleared=true;
  document.getElementById('tLogoInput').value='';
  document.getElementById('tLogoPreview').style.display='none';
  document.getElementById('tLogoPreview').src='';
  document.getElementById('tLogoPlaceholder').style.display='';
  document.getElementById('tLogoClearBtn').style.display='none';
}

// ══════════════════════════════════════════════════════
// MODAL JORNADA — Crear / Editar
// ══════════════════════════════════════════════════════
function openModalJornada(jornadaId=null, torneoId=null){
  STATE.editingJornadaId=jornadaId;
  if(torneoId) STATE._modalTorneoId=torneoId;
  else STATE._modalTorneoId=STATE.activeTorneoId||STATE.torneo?.id||null;
  const modal=document.getElementById('modalJornada');
  const title=document.getElementById('modalJornadaTitle');
  const err=document.getElementById('modalJornadaError');
  err.style.display='none';

  // Populate club select
  const sel=document.getElementById('jornadaClub');
  sel.innerHTML=`<option value="">— Selecciona un club —</option>`+
    STATE.clubes.map(c=>`<option value="${c.nombre}">${c.nombre}</option>`).join('');

  if(jornadaId){
    title.textContent='Editar Partida';
    const jn=STATE.jornadas.find(j=>j.id===jornadaId);
    if(jn){
      document.getElementById('jornadaClub').value=jn.sede||'';
      document.getElementById('jornadaFecha').value=jn.fecha||'';
      // estado managed automatically
      document.getElementById('jornadaNotas').value=jn.notas||'';
      const tParts=(jn.teeTime||'').split(':');
      if(document.getElementById('teeHH')) document.getElementById('teeHH').value=tParts[0]||'07';
      if(document.getElementById('teeMM')) document.getElementById('teeMM').value=tParts[1]||'00';
    }
  } else {
    title.textContent='Nueva Partida';
    document.getElementById('jornadaClub').value='';
    document.getElementById('jornadaFecha').value='';
    // estado is automatic
    document.getElementById('jornadaNotas').value='';
    if(document.getElementById('teeHH')) document.getElementById('teeHH').value='07';
    if(document.getElementById('teeMM')) document.getElementById('teeMM').value='00';
  }
  modal.style.display='flex';
}


function resetJornadaFotoSlot(i){
  const slot=document.getElementById('jornadaFotoSlot'+i);
  if(!slot)return;
  slot.innerHTML=`
    <div class="photo-upload-box" style="height:80px;padding:8px;" onclick="document.getElementById('jornadaFotoInput${i}').click()">
      <div style="font-size:22px;">📷</div>
      <div style="font-size:10px;color:var(--muted);">Foto ${i+1}</div>
      <input type="file" id="jornadaFotoInput${i}" accept="image/*" onchange="previewJornadaFoto(this,${i})"/>
    </div>`.replace(/\${i}/g,i).replace(/\${i\+1}/g,i+1);
}

function setJornadaFotoSlot(i,url){
  const slot=document.getElementById('jornadaFotoSlot'+i);
  if(!slot)return;
  slot.innerHTML=`
    <img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);"/>
    <button class="del-photo" onclick="delJornadaFoto(${i})">✕</button>`;
}

function previewJornadaFoto(input,i){
  const file=input.files[0];
  if(!file)return;
  // Store the File object so saveResultados can access it even after DOM changes
  if(!STATE._jornadaFotoFiles) STATE._jornadaFotoFiles=[null,null,null];
  STATE._jornadaFotoFiles[i]=file;
  const reader=new FileReader();
  reader.onload=e=>{
    const slot=document.getElementById('jornadaFotoSlot'+i);
    if(!slot)return;
    // Show preview image + delete btn, keep hidden input alive for re-selection
    slot.innerHTML='<div style="position:relative;width:100%;height:80px;">'
      +'<img src="'+e.target.result+'" style="width:100%;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);"/>'
      +'<button class="del-photo" onclick="delJornadaFoto('+i+')" style="position:absolute;top:2px;right:2px;">✕</button>'
      +'<input type="file" id="jornadaFotoInput'+i+'" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;" onchange="previewJornadaFoto(this,'+i+')">'
      +'</div>';
  };
  reader.readAsDataURL(file);
}

function delJornadaFoto(i){
  if(STATE._jornadaFotosExistentes) STATE._jornadaFotosExistentes[i]=null;
  if(STATE._jornadaFotoFiles) STATE._jornadaFotoFiles[i]=null;
  resetJornadaFotoSlot(i);
}

function closeModalJornada(event){
  if(event&&event.currentTarget!==event.target)return;
  document.getElementById('modalJornada').style.display='none';
  STATE.editingJornadaId=null;
}

async function saveJornada(){
  const club=document.getElementById('jornadaClub').value.trim();
  const fecha=document.getElementById('jornadaFecha').value;
  // Estado is automatic — read from existing partida when editing, or 'Planificada' for new
  const _existingJornada=STATE.editingJornadaId?STATE.jornadas.find(j=>j.id===STATE.editingJornadaId):null;
  const estado=_existingJornada?.estado||'Planificada';
  const notas=document.getElementById('jornadaNotas').value.trim();
  const teeHH=document.getElementById('teeHH')?.value||'';
  const teeMM=document.getElementById('teeMM')?.value||'00';
  const teeTime=teeHH?(teeHH+':'+teeMM):'';
  const cuentaRanking=document.getElementById('jornadaCuentaRanking')?.checked!==false;
  const tieneReglasEsp=document.getElementById('jornadaReglasEspeciales')?.checked||false;
  const reglasOverride=tieneReglasEsp?{
    puntos:{
      1:Number(document.getElementById('jrPts1')?.value)||4,
      2:Number(document.getElementById('jrPts2')?.value)||3,
      3:Number(document.getElementById('jrPts3')?.value)||2,
      resto:Number(document.getElementById('jrPtsResto')?.value)||1,
    },
    bonusAsistencia:Number(document.getElementById('jrBonus')?.value)||0,
    penalNoAsistencia:Number(document.getElementById('jrPenalNoAsist')?.value)||0,
    penalDQ:Number(document.getElementById('jrPenalDQ')?.value)||0,
  }:null;
  const err=document.getElementById('modalJornadaError');
  const btn=document.getElementById('btnGuardarJornada');
  err.style.display='none';

  if(!club){err.textContent='Selecciona un club.';err.style.display='block';return;}
  if(!fecha){err.textContent='La fecha es obligatoria.';err.style.display='block';return;}

  btn.disabled=true; btn.textContent='Guardando...';
  try{
    // Upload new photos (slots with new files)
    let fotos=[...(STATE._jornadaFotosExistentes||[])];
    for(let i=0;i<3;i++){
      const fi=document.getElementById('jornadaFotoInput'+i);
      if(fi&&fi.files&&fi.files[0]){
        const jid=STATE.editingJornadaId||'new_'+Date.now();
        const compressed=await resizeAndCompress(fi.files[0],1200,0.82);
        const url=await uploadPhoto(compressed,`jornadas/${jid}_foto${i}.jpg`,'jornadaFotoProgress');
        fotos[i]=url;
      }
    }
    fotos=fotos.filter(Boolean);

    if(STATE.editingJornadaId){
      await db.collection('jornadas').doc(STATE.editingJornadaId).update({
        sede:club, fecha, estado, notas, teeTime, fotos, cuentaRanking,
        ...(reglasOverride?{reglasOverride}:{reglasOverride:null}),
        updated_at:firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const numero=(STATE.jornadas.length>0?Math.max(...STATE.jornadas.map(j=>j.numero||0)):0)+1;
      const torneoIdParaJornada=STATE._modalTorneoId||STATE.activeTorneoId||STATE.torneo?.id||'';
      await db.collection('jornadas').add({
        numero, nombre:`J${numero}`, sede:club, fecha, estado, notas, teeTime, fotos,
        cuentaRanking, ...(reglasOverride?{reglasOverride}:{}),
        torneo_id:torneoIdParaJornada,
        creado:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    document.getElementById('modalJornada').style.display='none';
    STATE.editingJornadaId=null;
  } catch(e){
    err.textContent='Error al guardar: '+e.message; err.style.display='block';
  } finally{ btn.disabled=false; btn.textContent='Guardar Partida'; }
}

// ══════════════════════════════════════════════════════
// CLUBES
// ══════════════════════════════════════════════════════
let editingClubId=null;

function renderClubes(){
  const el=document.getElementById('tab-clubes');
  const isAdmin=STATE.profile?.role==='admin';
  el.innerHTML=`
    ${isAdmin?`<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn-green" onclick="openModalClub()">+ Agregar Club</button>
    </div>`:''}
    ${STATE.clubes.length===0?`<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:40px;">No hay clubes registrados.</div></div>`:''}
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${STATE.clubes.map(club=>{
        const bg=club.color||'#2E7D5E';
        const ini=club.iniciales||club.nombre.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3);
        const avatarEl=club.fotoURL
          ?`<img src="${club.fotoURL}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid var(--border);"/>`
          :`<div style="width:44px;height:44px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;flex-shrink:0;">${ini}</div>`;
        return`
        <div class="card" style="margin-bottom:0;">
          <div style="padding:14px 18px;display:flex;align-items:center;gap:14px;">
            ${avatarEl}
            <div class="flex-1">
              <div class="text-14 font-bold">${club.nombre}</div>
              <div class="text-12 text-muted">${club.ciudad||'—'}</div>
            </div>
            ${isAdmin?`
              <button class="btn-outline" style="padding:5px 12px;font-size:12px;" onclick="openModalClub('${club.id}')">✏️ Editar</button>
              <button class="btn-danger" onclick="deleteClub('${club.id}','${club.nombre}')">Eliminar</button>
            `:''}
          </div>
        </div>`}).join('')}
    </div>
  `;
}

function openModalClub(clubId=null){
  editingClubId=clubId;
  document.getElementById('modalClubError').style.display='none';
  if(clubId){
    document.getElementById('modalClubTitle').textContent='Editar Club';
    const club=STATE.clubes.find(c=>c.id===clubId);
    if(club){
      document.getElementById('clubNombre').value=club.nombre||'';
      document.getElementById('clubCiudad').value=club.ciudad||'';
      document.getElementById('clubIniciales').value=club.iniciales||'';
      document.getElementById('clubColor').value=club.color||'#2E7D5E';
    }
  } else {
    document.getElementById('modalClubTitle').textContent='Nuevo Club';
    document.getElementById('clubNombre').value='';
    document.getElementById('clubCiudad').value='';
    document.getElementById('clubIniciales').value='';
    document.getElementById('clubColor').value='#2E7D5E';
  }
  document.getElementById('modalClub').style.display='flex';
}

function closeModalClub(){ document.getElementById('modalClub').style.display='none'; editingClubId=null; }

async function saveClub(){
  const nombre=document.getElementById('clubNombre').value.trim();
  const ciudad=document.getElementById('clubCiudad').value.trim();
  const iniciales=document.getElementById('clubIniciales').value.trim().toUpperCase().slice(0,3);
  const color=document.getElementById('clubColor').value;
  const err=document.getElementById('modalClubError');
  const btn=document.getElementById('btnGuardarClub');
  if(!nombre){err.textContent='El nombre es obligatorio.';err.style.display='block';return;}
  btn.disabled=true; btn.textContent='Guardando...';
  try{
    const ini=iniciales||nombre.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3);
    const data={nombre,ciudad,iniciales:ini,color};
    // Upload photo if selected
    const fileInput=document.getElementById('clubFotoInput');
    if(fileInput.files&&fileInput.files[0]){
      const compressed=await resizeAndCompress(fileInput.files[0],800);
      const path='clubes/'+(editingClubId||Date.now())+'.jpg';
      data.fotoURL=await uploadPhoto(compressed,path,'clubFotoProgress');
    }
    if(editingClubId){
      data.updated_at=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('clubes').doc(editingClubId).update(data);
    } else {
      data.creado=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('clubes').add(data);
    }
    closeModalClub();
  }catch(e){err.textContent='Error: '+e.message;err.style.display='block';}
  finally{btn.disabled=false;btn.textContent='Guardar Club';}
}

async function deleteClub(id,nombre){
  if(!confirm(`¿Eliminar el club "${nombre}"?`))return;
  await db.collection('clubes').doc(id).delete();
}
