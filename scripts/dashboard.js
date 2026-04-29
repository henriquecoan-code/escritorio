/* .. EMBEDDED DATA (fallback offline) .. */
const LOGO_B64  = 'data:image/png;base64,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';
const SEED_DATA = [];

/* .. DEFAULT LISTS .. */
let AREAS   = ["Previdenciário","Trabalhista","Seguro","Cobrança","Inventário","Indenizatória","Alimentos","Divórcio","Trânsito","Imobiliário","Crime","Consumidor","Família","Ambiental","Administrativo","Agentes Públicos","Eleitoral","Assessoria Empresarial","Empresarial"];
let ACOES   = ["Usucapião","Divórcio","Adjudicação","Aposentadoria Especial","Aposentadoria por Invalidez","Aposentadoria por tempo de contribuição","Auxílio Acidente","Auxílio Doença","LOAS","Inventário","Dano Moral","Dano Material","Retificação de Registro Civil","Ação Penal","Acompanhamento na Delegacia","Reintegração de Posse","Imissão na Posse","Alvará Judicial","Reclamatória Trabalhista","Consignação em Pagamento","Restabelecimento de Benefício","Mandado de Segurança","Cobrança de Seguro em Grupo","Cobrança de Título","Execução de Título","Erro Médico","Recurso administrativo","Salário maternidade","Suscitação de dúvidas","Alimentos","Outras"];
let TIPOS   = ["Entrada + \u00CAxito","Somente no \u00CAxito","Pr\u00F3-labore sem \u00CAxito"];
let ORIGENS = ["Convencional","Tráfego","Prospecção"];
let ADVS    = ["Sandra","Valdirlei","Liandra","Jaime","Camilla","Matheus"];
let STATUS  = ["Ativo","Encerrado","Suspenso"];
let MESES_REF = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const MEDALS=['🥇','🥈','🥉','','',''];
const TT={backgroundColor:'#0D0D1C',borderColor:'rgba(201,168,76,.35)',borderWidth:1,padding:10,cornerRadius:0};
Chart.defaults.color='#6E6A88';Chart.defaults.borderColor='rgba(201,168,76,.07)';
Chart.defaults.font.family="'Segoe UI',Arial,sans-serif";Chart.defaults.font.size=11;

/* .. STATE .. */
let DB=[], photos={}, charts={}, pg=1, sortCol='data', sortDir=1, pendingDelUID=null;
let activeMonth='all';
let syncTimer=null;
const PG=20;
const FIREBASE_CFG = window.OB_FIREBASE_CONFIG || null;
let USE_FIREBASE=false, fbDb=null;
let fbAuth=null, currentUser=null;
let firebasePermissionWarned=false;

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function toast(msg,type='ok'){
  const el=document.createElement('div');
  el.className=`toast-item toast-${type}`;el.textContent=msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

function initFirebaseIfConfigured(){
  const hasCfg = FIREBASE_CFG && FIREBASE_CFG.apiKey && FIREBASE_CFG.projectId;
  const hasSdk = typeof firebase !== 'undefined';
  if(!hasCfg || !hasSdk) return false;
  try{
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CFG);
    fbDb = firebase.firestore(app);
    fbAuth = firebase.auth(app);
    USE_FIREBASE = true;
    return true;
  }catch(e){
    console.error('Falha ao inicializar Firebase:', e);
    USE_FIREBASE = false;
    return false;
  }
}

function setAuthOverlay(open, errMsg=''){
  const ov=document.getElementById('auth-overlay');
  ov.classList.toggle('open', !!open);
  document.getElementById('auth-err').textContent = errMsg || '';
}

function refreshAuthUI(){
  const userEl=document.getElementById('auth-user');
  const btn=document.getElementById('auth-logout-btn');
  if(currentUser){
    const txt = currentUser.email || 'usuario autenticado';
    userEl.textContent = txt;
    userEl.title = txt;
    userEl.style.display='inline-block';
    btn.style.display='inline-block';
  }else{
    userEl.textContent = '';
    userEl.title = '';
    userEl.style.display='none';
    btn.style.display='none';
  }
}

async function loginFirebase(){
  const email=(document.getElementById('auth-email').value||'').trim();
  const password=document.getElementById('auth-password').value||'';
  if(!email || !password){
    setAuthOverlay(true,'Informe email e senha.');
    return;
  }
  try{
    await fbAuth.signInWithEmailAndPassword(email,password);
  }catch(e){
    const msg=(e && e.message)?e.message:'Falha no login.';
    setAuthOverlay(true,msg);
  }
}

async function logoutFirebase(){
  try{ await fbAuth.signOut(); }
  catch(e){ toast('Erro ao encerrar sessao.','err'); }
}

function ensureAuthenticated(){
  if(currentUser) return true;
  setAuthOverlay(true,'Sessao expirada. Faca login novamente.');
  setSyncStatus('err','Login necessario','Entre com email e senha para continuar');
  return false;
}

async function loadFromFirebase(){
  if(!ensureAuthenticated()) return;
  setSyncStatus('loading','Conectando Firebase...','');
  try{
    const contractsSnap = await fbDb.collection('contratos').get();
    if(contractsSnap.empty){
      DB = JSON.parse(JSON.stringify(SEED_DATA));
      const batch = fbDb.batch();
      DB.forEach((r)=>batch.set(fbDb.collection('contratos').doc(r.uid), r));
      await batch.commit();
      toast(`Firebase inicializado com ${DB.length} contratos.`);
    } else {
      DB = contractsSnap.docs.map((d)=>d.data());
    }

    const listsDoc = await fbDb.collection('meta').doc('lists').get();
    if(listsDoc.exists){
      const l = listsDoc.data() || {};
      if(l.AREAS?.length) AREAS=l.AREAS;
      if(l.ACOES?.length) ACOES=l.ACOES;
      if(l.TIPOS?.length) TIPOS=l.TIPOS;
      if(l.ORIGENS?.length) ORIGENS=l.ORIGENS;
      if(l.ADVS?.length) ADVS=l.ADVS;
      if(l.MESES_REF?.length) MESES_REF=l.MESES_REF;
    }

    const photosDoc = await fbDb.collection('meta').doc('photos').get();
    if(photosDoc.exists) photos = photosDoc.data() || {};

    const now=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    setSyncStatus('ok','Firebase conectado',`${DB.length} registros · ${now}`);
    firebasePermissionWarned=false;
    fillSelects();fillFilters();renderDash();renderTbl();
  }catch(e){
    console.error(e);
    const code = (e && (e.code || e.status)) ? String(e.code || e.status) : '';
    const isPermission = code.includes('permission-denied') || code.includes('PERMISSION_DENIED');
    if(isPermission){
      setSyncStatus('err','Firestore bloqueou acesso','Verifique Rules para usuario autenticado');
      if(!firebasePermissionWarned){
        toast('Permissao negada no Firestore para este usuario.','err');
        firebasePermissionWarned=true;
      }
      clearInterval(syncTimer);
      return;
    }
    setSyncStatus('err','Erro no Firebase','Verifique firebase-config.js e as Rules');
    toast('Erro ao carregar dados do Firebase.','err');
  }
}

/* .. FIREBASE STATUS & SYNC .. */
function setSyncStatus(state,label,detail=''){
  document.getElementById('sdot').className=`sdot ${state}`;
  const lbl=document.getElementById('slbl');lbl.className=`slbl ${state}`;lbl.textContent=label;
  document.getElementById('sdet').textContent=detail;
}

async function syncNow(){
  if(!ensureAuthenticated()) return;
  await loadFromFirebase();
}

function startAutoSync(){
  clearInterval(syncTimer);
  syncTimer=setInterval(syncNow, 30000); // every 30s
}

function bindStaticEvents(){
  document.querySelectorAll('.nav-tab[data-view]').forEach((btn)=>{
    btn.addEventListener('click',()=>sw(btn.dataset.view));
  });
  document.getElementById('auth-logout-btn')?.addEventListener('click',logoutFirebase);
  document.getElementById('open-new-contract-btn')?.addEventListener('click',()=>openM());
  document.getElementById('sync-now-btn')?.addEventListener('click',syncNow);
  document.getElementById('srch')?.addEventListener('input',onSearch);
  ['ff-mes','ff-area','ff-adv','ff-status'].forEach((id)=>{
    document.getElementById(id)?.addEventListener('change',()=>{pg=1;renderTbl();});
  });
  document.getElementById('clear-filters-btn')?.addEventListener('click',clearFilters);
  document.querySelectorAll('.ctbl th[data-col]').forEach((th)=>{
    th.addEventListener('click',()=>sortBy(th.dataset.col));
  });
  document.getElementById('auth-login-btn')?.addEventListener('click',loginFirebase);
  document.getElementById('overlay')?.addEventListener('click',overlayBg);
  document.getElementById('close-modal-x-btn')?.addEventListener('click',closeM);
  document.getElementById('cancel-modal-btn')?.addEventListener('click',closeM);
  document.getElementById('save-contract-btn')?.addEventListener('click',saveC);
  document.getElementById('del-ov')?.addEventListener('click',(event)=>{if(event.target===event.currentTarget)closeDel();});
  document.getElementById('cancel-del-btn')?.addEventListener('click',closeDel);
  document.getElementById('del-btn')?.addEventListener('click',confirmDel);
  document.getElementById('month-bar')?.addEventListener('click',(event)=>{
    const btn=event.target.closest('.month-pill[data-month]');
    if(!btn) return;
    setMonth(btn.dataset.month);
  });
  document.getElementById('mc-wrap')?.addEventListener('click',(event)=>{
    const box=event.target.closest('.mc[data-month]');
    if(!box) return;
    setMonth(box.dataset.month);
  });
  document.getElementById('photo-rank')?.addEventListener('click',(event)=>{
    const avatar=event.target.closest('.av[data-photo-input-id]');
    if(!avatar) return;
    trigPh(avatar.dataset.photoInputId);
  });
  document.getElementById('ctbody')?.addEventListener('click',(event)=>{
    const actionBtn=event.target.closest('button[data-action][data-uid]');
    if(actionBtn){
      const uid=actionBtn.dataset.uid;
      if(actionBtn.dataset.action==='edit') openM(uid);
      if(actionBtn.dataset.action==='delete') askDel(uid);
      return;
    }
    const row=event.target.closest('tr[data-open-uid]');
    if(row) openM(row.dataset.openUid);
  });
  document.getElementById('pag-btns')?.addEventListener('click',(event)=>{
    const pageBtn=event.target.closest('button[data-page]');
    if(!pageBtn || pageBtn.disabled) return;
    goPg(Number(pageBtn.dataset.page));
  });
  document.getElementById('view-cfg')?.addEventListener('click',(event)=>{
    const addBtn=event.target.closest('button[data-cfg-add-key]');
    if(addBtn){
      addCfg(addBtn.dataset.cfgAddKey);
      return;
    }
    const delBtn=event.target.closest('button[data-remove-cfg-key][data-remove-cfg-idx]');
    if(delBtn){
      removeCfg(delBtn.dataset.removeCfgKey, Number(delBtn.dataset.removeCfgIdx));
    }
  });
}

/* .. INIT .. */
function init(){
  bindStaticEvents();
  document.getElementById('hd-logo').src=LOGO_B64;
  document.getElementById('ts').textContent=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
  refreshAuthUI();

  if(initFirebaseIfConfigured()){
    fbAuth.onAuthStateChanged((user)=>{
      currentUser=user||null;
      refreshAuthUI();
      clearInterval(syncTimer);
      if(currentUser){
        setAuthOverlay(false);
        loadFromFirebase().then(()=>startAutoSync());
      }else{
        setSyncStatus('err','Login necessario','Entre com email e senha para carregar os dados');
        setAuthOverlay(true);
      }
    });
    return;
  }

  setSyncStatus('err','Firebase nao configurado','Preencha firebase-config.js com as credenciais do projeto');
  toast('Firebase nao configurado. Verifique firebase-config.js','err');
}

/* .. VIEWS .. */
function sw(v){
  ['dash','ct','cfg'].forEach(k=>{
    document.getElementById(`view-${k}`).classList.toggle('on',k===v);
    document.getElementById(`tab-${k}`).classList.toggle('on',k===v);
  });
  if(v==='dash') renderDash();
  if(v==='ct')  {fillFilters();renderTbl();}
  if(v==='cfg')  renderAllCfg();
}

/* .. MONTH FILTER .. */
function setMonth(m){
  activeMonth=m;
  document.querySelectorAll('.month-pill').forEach(p=>p.classList.remove('active'));
  document.getElementById(m==='all'?'pill-all':`pill-${m.replace(/\s/g,'_')}`)?.classList.add('active');
  renderDash();
}
function buildMonthPills(){
  const meses=[...new Set(DB.map(r=>r.mes))].sort((a,b)=>MESES_REF.indexOf(a)-MESES_REF.indexOf(b));
  document.getElementById('month-pills').innerHTML=meses.map(m=>
    `<button class="month-pill ${activeMonth===m?'active':''}" id="pill-${m.replace(/\s/g,'_')}" data-month="${escAttr(m)}">${escHtml(m)}</button>`).join('');
}

/* .. HELPERS .. */
function escHtml(v){
  return String(v??'').replace(/[&<>'"]/g,(ch)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));
}
function escAttr(v){
  return escHtml(v).replace(/`/g,'&#96;');
}
function escJsSQ(v){
  return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
function getView(){return activeMonth==='all'?DB:DB.filter(r=>r.mes===activeMonth);}
const cnt=(d,f,v)=>d.filter(r=>r[f]===v).length;
const cntM=(d,m,f,v)=>d.filter(r=>r.mes===m&&r[f]===v).length;
const fmtDate=iso=>iso?iso.split('-').reverse().join('/'):'';
const isoDate=dmy=>{const p=dmy.split('/');return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:'';};
const dateToSort=dmy=>{const p=(dmy||'').split('/');return p.length===3?`${p[2]}${p[1]}${p[0]}`:'';};

/* .. SAVE TO SERVER .. */
async function serverSave(record){
  if(!ensureAuthenticated()) return;
  try{ await fbDb.collection('contratos').doc(record.uid).set(record); }
  catch(e){ toast('Aviso: erro ao salvar no Firebase.','err'); }
}
async function serverDelete(uid){
  if(!ensureAuthenticated()) return;
  try{ await fbDb.collection('contratos').doc(uid).delete(); }
  catch(e){ toast('Aviso: erro ao excluir no Firebase.','err'); }
}
async function serverSaveLists(){
  if(!ensureAuthenticated()) return;
  try{ await fbDb.collection('meta').doc('lists').set({AREAS,ACOES,TIPOS,ORIGENS,ADVS,MESES_REF}); }
  catch(e){}
}
async function serverSavePhotos(){
  if(!ensureAuthenticated()) return;
  try{ await fbDb.collection('meta').doc('photos').set(photos); }
  catch(e){}
}

/* .. DASHBOARD .. */
function renderDash(){
  Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}});charts={};
  const allMeses=[...new Set(DB.map(r=>r.mes))].sort((a,b)=>MESES_REF.indexOf(a)-MESES_REF.indexOf(b));
  buildMonthPills();
  const view=getView(),total=view.length,isF=activeMonth!=='all';
  const totMes=allMeses.map(m=>DB.filter(r=>r.mes===m).length);
  document.getElementById('period-chip').textContent=isF?activeMonth:allMeses.join(' · ')||'2026';
  document.getElementById('month-bar-info').textContent=isF?`${total} contrato${total!==1?'s':''} em ${activeMonth}`:`${total} contratos no total`;
  const prevIdx=isF?allMeses.indexOf(activeMonth)-1:-1;
  const prevTot=prevIdx>=0?DB.filter(r=>r.mes===allMeses[prevIdx]).length:null;
  const delta=prevTot!=null&&prevTot>0?((total-prevTot)/prevTot*100).toFixed(0):null;
  const topArea=AREAS.reduce((a,b)=>cnt(view,'area',a)>=cnt(view,'area',b)?a:b,AREAS[0]);
  const kpis=[
    {l:isF?activeMonth:'Total Contratos',v:total,s:isF?`de ${DB.length} total`:'todos os meses'},
    ...(isF?[
      {l:'Mes Anterior',v:prevTot??'--',s:prevIdx>=0?allMeses[prevIdx]:'sem anterior'},
      {l:'Variacao',v:delta!=null?(+delta>0?'+':'')+delta+'%':'--',s:'vs mes anterior',sm:true},
      {l:'Área Líder',v:topArea.split(' ')[0],s:'este mês',sm:true},
      {l:'Sem Adv.',v:view.filter(r=>!r.adv).length,s:'a vincular'},
    ]:[
      ...allMeses.slice(-2).map(m=>({l:m,v:DB.filter(r=>r.mes===m).length,s:'contratos'})),
      {l:'Variacao',v:totMes.length>=2?((totMes.at(-1)-totMes.at(-2))/(totMes.at(-2)||1)*100).toFixed(0)+'%':'--',s:'ultimo vs anterior',sm:true},
      {l:'Área Líder',v:topArea.split(' ')[0],s:'maior demanda',sm:true},
    ])
  ].slice(0,5);
  document.getElementById('kpi-row').innerHTML=kpis.map((k,i)=>`
    <div class="kpi fu" style="animation-delay:${i*.05}s">
      <div class="kpi-lbl">${k.l}</div><div class="kpi-val ${k.sm?'sm':''}">${k.v}</div><div class="kpi-sub">${k.s}</div>
    </div>`).join('');
  // Month compare
  const mc=document.getElementById('mc-wrap');mc.innerHTML='';
  allMeses.forEach((m,i)=>{
    const v=DB.filter(r=>r.mes===m).length,prev=i>0?DB.filter(r=>r.mes===allMeses[i-1]).length:null;
    const d=prev!=null?((v-prev)/(prev||1)*100).toFixed(0):null;
    const tag=d!=null?`<div class="mc-d ${+d>=0?'up':'dn'}">${+d>=0?'+':'-'} ${Math.abs(d)}%</div>`:'';
    mc.innerHTML+=`<div class="mc ${activeMonth===m?'active-month':''}" data-month="${escAttr(m)}">
      <div class="mc-m">${m}</div><div class="mc-n">${v}</div>
      <div class="mc-s">${activeMonth===m?'<strong style="color:var(--g)">selecionado</strong>':'contratos'}</div>${tag}</div>`;
  });
  // Line
  const ec=document.getElementById('evolChart').getContext('2d');
  const gr=ec.createLinearGradient(0,0,0,200);gr.addColorStop(0,'rgba(201,168,76,.2)');gr.addColorStop(1,'rgba(201,168,76,0)');
  charts.evol=new Chart(ec,{type:'line',data:{labels:allMeses,datasets:[{label:'Total',data:totMes,
    borderColor:'#C9A84C',backgroundColor:gr,borderWidth:2.5,
    pointBackgroundColor:allMeses.map(m=>m===activeMonth?'#E8C96A':'#C9A84C'),
    pointBorderColor:'#07070F',pointBorderWidth:2,pointRadius:allMeses.map(m=>m===activeMonth?9:5),tension:.4,fill:true}]},
    options:{responsive:true,maintainAspectRatio:false,onClick:(_,els)=>{if(els.length)setMonth(allMeses[els[0].index]);},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{color:'rgba(201,168,76,.04)'},ticks:{color:'#6E6A88'}},y:{grid:{color:'rgba(201,168,76,.04)'},ticks:{color:'#6E6A88'},min:0}}}});
  // Photo rank
  const aT=ADVS.map(a=>cnt(DB,'adv',a)),aTV=ADVS.map(a=>cnt(view,'adv',a)),aMax=Math.max(...aT,1);
  buildPhotoRank(ADVS.map((n,i)=>({n,vAll:aT[i],vView:aTV[i]})).sort((a,b)=>b.vAll-a.vAll),aMax,isF);
  // Area
  const arA=AREAS.map(a=>cnt(DB,'area',a)),arV=AREAS.map(a=>cnt(view,'area',a)),arMax=Math.max(...arA,1);
  document.getElementById('area-total').textContent=total;
  const hArea=document.getElementById('hbar-area');hArea.innerHTML='';
  AREAS.map((a,i)=>({a,vAll:arA[i],vView:arV[i]})).sort((x,y)=>y.vAll-x.vAll).slice(0,10).forEach(({a,vAll,vView})=>{
    hArea.innerHTML+=`<div class="hbr"><div class="hbr-name">${a}</div>
      <div class="hbr-row"><div class="hbr-lbl total">Total</div><div class="hbb"><div class="hbf total" style="width:0" data-w="${Math.round(vAll/arMax*100)}%"></div></div><div class="hbn total">${vAll}</div></div>
      ${isF?`<div class="hbr-row"><div class="hbr-lbl month">${activeMonth.slice(0,3)}</div><div class="hbb"><div class="hbf month" style="width:0" data-w="${Math.round(vView/arMax*100)}%"></div></div><div class="hbn month">${vView}</div></div>`:''}
    </div>`;
  });
  // Acao
  const acA=ACOES.map(a=>cnt(DB,'acao',a)),acV=ACOES.map(a=>cnt(view,'acao',a)),acMax=Math.max(...acA,1);
  document.getElementById('acao-total').textContent=total;
  const hAcao=document.getElementById('hbar-acao');hAcao.innerHTML='';
  const acS=ACOES.map((a,i)=>({a,vAll:acA[i],vView:acV[i]})).filter(x=>x.vAll>0).sort((x,y)=>y.vAll-x.vAll).slice(0,10);
  if(!acS.length)hAcao.innerHTML=`<div style="color:var(--t3);font-size:11px;text-align:center;padding:16px;font-style:italic">Nenhuma ação registrada</div>`;
  else acS.forEach(({a,vAll,vView})=>{
    hAcao.innerHTML+=`<div class="hbr"><div class="hbr-name" style="font-size:10px">${a}</div>
      <div class="hbr-row"><div class="hbr-lbl total" style="width:36px;font-size:9px">Total</div><div class="hbb"><div class="hbf total" style="width:0;background:linear-gradient(90deg,#5B8CDB,#7AADEE)" data-w="${Math.round(vAll/acMax*100)}%"></div></div><div class="hbn total" style="color:var(--blue)">${vAll}</div></div>
      ${isF?`<div class="hbr-row"><div class="hbr-lbl month" style="width:36px;font-size:9px">${activeMonth.slice(0,3)}</div><div class="hbb"><div class="hbf month" style="width:0" data-w="${Math.round(vView/acMax*100)}%"></div></div><div class="hbn month">${vView}</div></div>`:''}
    </div>`;
  });
  // Tipo donut
  const tiA=TIPOS.map(t=>cnt(DB,'tipo',t)),tiV=TIPOS.map(t=>cnt(view,'tipo',t)),tiSum=tiV.reduce((a,b)=>a+b,0);
  document.getElementById('tipo-total').textContent=tiSum||'--';
  const tiC=['#C9A84C','rgba(201,168,76,.5)','rgba(201,168,76,.2)'];
  charts.tipo=new Chart(document.getElementById('tipoChart'),{type:'doughnut',
    data:{labels:TIPOS,datasets:[{data:tiSum?tiV:[1,1,1],backgroundColor:tiC,borderColor:'#07070F',borderWidth:3,hoverOffset:5}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false},tooltip:TT}}});
  const tl=document.getElementById('tipo-leg');tl.innerHTML='';
  TIPOS.forEach((l,i)=>{const p=tiSum?Math.round(tiV[i]/tiSum*100):0;
    tl.innerHTML+=`<div class="di"><div class="dd" style="background:${tiC[i]}"></div><div class="dn2">${l}</div><div class="dv">${tiV[i]}</div>${isF?`<span class="dv2">/ ${tiA[i]}</span>`:''}<div class="dp">${p}%</div></div>`;});
  // Origem donut
  const orA=ORIGENS.map(o=>cnt(DB,'origem',o)),orV=ORIGENS.map(o=>cnt(view,'origem',o)),orSum=orV.reduce((a,b)=>a+b,0);
  document.getElementById('orig-total').textContent=orSum||'--';
  const orC=['#4E8FE8','rgba(78,143,232,.5)','rgba(78,143,232,.2)'];
  charts.orig=new Chart(document.getElementById('origChart'),{type:'doughnut',
    data:{labels:ORIGENS,datasets:[{data:orSum?orV:[1,1,1],backgroundColor:orC,borderColor:'#07070F',borderWidth:3,hoverOffset:5}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false},tooltip:TT}}});
  const ol=document.getElementById('orig-leg');ol.innerHTML='';
  ORIGENS.forEach((l,i)=>{const p=orSum?Math.round(orV[i]/orSum*100):0;
    ol.innerHTML+=`<div class="di"><div class="dd" style="background:${orC[i]}"></div><div class="dn2">${l}</div><div class="dv">${orV[i]}</div>${isF?`<span class="dv2">/ ${orA[i]}</span>`:''}<div class="dp">${p}%</div></div>`;});
  // Adv - Mês
  const bC=['rgba(201,168,76,.8)','rgba(78,143,232,.65)','rgba(94,201,122,.55)','rgba(232,115,90,.55)'];
  charts.adv=new Chart(document.getElementById('advChart'),{type:'bar',
    data:{labels:ADVS,datasets:allMeses.map((m,i)=>({label:m,data:ADVS.map(a=>cntM(DB,m,'adv',a)),
      backgroundColor:bC[i%bC.length],borderRadius:3,borderWidth:activeMonth===m?2:0,borderColor:'rgba(255,255,255,.6)'}))},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#6E6A88',boxWidth:9,padding:12}},tooltip:TT},
      scales:{x:{grid:{display:false},ticks:{color:'#6E6A88'}},y:{grid:{color:'rgba(201,168,76,.04)'},ticks:{color:'#6E6A88'}}}}});
  // Summary
  const topAdv=ADVS.reduce((a,b)=>cnt(view,'adv',a)>=cnt(view,'adv',b)?a:b,ADVS[0]);
  const topTipo=TIPOS.reduce((a,b)=>cnt(view,'tipo',a)>=cnt(view,'tipo',b)?a:b,TIPOS[0]);
  const topAcao=ACOES.reduce((a,b)=>cnt(view,'acao',a)>=cnt(view,'acao',b)?a:b,ACOES[0]);
  const topOrig=ORIGENS.reduce((a,b)=>cnt(view,'origem',a)>=cnt(view,'origem',b)?a:b,ORIGENS[0]);
  document.getElementById('sum-tbl').innerHTML=`
    <thead><tr><th>Indicador</th><th>${isF?activeMonth:'Total'}</th>${isF?'<th>Total</th>':''}</tr></thead>
    <tbody>${[
      ['Contratos',total,DB.length],['Área Líer',cnt(view,'area',topArea)?topArea:'--',cnt(DB,'area',topArea)],
      ['Ação Mais Comum',cnt(view,'acao',topAcao)?topAcao:'--',cnt(DB,'acao',topAcao)],
      ['Tipo Predominante',cnt(view,'tipo',topTipo)?topTipo:'--',cnt(DB,'tipo',topTipo)],
      ['Advogado Líer',cnt(view,'adv',topAdv)?topAdv:'--',cnt(DB,'adv',topAdv)],
      ['Sem Adv. Vinc.',view.filter(r=>!r.adv).length,DB.filter(r=>!r.adv).length],
    ].map(([k,v,t])=>`<tr><td style="color:var(--t3)">${k}</td><td><span class="tag">${v}</span></td>${isF?`<td><span class="tag blue">${t}</span></td>`:''}</tr>`).join('')}
    </tbody>`;
  setTimeout(()=>document.querySelectorAll('[data-w]').forEach(el=>{el.style.width=el.dataset.w;}),300);
}

/* .. PHOTO RANK .. */
function buildPhotoRank(sorted,max,isF){
  const wrap=document.getElementById('photo-rank'),pinp=document.getElementById('photo-inputs');
  wrap.innerHTML='';pinp.innerHTML='';
  sorted.forEach(({n,vAll,vView},i)=>{
    const pA=Math.round(vAll/max*100),pV=Math.round(vView/max*100);
    const iid='pi_'+n.replace(/[^\w-]/g,'_');
    const nEsc=escHtml(n);
    const nAttr=escAttr(n);
    const ini=n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    const img=photos[n]?`<img src="${photos[n]}" alt="${nAttr}">`:`<div class="ini">${escHtml(ini)}</div>`;
    wrap.innerHTML+=`<div class="pr ${i===0?'r1':''}">
      <div class="av" data-photo-input-id="${escAttr(iid)}">${img}<div class="cam">📷</div></div>
      <div class="pr-info"><div class="pn">${nEsc}</div><div class="ro">${i===0?'Advogado Líder':'Advogado Associado'}</div>
        <div class="pr-bars">
          <div class="pr-bar-row"><div class="pr-bar-lbl">Total</div><div class="pb-bg"><div class="pb total" style="width:0" data-w="${pA}%"></div></div></div>
          ${isF?`<div class="pr-bar-row"><div class="pr-bar-lbl" style="color:var(--blue)">${activeMonth.slice(0,3)}</div><div class="pb-bg"><div class="pb month" style="width:0" data-w="${pV}%"></div></div></div>`:''}
        </div>
      </div>
      <div class="pr-right"><div class="pr-n">${vAll}</div>
        ${isF?`<div class="pr-n-lbl">total</div><div class="pr-n-month">${vView} <span class="pr-n-lbl">este mês</span></div>`:''}
        <div style="font-size:13px">${MEDALS[i]||''}</div>
      </div>
    </div>`;
    const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.id=iid;
    inp.addEventListener('change',()=>{const f=inp.files[0];if(!f)return;
      const r=new FileReader();r.onload=async e=>{
        photos[n]=e.target.result;await serverSavePhotos();renderDash();toast(`Foto de ${n} atualizada!`);};r.readAsDataURL(f);});
    pinp.appendChild(inp);
  });
}
function trigPh(id){document.getElementById(id)?.click();}

/* .. SELECTS & FILTERS .. */
function fillSelects(){
  const m=[...new Set([...DB.map(r=>r.mes),...MESES_REF])];
  const mk=(id,opts,blank='')=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML=(blank?[`<option value="">${blank}</option>`]:[]).concat(opts.map(o=>`<option value="${o}">${o||'-- Selecionar --'}</option>`)).join('');
  };
  mk('m-mes',m);mk('m-area',AREAS,'-- Selecionar --');mk('m-acao',ACOES,'-- Selecionar --');
  mk('m-tipo',TIPOS,'-- Selecionar --');mk('m-orig',ORIGENS,'-- Selecionar --');
  mk('m-adv',ADVS,'-- Selecionar --');mk('m-stat',STATUS);
}
function fillFilters(){
  const m=[...new Set(DB.map(r=>r.mes))].sort();
  const mk=(id,opts,blank)=>{const el=document.getElementById(id);if(!el)return;
    el.innerHTML=`<option value="">${blank}</option>`+opts.map(o=>`<option value="${o}">${o}</option>`).join('');};
  mk('ff-mes',m,'Todos os meses');mk('ff-area',AREAS,'Todas as áreas');
  mk('ff-adv',ADVS,'Todos os adv.');mk('ff-status',STATUS,'Todos status');
}
function clearFilters(){
  ['srch','ff-mes','ff-area','ff-adv','ff-status'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  pg=1;renderTbl();
}
let _st;function onSearch(){clearTimeout(_st);_st=setTimeout(()=>{pg=1;renderTbl();},200);}

/* .. TABLE .. */
function getFiltered(){
  const q=(document.getElementById('srch')?.value||'').toLowerCase().trim();
  const fM=document.getElementById('ff-mes')?.value||'',fA=document.getElementById('ff-area')?.value||'',
        fV=document.getElementById('ff-adv')?.value||'',fS=document.getElementById('ff-status')?.value||'';
  return DB.filter(r=>{
    if(fM&&r.mes!==fM)return false;if(fA&&r.area!==fA)return false;
    if(fV&&r.adv!==fV)return false;if(fS&&r.status!==fS)return false;
    if(q&&![r.cliente,r.area,r.acao,r.adv,r.mes,r.tipo,r.origem,r.status,r.obs||''].some(v=>(v||'').toLowerCase().includes(q)))return false;
    return true;
  });
}
function renderTbl(){
  let rows=[...getFiltered()].sort((a,b)=>{
    let av,bv;
    if(sortCol==='data'){
      av=dateToSort(a.data||'');
      bv=dateToSort(b.data||'');
    }else{
      av=(a[sortCol]||'').toString().toLowerCase();
      bv=(b[sortCol]||'').toString().toLowerCase();
    }
    return av<bv?-sortDir:av>bv?sortDir:0;
  });
  const total=rows.length,pages=Math.ceil(total/PG)||1;
  pg=Math.min(pg,pages);const slice=rows.slice((pg-1)*PG,pg*PG);
  document.getElementById('ct-count').textContent=`- ${total} registro${total!==1?'s':''}`;
  document.querySelectorAll('.ctbl th[data-col]').forEach(th=>{
    const c=th.dataset.col;th.classList.toggle('sorted',c===sortCol);
    th.textContent=th.textContent.replace(/ (\u2191|\u2193|\u2195)$/,'')+(c===sortCol?(sortDir===1?' ↑':' ↓'):' ↕');
  });
  const tB=t=>t?`<span class="bx bg">${escHtml(t)}</span>`:`<span class="bx bm">--</span>`;
  const oB=o=>o?`<span class="bx bb">${escHtml(o)}</span>`:`<span class="bx bm">--</span>`;
  const sB=s=>{const c=s==='Ativo'?'bgreen':s==='Encerrado'?'brose':'bamber';return`<span class="bx ${c}">${escHtml(s||'Ativo')}</span>`;};
  const aB=a=>a?`<span class="bx bb" style="max-width:140px;display:inline-block;overflow:hidden;text-overflow:ellipsis" title="${escAttr(a)}">${escHtml(a)}</span>`:`<span class="bx bm">--</span>`;
  document.getElementById('ctbody').innerHTML=slice.map(r=>`
    <tr data-open-uid="${escAttr(r.uid)}">
      <td>${escHtml(r.data||'--')}</td><td class="cl" style="max-width:180px;overflow:hidden;text-overflow:ellipsis" title="${escAttr(r.cliente||'')}">${escHtml(r.cliente||'')}</td>
      <td>${escHtml(r.mes||'')}</td><td>${r.area?escHtml(r.area):'<span style="color:var(--t3)">--</span>'}</td>
      <td class="wrap">${aB(r.acao)}</td><td>${tB(r.tipo)}</td>
      <td>${r.adv?escHtml(r.adv):'<span style="color:var(--t3)">--</span>'}</td><td>${oB(r.origem)}</td>
      <td>${sB(r.status)}</td>
      <td><div class="ra">
        <button class="rb" data-action="edit" data-uid="${escAttr(r.uid)}" title="Editar">&#9998;</button>
        <button class="rb del" data-action="delete" data-uid="${escAttr(r.uid)}" title="Excluir">&#128465;</button>
      </div></td>
    </tr>`).join('');
  document.getElementById('pag-info').textContent=`${total} contrato${total!==1?'s':''} · Página ${pg} de ${pages}`;
  const pb=document.getElementById('pag-btns');
  if(pages<=1){pb.innerHTML='';return;}
  let h=`<button class="pb2" data-page="${pg-1}" ${pg===1?'disabled':''}>&lsaquo;</button>`;
  for(let i=1;i<=pages;i++){
    if(i===1||i===pages||Math.abs(i-pg)<=2)h+=`<button class="pb2 ${i===pg?'on':''}" data-page="${i}">${i}</button>`;
    else if(Math.abs(i-pg)===3)h+=`<span style="color:var(--t3);padding:0 3px">...</span>`;
  }
  h+=`<button class="pb2" data-page="${pg+1}" ${pg===pages?'disabled':''}>&rsaquo;</button>`;
  pb.innerHTML=h;
}
function sortBy(c){sortCol===c?sortDir*=-1:(sortCol=c,sortDir=1);pg=1;renderTbl();}
function goPg(p){pg=p;renderTbl();}

/* .. MODAL .. */
function openM(editUid){
  if(!ensureAuthenticated()) return;
  document.getElementById('m-uid').value=editUid||'';
  if(editUid){
    const r=DB.find(x=>x.uid===editUid);if(!r)return;
    document.getElementById('m-title').textContent='Editar Contrato';
    document.getElementById('m-data').value=isoDate(r.data);
    document.getElementById('m-mes').value=r.mes;document.getElementById('m-cliente').value=r.cliente;
    document.getElementById('m-area').value=r.area||'';document.getElementById('m-acao').value=r.acao||'';
    document.getElementById('m-tipo').value=r.tipo||'';document.getElementById('m-orig').value=r.origem||'';
    document.getElementById('m-adv').value=r.adv||'';document.getElementById('m-stat').value=r.status||'Ativo';
    document.getElementById('m-obs').value=r.obs||'';
  }else{
    document.getElementById('m-title').textContent='Novo Contrato';
    const meses=[...new Set(DB.map(r=>r.mes))];
    document.getElementById('m-data').value=new Date().toISOString().split('T')[0];
    document.getElementById('m-mes').value=activeMonth!=='all'?activeMonth:(meses.at(-1)||'Abril');
    ['m-cliente','m-obs'].forEach(id=>document.getElementById(id).value='');
    ['m-area','m-acao','m-tipo','m-orig','m-adv'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('m-stat').value='Ativo';
  }
  document.getElementById('overlay').classList.add('open');
  setTimeout(()=>document.getElementById('m-cliente').focus(),120);
}
function closeM(){document.getElementById('overlay').classList.remove('open');}
function overlayBg(e){if(e.target===e.currentTarget)closeM();}
async function saveC(){
  const cli=document.getElementById('m-cliente').value.trim();
  if(!cli){toast('Informe o nome do cliente.','err');document.getElementById('m-cliente').focus();return;}
  const raw=document.getElementById('m-data').value,editUid=document.getElementById('m-uid').value;
  const obj={uid:editUid||uid(),data:raw?fmtDate(raw):'',cliente:cli,
    mes:document.getElementById('m-mes').value,area:document.getElementById('m-area').value,
    acao:document.getElementById('m-acao').value,tipo:document.getElementById('m-tipo').value,
    origem:document.getElementById('m-orig').value,adv:document.getElementById('m-adv').value,
    status:document.getElementById('m-stat').value,obs:document.getElementById('m-obs').value.trim()};
  if(editUid){const i=DB.findIndex(x=>x.uid===editUid);if(i>=0)DB[i]=obj;toast(`"${cli}" atualizado.`);}
  else{DB.push(obj);toast(`"${cli}" adicionado.`);}
  await serverSave(obj);
  fillSelects();fillFilters();closeM();renderDash();renderTbl();
}

/* .. DELETE .. */
function askDel(u){
  const r=DB.find(x=>x.uid===u);if(!r)return;pendingDelUID=u;
  document.getElementById('del-msg').innerHTML=`Deseja excluir o contrato de<br><strong style="color:var(--t)">"${escHtml(r.cliente||'') }"</strong>?`;
  document.getElementById('del-ov').classList.add('open');
}
async function confirmDel(){
  if(!pendingDelUID)return;
  const u=pendingDelUID;DB=DB.filter(x=>x.uid!==u);pendingDelUID=null;
  await serverDelete(u);
  closeDel();toast('Contrato excluído.','info');renderDash();renderTbl();
}
function closeDel(){document.getElementById('del-ov').classList.remove('open');pendingDelUID=null;}

/* .. SETTINGS .. */
const CFG={
  areas:{list:()=>AREAS,set:v=>{AREAS=v;},input:'ni-areas',items:'lst-areas',cnt:'cnt-areas',field:'area',noun:'área'},
  acoes:{list:()=>ACOES,set:v=>{ACOES=v;},input:'ni-acoes',items:'lst-acoes',cnt:'cnt-acoes',field:'acao',noun:'ação'},
  advs:{list:()=>ADVS,set:v=>{ADVS=v;},input:'ni-advs',items:'lst-advs',cnt:'cnt-advs',field:'adv',noun:'advogado'},
  tipos:{list:()=>TIPOS,set:v=>{TIPOS=v;},input:'ni-tipos',items:'lst-tipos',cnt:'cnt-tipos',field:'tipo',noun:'tipo'},
  origens:{list:()=>ORIGENS,set:v=>{ORIGENS=v;},input:'ni-origens',items:'lst-origens',cnt:'cnt-origens',field:'origem',noun:'origem'},
  meses:{list:()=>MESES_REF,set:v=>{MESES_REF=v;},input:'ni-meses',items:'lst-meses',cnt:'cnt-meses',field:'mes',noun:'mês'},
};
function renderCfg(key){
  const c=CFG[key],list=c.list();
  document.getElementById(c.cnt).textContent=`${list.length} ${list.length===1?c.noun:c.noun+'s'}`;
  const el=document.getElementById(c.items);
  if(!list.length){el.innerHTML=`<div class="cfg-empty">Nenhum item ainda.</div>`;return;}
  el.innerHTML=list.map((item,i)=>{const u=DB.filter(r=>r[c.field]===item).length;
    return `<div class="cfg-item"><span class="cfg-item-name">${escHtml(item)}</span>
      ${u>0?`<span class="cfg-item-usage">${u} uso${u>1?'s':''}</span>`:''}
      <button class="cfg-item-del" data-remove-cfg-key="${escAttr(key)}" data-remove-cfg-idx="${i}" ${u>0?`disabled title="${u} em uso"`:''}>${u>0?'Lock':'X'}</button>
    </div>`;}).join('');
}
function renderAllCfg(){
  Object.keys(CFG).forEach(renderCfg);
}
async function addCfg(key){
  const c=CFG[key],inp=document.getElementById(c.input),val=inp.value.trim();
  if(!val){inp.focus();return;}
  if(c.list().some(x=>x.toLowerCase()===val.toLowerCase())){toast(`"${val}" já existe.`,'err');inp.focus();return;}
  c.set([...c.list(),val]);inp.value='';renderCfg(key);fillSelects();fillFilters();
  await serverSaveLists();
  toast(`"${val}" adicionado(a)!`);inp.focus();
}
async function removeCfg(key,idx){
  const c=CFG[key],list=c.list(),item=list[idx];
  const u=DB.filter(r=>r[c.field]===item).length;
  if(u>0){toast(`"${item}" está em uso em ${u} contrato(s).`,'err');return;}
  c.set(list.filter((_,i)=>i!==idx));renderCfg(key);fillSelects();fillFilters();
  await serverSaveLists();
  toast(`"${item}" removido(a).`,'info');
}

/* .. KEYBOARD .. */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeM();closeDel();}
  if(e.key==='Enter'&&document.getElementById('auth-overlay').classList.contains('open')){
    e.preventDefault();
    loginFirebase();
    return;
  }
  if(e.key==='Enter'&&document.getElementById('overlay').classList.contains('open')
    &&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'){e.preventDefault();saveC();}
  if(e.key==='Enter'&&e.target.classList.contains('cfg-inp')){
    const k=Object.keys(CFG).find(k=>CFG[k].input===e.target.id);if(k)addCfg(k);}
});
window.addEventListener('resize',()=>{if(document.getElementById('view-dash').classList.contains('on'))renderDash();});

/* .. BOOT .. */
init();


