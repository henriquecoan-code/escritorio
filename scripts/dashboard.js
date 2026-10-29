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
let DB=[], photos={}, charts={}, pg=1, sortCol='numero', sortDir=-1, pendingDelUID=null;
let activeMonth='all';
let syncTimer=null;
const PG=20;
const FIREBASE_CFG = window.OB_FIREBASE_CONFIG || null;
let USE_FIREBASE=false, fbDb=null;
let fbAuth=null, currentUser=null;
let firebasePermissionWarned=false;
let isSyncing=false;       // trava contra sync concorrente
let isEditing=false;       // true quando modal ou painel de edicao esta aberto
let unsubContratos=null;   // unsubscribe do listener onSnapshot
let createdAtBackfillRunning=false;

/* .. REG STATE .. */
let regFilter = {srch:'', mes:'', adv:'', etapa:'', area:''};
let regPg=1;
const REG_PG=12;
let mCurE=1;
let tempoAuditMode=false;
function buildPeriodChipLabel(allMeses, isFiltered){
  if(isFiltered) return activeMonth || '2026';
  if(!allMeses.length) return '2026';
  if(allMeses.length <= 2) return allMeses.join(' · ');
  const midpoint = Math.ceil(allMeses.length / 2);
  const firstLine = allMeses.slice(0, midpoint).join(' · ');
  const secondLine = allMeses.slice(midpoint).join(' · ');
  return `${firstLine}\n${secondLine}`;
}

const WIDGET_DEFS=[
  {id:'evolucao',icon:'📈',name:'Evolução & Volume'},
  {id:'advogados',icon:'👤',name:'Advogados & Áreas'},
  {id:'tipo_acao',icon:'📊',name:'Tipo de Contrato · Ação · Origem'},
  {id:'adv_mes',icon:'📋',name:'Advogado × Mês · Resumo'},
  {id:'tempo',icon:'⏱',name:'Tempo Médio no Comercial'},
];
const TEMPO_MAIN_DEFS=[
  {id:'chegada_assinatura',l:'Chegada → Assinatura',icon:'✍',f1:'dtChegada',f2:'dtAssinatura',ref:10,d:'Da entrada até assinar'},
  {id:'chegada_docs_solic',l:'Chegada → Docs Solic.',icon:'📋',f1:'dtChegada',f2:'dtDocs',ref:14,d:'Da entrada até solicitar docs'},
  {id:'chegada_docs_rec',l:'Chegada → Docs Rec.',icon:'📦',f1:'dtChegada',f2:'dtDocsRec',ref:21,d:'Até receber documentos'},
  {id:'chegada_entrega',l:'Chegada → Entrega',icon:'🏁',f1:'dtChegada',f2:'dtEntrega',ref:30,d:'Processo comercial completo'},
];
const TEMPO_EXTRA_DEFS=[
  {id:'assinatura_docs_solic',l:'Assinatura → Solic. Docs',f1:'dtAssinatura',f2:'dtDocs',ref:7},
  {id:'docs_solic_docs_rec',l:'Solic. → Docs Rec.',f1:'dtDocs',f2:'dtDocsRec',ref:14},
  {id:'docs_rec_entrega',l:'Docs Rec. → Entrega',f1:'dtDocsRec',f2:'dtEntrega',ref:7},
  {id:'envio_assinatura',l:'Envio → Assinatura',f1:'dtEnvioContrato',f2:'dtAssinatura',ref:7},
];
const DEFAULT_ORDER=['evolucao','advogados','tipo_acao','adv_mes','tempo'];
let widgetOrder=DEFAULT_ORDER.slice();
let woDragIdx=null;

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
    window.OBFirestoreCache?.enable(fbDb);
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

function translateAuthError(code){
  const map={
    'auth/invalid-email':          'Email inválido.',
    'auth/user-not-found':         'Usuário não encontrado.',
    'auth/wrong-password':         'Senha incorreta.',
    'auth/invalid-credential':     'Email ou senha incorretos.',
    'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/user-disabled':          'Esta conta está desativada.',
    'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.',
  };
  return map[code] || 'Falha no login. Tente novamente.';
}

async function loginFirebase(){
  const email=(document.getElementById('auth-email').value||'').trim();
  const password=document.getElementById('auth-password').value||'';
  if(!email || !password){
    setAuthOverlay(true,'Informe email e senha.');
    return;
  }
  const btn=document.getElementById('auth-login-btn');
  btn.disabled=true;
  btn.textContent='Entrando…';
  try{
    await fbAuth.signInWithEmailAndPassword(email,password);
  }catch(e){
    const msg=translateAuthError(e && e.code);
    setAuthOverlay(true,msg);
    btn.disabled=false;
    btn.textContent='Entrar';
  }
}

async function forgotPasswordFirebase(){
  const email=(document.getElementById('auth-email').value||'').trim();
  if(!email){
    setAuthOverlay(true,'Informe seu email para receber o link de recuperação.');
    return;
  }
  const btn=document.getElementById('auth-forgot-btn');
  btn.disabled=true;
  try{
    await fbAuth.sendPasswordResetEmail(email);
    setAuthOverlay(true,'Enviamos um link de recuperação para seu email.');
  }catch(e){
    const msg=e && e.code==='auth/invalid-email'?'Informe um email válido.':e && e.code==='auth/user-not-found'?'Não encontramos uma conta com esse email.':'Não foi possível enviar o link de recuperação.';
    setAuthOverlay(true,msg);
  }finally{btn.disabled=false;}
}

async function logoutFirebase(){
  try{ await fbAuth.signOut(); }
  catch(e){ toast('Erro ao encerrar sessao.','err'); return; }
  await window.OBFirestoreCache?.clearAndReload(fbDb);
}

function ensureAuthenticated(){
  if(currentUser) return true;
  setAuthOverlay(true,'Sessao expirada. Faca login novamente.');
  setSyncStatus('err','Login necessario','Entre com email e senha para continuar');
  return false;
}

async function loadFromFirebase(){
  if(!ensureAuthenticated()) return;
  if(isSyncing) return;
  isSyncing=true;
  setSyncStatus('loading','Conectando Firebase...','');
  try{
    // Contratos chegam pelo listener em startRealtimeSync(); aqui so meta (2 leituras).
    // -- meta: listas e fotos --
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

    firebasePermissionWarned=false;
    fillSelects();renderDash();fillRegFilters();renderReg();
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
      isSyncing=false;
      return;
    }
    setSyncStatus('err','Erro no Firebase','Verifique firebase-config.public.js e as Rules');
    toast('Erro ao carregar dados do Firebase.','err');
  } finally {
    isSyncing=false;
  }
}

async function backfillCreatedAtInFirebase(records){
  if(!USE_FIREBASE || !fbDb || !currentUser) return;
  if(createdAtBackfillRunning) return;

  const source=Array.isArray(records)&&records.length?records:DB;
  const missing=source.filter((r)=>r && r.uid && !r.createdAt);
  if(!missing.length) return;

  createdAtBackfillRunning=true;
  try{
    const CHUNK=350;
    for(let i=0;i<missing.length;i+=CHUNK){
      const slice=missing.slice(i,i+CHUNK);
      const batch=fbDb.batch();
      slice.forEach((r)=>{
        const createdAt=estimateRecordCreatedAtMs(r);
        r.createdAt=createdAt;
        batch.set(fbDb.collection('contratos').doc(r.uid),{createdAt},{merge:true});
      });
      await batch.commit();
    }
    toast(`Backfill de criacao concluido: ${missing.length} registro(s).`,'info');
  }catch(e){
    console.error('Erro no backfill de createdAt:',e);
  }finally{
    createdAtBackfillRunning=false;
  }
}

/* .. FIREBASE STATUS & SYNC .. */
function setSyncStatus(state,label,detail=''){
  document.getElementById('sdot').className=`sdot ${state}`;
  const lbl=document.getElementById('slbl');lbl.className=`slbl ${state}`;lbl.textContent=label;
  document.getElementById('sdet').textContent=detail;
}

// Reabre o listener em vez de reler a colecao: com cache local, so o que mudou e cobrado.
async function syncNow(){
  if(!ensureAuthenticated()) return;
  await loadFromFirebase();
  startRealtimeSync();
}

let contratosLoaded=false;         // primeiro snapshot de contratos ja aplicado
let contratosPendingSnap=null;     // snapshot que chegou com edicao aberta (aplicado ao fechar)
let contratosBackfillChecked=false;

function applyContratosSnapshot(snap){
  contratosLoaded=true;
  // Item 5 - mescla inteligente usando updatedAt
  const remoteUids = new Set();
  snap.docs.forEach((doc)=>{
    const remote = doc.data();
    if(remote.createdAt && !remote.updatedAt) remote.updatedAt=remote.createdAt;
    remoteUids.add(remote.uid);
    const localIdx = DB.findIndex(r=>r.uid===remote.uid);
    if(localIdx===-1){
      DB.push(remote);
    } else {
      const localTs  = DB[localIdx].updatedAt || 0;
      const remoteTs = remote.updatedAt || 0;
      // so sobrescreve se a versao remota for mais recente
      if(remoteTs >= localTs) DB[localIdx] = remote;
    }
  });
  // remove registros excluidos remotamente
  DB = DB.filter(r=>remoteUids.has(r.uid));

  const now=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  setSyncStatus('ok','Tempo real',`${DB.length} registros · ${now}`);
  firebasePermissionWarned=false;
  fillSelects();renderDash();fillRegFilters();renderReg();
}

// Fecha modal/painel de edicao e aplica o snapshot que chegou enquanto estava aberto.
function finishEditing(){
  isEditing=false;
  if(contratosPendingSnap){
    const snap=contratosPendingSnap;
    contratosPendingSnap=null;
    applyContratosSnapshot(snap);
  }
}

/* Item 4 - listener em tempo real para contratos (substitui polling) */
function startRealtimeSync(){
  if(unsubContratos){ unsubContratos(); unsubContratos=null; }
  contratosPendingSnap=null;
  contratosBackfillChecked=false;
  // O primeiro snapshot de cada listener vale sempre, mesmo vazio (ex.: o último contrato foi excluído).
  let primeiroSnapshot=true;

  // includeMetadataChanges: a confirmacao do servidor (fromCache -> false) tambem chega aqui, para o backfill.
  unsubContratos = fbDb.collection('contratos').onSnapshot({includeMetadataChanges:true},(snap)=>{
    if(!contratosBackfillChecked && !snap.metadata.fromCache){
      contratosBackfillChecked=true;
      const missing=snap.docs.map(d=>d.data()).filter(r=>!r.createdAt);
      if(missing.length){
        backfillCreatedAtInFirebase(missing).catch((err)=>console.warn('Backfill createdAt falhou:', err));
      }
    }
    // so metadados mudaram (ex.: cache confirmado pelo servidor): nada a redesenhar
    if(contratosLoaded && !primeiroSnapshot && !snap.docChanges().length) return;
    primeiroSnapshot=false;
    // nao sobrescreve durante edicao; guarda para aplicar ao fechar
    if(isEditing){ contratosPendingSnap=snap; return; }
    applyContratosSnapshot(snap);
  },
  (err)=>{
    console.error('onSnapshot erro:', err);
    const code = String((err&&err.code)||'').toLowerCase();
    if(code.includes('permission-denied')){
      setSyncStatus('err','Firestore bloqueou acesso','Verifique Rules para usuario autenticado');
      if(!firebasePermissionWarned){
        toast('Permissao negada no Firestore para este usuario.','err');
        firebasePermissionWarned=true;
      }
      if(unsubContratos){ unsubContratos(); unsubContratos=null; }
      return;
    }
    setSyncStatus('err','Erro no Firebase','Verifique a conexao');
  });
}

function loadWOStore(){
  try{
    const raw=localStorage.getItem('ob_wo');
    if(!raw) return;
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) return;
    if(parsed.length!==DEFAULT_ORDER.length) return;
    const valid=DEFAULT_ORDER.every(id=>parsed.includes(id));
    if(valid) widgetOrder=parsed.slice();
  }catch(e){}
}

function saveWOStore(){
  try{ localStorage.setItem('ob_wo', JSON.stringify(widgetOrder)); }
  catch(e){}
}

function renderWOUI(){
  const list=document.getElementById('wo-list');
  if(!list) return;
  list.innerHTML=widgetOrder.map((wid,idx)=>{
    const def=WIDGET_DEFS.find(w=>w.id===wid);
    if(!def) return '';
    return `<div class="wo-item" draggable="true" data-wid="${escAttr(wid)}" data-idx="${idx}">
      <span class="wo-handle">⠿</span><span style="font-size:16px">${def.icon}</span><span class="wo-name">${def.name}</span>
    </div>`;
  }).join('');
}

function saveWO(){
  saveWOStore();
  toast('Ordem dos painéis salva!');
  sw('dash');
}

function resetWO(){
  widgetOrder=DEFAULT_ORDER.slice();
  saveWOStore();
  renderWOUI();
  toast('Ordem restaurada.','info');
}

function renderDashLayout(){
  const wrap=document.getElementById('dash-widgets');
  if(!wrap) return;
  const blocks={
    evolucao:`<div data-widget="evolucao"><div class="sl"><div class="sl-line"></div><div class="sl-txt">Evolução &amp; Volume</div><div class="sl-line"></div></div>
      <div class="gw"><div class="card fu" style="animation-delay:.04s"><div class="ct">Contratos por Mês</div><div style="height:210px"><canvas id="evolChart"></canvas></div></div>
      <div class="card fu" style="animation-delay:.08s"><div class="ct">Detalhamento Mensal</div><div class="mc-wrap" id="mc-wrap" style="min-height:210px"></div></div></div></div>`,
    advogados:`<div data-widget="advogados"><div class="sl"><div class="sl-line"></div><div class="sl-txt">Advogados &amp; Áreas</div><div class="sl-line"></div></div>
      <div class="gnw"><div class="card fu" style="animation-delay:.1s"><div class="ct">Ranking &#8212; Advogado Responsável <span style="font-size:10px;color:var(--t3);font-style:italic">clique na foto para alterar</span></div><div class="photo-rank" id="photo-rank"></div></div>
      <div class="card fu" style="animation-delay:.13s"><div class="ct">Contratos por Área <span class="ct-n" id="area-total">--</span></div><div class="hbar-list" id="hbar-area"></div></div></div></div>`,
    tipo_acao:`<div data-widget="tipo_acao"><div class="sl"><div class="sl-line"></div><div class="sl-txt">Tipo de Contrato · Tipo de Ação · Origem</div><div class="sl-line"></div></div>
      <div class="g3"><div class="card fu" style="animation-delay:.15s"><div class="ct">Tipo de Contrato <span class="ct-n" id="tipo-total">--</span></div><div class="dw"><div style="height:170px;width:170px;flex-shrink:0"><canvas id="tipoChart"></canvas></div><div class="dleg" id="tipo-leg"></div></div></div>
      <div class="card fu" style="animation-delay:.18s"><div class="ct">Tipos de Ação &#8212; Top 10 <span class="ct-n" id="acao-total">--</span></div><div class="hbar-list" id="hbar-acao"></div></div>
      <div class="card fu" style="animation-delay:.21s"><div class="ct">Origem do Lead <span class="ct-n" id="orig-total">--</span></div><div class="dw"><div style="height:170px;width:170px;flex-shrink:0"><canvas id="origChart"></canvas></div><div class="dleg" id="orig-leg"></div></div></div></div></div>`,
    adv_mes:`<div data-widget="adv_mes"><div class="sl"><div class="sl-line"></div><div class="sl-txt">Advogado &#215; Mês · Resumo Executivo</div><div class="sl-line"></div></div>
      <div class="gnw"><div class="card fu" style="animation-delay:.23s"><div class="ct">Contratos Assinados por Advogado &#8212; por Mês</div><div style="height:220px"><canvas id="advChart"></canvas></div></div>
      <div class="card fu" style="animation-delay:.26s"><div class="ct">Resumo Executivo</div><table class="stbl" id="sum-tbl"></table></div></div></div>`,
    tempo:`<div data-widget="tempo"><div class="sl"><div class="sl-line"></div><div class="sl-txt">Tempo Médio no Comercial &#8212; Permanência da Pasta</div><div class="sl-line"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:-3px 0 8px">
        <div id="tempo-base-info" style="font-size:10px;color:var(--t3)">Base comum: --</div>
        <button class="btn sm" id="tempo-audit-toggle-btn" type="button">Modo auditoria: off</button>
      </div>
      <div class="g4" id="tempo-grid"></div><div class="card"><div class="ct">Detalhamento por Etapa</div><div id="tempo-detail-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px"></div></div></div>`,
  };
  wrap.innerHTML=widgetOrder.map(id=>blocks[id]||'').join('');
}

function avgArr(arr){
  if(!arr.length) return null;
  return Math.round(arr.reduce((s,v)=>s+v,0)/arr.length);
}

function topValue(data, field, allowed=[]){
  const values=(allowed&&allowed.length?allowed:[...new Set(data.map(r=>r[field]).filter(Boolean))]).filter(Boolean);
  let best=null;
  let bestCount=0;
  values.forEach((v)=>{
    const c=cnt(data,field,v);
    if(c>bestCount){
      best=v;
      bestCount=c;
    }
  });
  return bestCount>0?best:null;
}

function brasiliaTodayISO(){
  const fmt=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Sao_Paulo',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  });
  return fmt.format(new Date());
}

const STAGE_DATE_FLOW=['dtChegada','dtContato','dtEnvioContrato','dtAssinatura','dtDocs','dtDocsRec','dtEntrega'];

function fmtPtDate(dt){
  if(!dt || isNaN(dt)) return '-';
  const d=String(dt.getDate()).padStart(2,'0');
  const m=String(dt.getMonth()+1).padStart(2,'0');
  const y=dt.getFullYear();
  return `${d}/${m}/${y}`;
}

function fieldLabel(field){
  const map={
    dtChegada:'Chegada',
    dtContato:'Contato',
    dtEnvioContrato:'Envio Contrato',
    dtAssinatura:'Assinatura',
    dtDocs:'Solic. Docs',
    dtDocsRec:'Docs Rec.',
    dtEntrega:'Entrega',
    today:'Hoje',
  };
  return map[field] || field;
}

function resolveStageDateForwardInfo(rec, field){
  const idx=STAGE_DATE_FLOW.indexOf(field);
  if(idx===-1) return null;

  for(let i=idx;i<STAGE_DATE_FLOW.length;i++){
    const f=STAGE_DATE_FLOW[i];
    const dt=parseDMY(rec?.[f]);
    if(dt) return {field:f,date:dt};
  }
  return null;
}

function resolveStageDateForward(rec, field){
  const info=resolveStageDateForwardInfo(rec, field);
  return info ? info.date : null;
}

function getTempoMetricAuditRows(source, metric){
  const rows=[];
  source.forEach((rec)=>{
    const startInfo=resolveStageDateForwardInfo(rec,metric.f1);
    const startDate=(startInfo&&startInfo.date) || getRecordCreatedDate(rec);
    if(!startDate) return;

    const endInfo=resolveStageDateForwardInfo(rec,metric.f2);
    let endDate=endInfo?endInfo.date:null;
    let endField=endInfo?endInfo.field:'';
    let usesToday=false;

    if(!endDate && !isDoneRecord(rec)){
      endDate=parseDMY(brasiliaTodayISO());
      endField='today';
      usesToday=true;
    }
    if(!endDate) return;

    const days=Math.max(0,Math.round((endDate-startDate)/86400000));
    rows.push({
      uid:rec.uid||'',
      numero:rec.numero||0,
      cliente:rec.cliente||'Sem nome',
      etapa:Number(rec.etapa||0),
      status:String(rec.status||''),
      days,
      startFieldRequested:metric.f1,
      startFieldUsed:startInfo?startInfo.field:'createdAt',
      startDate:fmtPtDate(startDate),
      endFieldRequested:metric.f2,
      endFieldUsed:endField,
      endDate:fmtPtDate(endDate),
      usedFallbackStart:Boolean(startInfo&&startInfo.field!==metric.f1),
      usedFallbackEnd:Boolean(endInfo&&endInfo.field!==metric.f2),
      usesToday,
    });
  });
  return rows.sort((a,b)=>b.days-a.days);
}

function ensureTempoAuditModal(){
  let ov=document.getElementById('tempo-audit-overlay');
  if(ov) return ov;

  ov=document.createElement('div');
  ov.id='tempo-audit-overlay';
  ov.className='tempo-audit-overlay';
  ov.innerHTML=`<div class="tempo-audit-box">
    <div class="tempo-audit-hd">
      <h3 id="tempo-audit-title">Auditoria</h3>
      <button class="tempo-audit-close" id="tempo-audit-close-btn" type="button">x</button>
    </div>
    <div class="tempo-audit-meta" id="tempo-audit-meta"></div>
    <div class="tempo-audit-table-wrap">
      <table class="tempo-audit-table" id="tempo-audit-table"></table>
    </div>
  </div>`;
  document.body.appendChild(ov);

  ov.addEventListener('click',(event)=>{ if(event.target===ov) ov.classList.remove('open'); });
  ov.querySelector('#tempo-audit-close-btn')?.addEventListener('click',()=>ov.classList.remove('open'));
  return ov;
}

function openTempoAuditModal(metric){
  const source=getView();
  const rows=getTempoMetricAuditRows(source,metric);
  const used=rows.length;
  const base=source.length;
  const fallbackStartCount=rows.filter(r=>r.usedFallbackStart).length;
  const fallbackEndCount=rows.filter(r=>r.usedFallbackEnd).length;
  const todayCount=rows.filter(r=>r.usesToday).length;

  const ov=ensureTempoAuditModal();
  ov.querySelector('#tempo-audit-title').textContent=`Auditoria · ${metric.l}`;
  ov.querySelector('#tempo-audit-meta').innerHTML=
    `Base no período: <strong>${base}</strong> · Usados: <strong>${used}</strong> · Fallback início: <strong>${fallbackStartCount}</strong> · Fallback fim: <strong>${fallbackEndCount}</strong> · Até hoje: <strong>${todayCount}</strong>`;

  const table=ov.querySelector('#tempo-audit-table');
  if(!rows.length){
    table.innerHTML='<thead><tr><th>Resultado</th></tr></thead><tbody><tr><td>Sem registros válidos para esta métrica no período.</td></tr></tbody>';
    ov.classList.add('open');
    return;
  }

  table.innerHTML=`<thead><tr>
    <th>#</th><th>Cliente</th><th>Dias</th><th>Início</th><th>Fim</th><th>Fallback</th><th>Etapa</th>
  </tr></thead><tbody>${rows.map((r)=>`<tr>
    <td>${r.numero||'-'}</td>
    <td>${escHtml(r.cliente)}</td>
    <td>${r.days}d</td>
    <td>${escHtml(fieldLabel(r.startFieldUsed))} (${escHtml(r.startDate)})</td>
    <td>${escHtml(fieldLabel(r.endFieldUsed))} (${escHtml(r.endDate)})</td>
    <td>${r.usedFallbackStart||r.usedFallbackEnd||r.usesToday?'sim':'não'}</td>
    <td>${r.etapa||'-'}</td>
  </tr>`).join('')}</tbody>`;
  ov.classList.add('open');
}

function openTempoConcludedAudit(){
  const source=getView();
  const rows=source.map((rec)=>({
    numero:rec.numero||0,
    cliente:rec.cliente||'Sem nome',
    etapa:Number(rec.etapa||0),
    status:String(rec.status||''),
    concluido:isDoneRecord(rec),
  })).sort((a,b)=>Number(b.concluido)-Number(a.concluido));

  const concluidos=rows.filter((r)=>r.concluido).length;
  const ov=ensureTempoAuditModal();
  ov.querySelector('#tempo-audit-title').textContent='Auditoria · Pastas Concluídas';
  ov.querySelector('#tempo-audit-meta').innerHTML=
    `Concluídas: <strong>${concluidos}</strong> de <strong>${rows.length}</strong> · Taxa: <strong>${rows.length?Math.round(concluidos/rows.length*100):0}%</strong>`;

  const table=ov.querySelector('#tempo-audit-table');
  table.innerHTML=`<thead><tr><th>#</th><th>Cliente</th><th>Etapa</th><th>Status</th><th>Concluída</th></tr></thead>
    <tbody>${rows.map((r)=>`<tr>
      <td>${r.numero||'-'}</td>
      <td>${escHtml(r.cliente)}</td>
      <td>${r.etapa||'-'}</td>
      <td>${escHtml(r.status||'-')}</td>
      <td>${r.concluido?'sim':'não'}</td>
    </tr>`).join('')}</tbody>`;
  ov.classList.add('open');
}

function metricDaysWithStageForwardFallback(rec, startField, endField){
  const start=resolveStageDateForward(rec,startField) || getRecordCreatedDate(rec);
  if(!start) return null;

  const end=resolveStageDateForward(rec,endField);
  if(end) return Math.max(0,Math.round((end-start)/86400000));

  if(!isDoneRecord(rec)){
    const today=parseDMY(brasiliaTodayISO());
    if(!today) return null;
    return Math.max(0,Math.round((today-start)/86400000));
  }

  return null;
}

function metricDaysWithOpenFallback(rec, startField, endField){
  const start=parseDMY(rec?.[startField]) || getRecordCreatedDate(rec);
  if(!start) return null;

  const end=parseDMY(rec?.[endField]);
  if(end) return Math.round((end-start)/86400000);

  // Se a tarefa ainda estiver aberta, mede até hoje (Brasília)
  if(!isDoneRecord(rec)){
    const today=parseDMY(brasiliaTodayISO());
    if(!today) return null;
    return Math.max(0,Math.round((today-start)/86400000));
  }

  return null;
}

function getRecordCreatedDate(rec){
  const candidates=[
    rec?.createdAt,
    rec?.created_at,
    rec?.dataCriacao,
    rec?.criadoEm,
  ];

  for(const c of candidates){
    const d=parseDMY(c);
    if(d) return d;
  }

  // Fallback para IDs gerados por uid(): <Date.now().toString(36)> + 4 chars aleatorios
  const id=String(rec?.uid||'');
  if(id.length>8){
    const base=id.slice(0,-4);
    if(/^[0-9a-z]+$/.test(base)){
      const ms=Number.parseInt(base,36);
      const d=parseDMY(ms);
      if(d) return d;
    }
  }

  return null;
}

function estimateRecordCreatedAtMs(rec){
  const d=getRecordCreatedDate(rec)
    || parseDMY(rec?.dtChegada)
    || parseDMY(rec?.data)
    || parseDMY(rec?.dtAssinatura)
    || parseDMY(rec?.dtEnvioContrato)
    || parseDMY(rec?.dtContato)
    || parseDMY(rec?.dtDocs)
    || parseDMY(rec?.dtDocsRec)
    || parseDMY(rec?.dtEntrega);
  return d ? d.getTime() : Date.now();
}

function renderTempoWidget(){
  const grid=document.getElementById('tempo-grid');
  const detail=document.getElementById('tempo-detail-grid');
  const baseInfo=document.getElementById('tempo-base-info');
  const auditBtn=document.getElementById('tempo-audit-toggle-btn');
  if(!grid || !detail) return;

  const src=getView(); // respeita filtro de mês ativo
  const base=src;
  if(baseInfo){
    baseInfo.textContent=`Base comum: ${base.length} registro${base.length!==1?'s':''} no período`;
  }
  if(auditBtn){
    auditBtn.textContent=`Modo auditoria: ${tempoAuditMode?'on':'off'}`;
    auditBtn.classList.toggle('on',tempoAuditMode);
  }

  grid.innerHTML=TEMPO_MAIN_DEFS.map((tm)=>{
    const vals=base.map((r)=>metricDaysWithStageForwardFallback(r,tm.f1,tm.f2)).filter(v=>v!=null&&v>=0);
    const a=avgArr(vals);
    const col=a==null?'var(--t3)':a<=tm.ref*.7?'var(--green)':a<=tm.ref?'var(--amber)':'var(--rose)';
    const barCol=a==null?'rgba(110,106,136,.3)':a<=tm.ref*.7?'#5EC97A':a<=tm.ref?'#F0A732':'#E8735A';
    const pct=a==null?0:Math.min(Math.round(a/tm.ref*100),100);
    return `<div class="tcard tempo-audit-card ${tempoAuditMode?'audit-on':''}" data-tempo-metric="${escAttr(tm.id)}"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px"><div><div class="tm-l">${tm.l}</div><div class="tm-v" style="color:${col}">${a==null?'--':a+'d'}</div></div><div style="font-size:24px;opacity:.45">${tm.icon}</div></div>
      <div class="tm-s">${tm.d}</div><div class="tm-bg"><div class="tm-bar" style="background:${barCol};width:0" data-w="${pct}%"></div></div><div class="tm-meta"><span>${vals.length}/${base.length} reg.</span><span>Meta: ≤${tm.ref}d</span></div></div>`;
  }).join('');

  const extraHtml=TEMPO_EXTRA_DEFS.map((tm)=>{
    const vals=base.map((r)=>metricDaysWithStageForwardFallback(r,tm.f1,tm.f2)).filter(v=>v!=null&&v>=0);
    const a=avgArr(vals);
    const col=a==null?'var(--t3)':a<=tm.ref*.7?'var(--green)':a<=tm.ref?'var(--amber)':'var(--rose)';
    return `<div class="tempo-audit-card ${tempoAuditMode?'audit-on':''}" data-tempo-metric="${escAttr(tm.id)}" style="padding:9px;border:1px solid var(--b);background:var(--b2)"><div style="font-size:9px;color:var(--t3);margin-bottom:3px">${tm.l}</div><div style="font-family:Georgia,serif;font-size:20px;font-weight:300;color:${col}">${a==null?'--':a+'d'}</div><div style="font-size:9px;color:var(--t3);margin-top:2px">${vals.length}/${base.length} reg. · meta ≤${tm.ref}d</div></div>`;
  }).join('');
  const concluidos=src.filter(r=>Number(r.etapa||0)===5||(r.status||'').toLowerCase()==='encerrado').length;
  detail.innerHTML=extraHtml+`<div class="tempo-audit-card ${tempoAuditMode?'audit-on':''}" data-tempo-metric="concluidos" style="padding:9px;border:1px solid var(--b);background:var(--b2)"><div style="font-size:9px;color:var(--t3);margin-bottom:3px">Pastas Concluídas</div><div style="font-family:Georgia,serif;font-size:20px;color:var(--green)">${concluidos}<span style="font-size:12px;color:var(--t3)">/${src.length}</span></div><div style="font-size:9px;color:var(--t3);margin-top:2px">taxa ${src.length?Math.round(concluidos/src.length*100):0}%</div></div>`;
}

function bindStaticEvents(){
  document.querySelectorAll('.nav-tab[data-view]').forEach((btn)=>{
    btn.addEventListener('click',()=>sw(btn.dataset.view));
  });
  document.getElementById('auth-logout-btn')?.addEventListener('click',logoutFirebase);
  document.getElementById('open-new-contract-btn')?.addEventListener('click',()=>openM());
  document.getElementById('sync-now-btn')?.addEventListener('click',syncNow);
  document.getElementById('save-wo-btn')?.addEventListener('click',saveWO);
  document.getElementById('reset-wo-btn')?.addEventListener('click',resetWO);
  document.getElementById('auth-form')?.addEventListener('submit',(event)=>{
    event.preventDefault();
    loginFirebase();
  });
  document.getElementById('auth-forgot-btn')?.addEventListener('click',forgotPasswordFirebase);
  document.getElementById('backup-export-btn')?.addEventListener('click',exportDashboardBackup);
  document.getElementById('backup-import-btn')?.addEventListener('click',()=>document.getElementById('backup-file-input')?.click());
  document.getElementById('backup-file-input')?.addEventListener('change',importDashboardBackup);
  document.getElementById('overlay')?.addEventListener('click',overlayBg);
  document.getElementById('close-modal-x-btn')?.addEventListener('click',closeM);
  document.getElementById('cancel-modal-btn')?.addEventListener('click',closeM);
  document.getElementById('save-contract-btn')?.addEventListener('click',saveC);
  document.getElementById('m-esel')?.addEventListener('click',(event)=>{
    const btn=event.target.closest('.esb[data-e]');
    if(!btn) return;
    const nextEtapa=Number(btn.dataset.e);
    setME(nextEtapa);
    syncModalStageDates(nextEtapa);
  });
  document.getElementById('m-dtCheg')?.addEventListener('change',()=>{
    mSyncMesFromCheg();
    mCalcDur();
  });
  ['m-dtCont','m-dtEnv','m-dtDocs','m-dtDocsR','m-dtEnt'].forEach((id)=>{
    document.getElementById(id)?.addEventListener('change',mCalcDur);
  });
  document.getElementById('m-dtAssin')?.addEventListener('change',mOnAssin);
  document.getElementById('del-ov')?.addEventListener('click',(event)=>{if(event.target===event.currentTarget)closeDel();});
  document.getElementById('cancel-del-btn')?.addEventListener('click',closeDel);
  document.getElementById('del-btn')?.addEventListener('click',confirmDel);

  /* .. REGISTROS .. */
  document.getElementById('reg-srch')?.addEventListener('input',()=>{
    regFilter.srch=document.getElementById('reg-srch').value.trim().toLowerCase();
    regPg=1;
    renderReg();
  });
  ['reg-ff-mes','reg-ff-adv','reg-ff-etapa','reg-ff-area'].forEach(id=>{
    document.getElementById(id)?.addEventListener('change',()=>{
      regFilter.mes  = document.getElementById('reg-ff-mes').value;
      regFilter.adv  = document.getElementById('reg-ff-adv').value;
      regFilter.etapa= document.getElementById('reg-ff-etapa').value;
      regFilter.area = document.getElementById('reg-ff-area').value;
      regPg=1;
      renderReg();
    });
  });
  document.getElementById('reg-clear-btn')?.addEventListener('click',()=>{
    regFilter={srch:'',mes:'',adv:'',etapa:'',area:''};
    regPg=1;
    document.getElementById('reg-srch').value='';
    document.getElementById('reg-ff-mes').value='';
    document.getElementById('reg-ff-adv').value='';
    document.getElementById('reg-ff-etapa').value='';
    document.getElementById('reg-ff-area').value='';
    renderReg();
  });
  document.getElementById('reg-export-btn')?.addEventListener('click',exportRegHTML);
  document.getElementById('reg-list')?.addEventListener('click',(event)=>{
    // toggle card open/close
    const hd=event.target.closest('[data-toggle-card]');
    if(hd){ toggleRegCard(hd.dataset.toggleCard); return; }
    // set etapa (clique no botão já selecionado desliga)
    const et=event.target.closest('[data-set-etapa][data-etapa]');
    if(et){ const newE=et.classList.contains('on')?0:Number(et.dataset.etapa); setRegEtapa(et.dataset.setEtapa, newE); return; }
    // toggle doc chip
    const chip=event.target.closest('[data-toggle-doc]');
    if(chip){ toggleRegDoc(chip.dataset.toggleDoc, chip.dataset.doc); return; }
    // save
    const saveBtn=event.target.closest('[data-reg-save]');
    if(saveBtn){ saveReg(saveBtn.dataset.regSave); return; }
    // delete
    const delBtn=event.target.closest('[data-reg-delete]');
    if(delBtn){ askDel(delBtn.dataset.regDelete); }
  });
  document.getElementById('reg-list')?.addEventListener('change',(event)=>{
    const d=event.target.closest('[data-date-field][data-uid]');
    if(d){
      refreshRegDurFromInputs(d.dataset.uid);
      const st=document.getElementById(`pstatus-${d.dataset.uid}`);
      if(st) st.textContent='Datas atualizadas — clique Salvar';
      return;
    }
    const f=event.target.closest('[data-reg-field][data-uid]');
    if(f){
      const st=document.getElementById(`pstatus-${f.dataset.uid}`);
      if(st) st.textContent='Campos alterados — clique Salvar';
    }
  });
  document.getElementById('reg-list')?.addEventListener('input',(event)=>{
    const t=event.target.closest('[data-reg-field][data-uid], textarea[data-uid]');
    if(!t) return;
    const uid=t.dataset.uid;
    const st=document.getElementById(`pstatus-${uid}`);
    if(st) st.textContent='Editando — não salvo';
  });
  document.getElementById('reg-pag-btns')?.addEventListener('click',(event)=>{
    const pageBtn=event.target.closest('button[data-reg-page]');
    if(!pageBtn || pageBtn.disabled) return;
    goRegPg(Number(pageBtn.dataset.regPage));
  });
  document.getElementById('month-bar')?.addEventListener('click',(event)=>{
    const btn=event.target.closest('.month-pill[data-month]');
    if(!btn) return;
    setMonth(btn.dataset.month);
  });
  document.getElementById('view-dash')?.addEventListener('click',(event)=>{
    const auditToggle=event.target.closest('#tempo-audit-toggle-btn');
    if(auditToggle){
      tempoAuditMode=!tempoAuditMode;
      renderTempoWidget();
      return;
    }
    const auditCard=event.target.closest('[data-tempo-metric]');
    if(auditCard && tempoAuditMode){
      const metricId=auditCard.dataset.tempoMetric;
      if(metricId==='concluidos'){
        openTempoConcludedAudit();
        return;
      }
      const metric=[...TEMPO_MAIN_DEFS,...TEMPO_EXTRA_DEFS].find((m)=>m.id===metricId);
      if(metric){
        openTempoAuditModal(metric);
        return;
      }
    }
    const box=event.target.closest('.mc[data-month]');
    if(box){ setMonth(box.dataset.month); return; }
    const avatar=event.target.closest('.av[data-photo-input-id]');
    if(avatar){ trigPh(avatar.dataset.photoInputId); }
  });
  document.getElementById('wo-list')?.addEventListener('dragstart',(event)=>{
    const item=event.target.closest('.wo-item[data-idx]');
    if(!item) return;
    woDragIdx=Number(item.dataset.idx);
    item.classList.add('wo-drag');
  });
  document.getElementById('wo-list')?.addEventListener('dragend',(event)=>{
    const item=event.target.closest('.wo-item');
    item?.classList.remove('wo-drag');
  });
  document.getElementById('wo-list')?.addEventListener('dragover',(event)=>{ event.preventDefault(); });
  document.getElementById('wo-list')?.addEventListener('drop',(event)=>{
    event.preventDefault();
    const target=event.target.closest('.wo-item[data-idx]');
    if(!target || woDragIdx==null) return;
    const toIdx=Number(target.dataset.idx);
    if(toIdx===woDragIdx) return;
    const arr=widgetOrder.slice();
    const moved=arr.splice(woDragIdx,1)[0];
    arr.splice(toIdx,0,moved);
    widgetOrder=arr;
    woDragIdx=null;
    renderWOUI();
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
  loadWOStore();
  bindStaticEvents();
  document.getElementById('ts').textContent=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
  refreshAuthUI();

  if(initFirebaseIfConfigured()){
    fbAuth.onAuthStateChanged((user)=>{
      currentUser=user||null;
      refreshAuthUI();
      clearInterval(syncTimer);
      if(currentUser){
        setAuthOverlay(false);
        // carrega meta/fotos e dados iniciais, depois ativa listener tempo real
        loadFromFirebase().then(()=>{
          setSyncStatus('loading','Carregando contratos...','');
          startRealtimeSync();
        });
      }else{
        // encerra listener ao fazer logout
        if(unsubContratos){ unsubContratos(); unsubContratos=null; }
        setSyncStatus('err','Login necessario','Entre com email e senha para carregar os dados');
        setAuthOverlay(true);
      }
      window.OBAuthHint?.update(user);
      window.OBFirestoreCache?.watch(fbDb,user);
    });
    return;
  }

  setSyncStatus('err','Firebase nao configurado','Verifique firebase-config.public.js com as credenciais do projeto');
  toast('Firebase nao configurado. Verifique firebase-config.public.js','err');
}

/* .. VIEWS .. */
function sw(v){
  ['dash','reg','cfg'].forEach(k=>{
    document.getElementById(`view-${k}`)?.classList.toggle('on',k===v);
    document.getElementById(`tab-${k}`)?.classList.toggle('on',k===v);
  });
  if(v==='dash') renderDash();
  if(v==='reg') {fillRegFilters();renderReg();}
  if(v==='cfg')  {renderWOUI();renderAllCfg();}
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
const isoMonthIndex=(iso)=>{
  if(!iso) return null;
  const p=String(iso).split('-');
  if(p.length!==3) return null;
  const month=Number(p[1]);
  return Number.isInteger(month)&&month>=1&&month<=12 ? month-1 : null;
};
const localIsoToday=()=>{
  const now=new Date();
  const y=now.getFullYear();
  const m=String(now.getMonth()+1).padStart(2,'0');
  const d=String(now.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
};
const ETAPA_DATE_SYNC={
  1:{fields:[{modal:'m-dtCheg',panel:'dtChegada',label:'Chegada'}]},
  2:{fields:[{modal:'m-dtCont',panel:'dtContato',label:'Ultimo Contato'}]},
  3:{fields:[
    {modal:'m-dtEnv',panel:'dtEnvioContrato',label:'Envio Contrato'},
    {modal:'m-dtAssin',panel:'dtAssinatura',label:'Assinatura'}
  ]},
  4:{fields:[
    {modal:'m-dtDocs',panel:'dtDocs',label:'Solic. Documentos'},
    {modal:'m-dtDocsR',panel:'dtDocsRec',label:'Docs Recebidos'}
  ]},
  5:{fields:[{modal:'m-dtEnt',panel:'dtEntrega',label:'Entrega'}]}
};
function syncStageDatesProgressive(targetStage,getFieldKey,getValue,setValue){
  const stage=Math.max(0,Math.min(5,Number(targetStage)||0));
  if(!stage) return [];
  const today=localIsoToday();
  const filled=[];
  for(let s=1;s<=stage;s++){
    const cfg=ETAPA_DATE_SYNC[s];
    const fields=(cfg&&Array.isArray(cfg.fields))?cfg.fields:[];
    fields.forEach((f)=>{
      const key=getFieldKey(f);
      if(!key) return;
      const cur=(getValue(key)||'').trim();
      if(cur) return;
      setValue(key,today);
      filled.push(f.label);
    });
  }
  return filled;
}
function stageSyncFeedback(targetStage,filled){
  const stage=Number(targetStage)||0;
  const list=(filled||[]).join(' e ');
  if(!list) return '';
  if(stage===3) return `Pronto! Preenchi ${list}.`;
  if(stage===4) return `Pronto! Preenchi ${list}.`;
  return `Pronto! Preenchi ${list}.`;
}
const dateToSort=dmy=>{const p=(dmy||'').split('/');return p.length===3?`${p[2]}${p[1]}${p[0]}`:'';};
const isDoneRecord=(r)=>Number(r.etapa||0)===5||(String(r.status||'').toLowerCase()==='encerrado');

function firebaseErrLabel(e){
  const code=String((e&&e.code)||'').toLowerCase();
  if(code.includes('resource-exhausted')) return 'cota diaria do Firestore atingida';
  if(code.includes('permission-denied')) return 'permissao negada';
  if(code.includes('unauthenticated')) return 'sessao expirada';
  return code || 'erro desconhecido';
}

/* .. SAVE TO SERVER .. */
async function serverSave(record){
  if(!ensureAuthenticated()) return false;
  record.createdAt = record.createdAt || estimateRecordCreatedAtMs(record);
  record.updatedAt = Date.now();
  try{
    await fbDb.collection('contratos').doc(record.uid).set(record);
    return true;
  }catch(e){
    console.error('Erro ao salvar no Firebase:', e);
    toast(`Aviso: erro ao salvar (${firebaseErrLabel(e)}).`,'err');
    return false;
  }
}
async function serverDelete(uid){
  if(!ensureAuthenticated()) return;
  try{ await fbDb.collection('contratos').doc(uid).delete(); }
  catch(e){
    console.error('Erro ao excluir no Firebase:', e);
    toast(`Aviso: erro ao excluir (${firebaseErrLabel(e)}).`,'err');
  }
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

function dashboardBackupPayload(){
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    contratos: DB,
    listas: {AREAS, ACOES, TIPOS, ORIGENS, ADVS, MESES_REF},
    fotos: photos,
    ordemPaineis: widgetOrder,
  };
}

function exportDashboardBackup(){
  if(!ensureAuthenticated()) return;
  const payload=JSON.stringify(dashboardBackupPayload(),null,2);
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
  a.download=`OB_dashboard_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup completo baixado!','ok');
}

async function commitBackupWrites(writes){
  const chunkSize=450;
  for(let start=0;start<writes.length;start+=chunkSize){
    const batch=fbDb.batch();
    writes.slice(start,start+chunkSize).forEach(({ref,data,remove})=>remove?batch.delete(ref):batch.set(ref,data));
    await batch.commit();
    setSyncStatus('loading','Restaurando backup...',`${Math.min(start+chunkSize,writes.length)}/${writes.length} operações`);
  }
}

async function importDashboardBackup(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  if(!ensureAuthenticated())return;
  try{
    const backup=JSON.parse(await file.text());
    if(!Array.isArray(backup.contratos)||!backup.listas||typeof backup.listas!=='object')throw new Error('formato');
    const listas={...{AREAS,ACOES,TIPOS,ORIGENS,ADVS,MESES_REF},...backup.listas};
    const fotosBackup=backup.fotos&&typeof backup.fotos==='object'?backup.fotos:{};
    const ordem=Array.isArray(backup.ordemPaineis)?backup.ordemPaineis:DEFAULT_ORDER;
    const remote=await fbDb.collection('contratos').get();
    const incoming=new Set(backup.contratos.map(record=>record.uid).filter(Boolean));
    const writes=[];
    backup.contratos.forEach(record=>{if(!record.uid)throw new Error('contrato sem uid');writes.push({ref:fbDb.collection('contratos').doc(record.uid),data:record});});
    writes.push({ref:fbDb.collection('meta').doc('lists'),data:listas});
    writes.push({ref:fbDb.collection('meta').doc('photos'),data:fotosBackup});
    const removals=remote.docs.filter(doc=>!incoming.has(doc.id)).map(doc=>({ref:doc.ref,remove:true}));
    const total=writes.length+removals.length;
    if(!confirm(`Este backup contém ${backup.contratos.length} contrato(s), ${Object.keys(fotosBackup).length} foto(s) e as listas de configuração. Restaurar ${total} operação(ões) no Firestore?`))return;

    setSyncStatus('loading','Preparando restauração...',`${total} operações`);
    await commitBackupWrites(writes);
    await commitBackupWrites(removals);

    DB=backup.contratos;
    ({AREAS,ACOES,TIPOS,ORIGENS,ADVS,MESES_REF}=listas);
    photos=fotosBackup;widgetOrder=ordem;
    saveWOStore();
    renderDash();fillSelects();fillRegFilters();renderReg();renderAllCfg();
    setSyncStatus('ok','Tempo real',`${DB.length} registros restaurados`);
    toast(`Backup restaurado · ${DB.length} contrato(s)`,'ok');
  }catch(e){
    console.error('Erro ao restaurar backup:',e);
    setSyncStatus('err','Erro na restauração','O backup não foi concluído');
    toast('Arquivo inválido ou falha ao restaurar o backup.','err');
  }
}

/* .. DASHBOARD .. */
function renderDash(){
  Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}});charts={};
  renderDashLayout();
  const allMeses=[...new Set(DB.map(r=>r.mes))].sort((a,b)=>MESES_REF.indexOf(a)-MESES_REF.indexOf(b));
  buildMonthPills();
  const view=getView(),total=view.length,isF=activeMonth!=='all';
  const totMes=allMeses.map(m=>DB.filter(r=>r.mes===m).length);
  document.getElementById('period-chip').textContent=buildPeriodChipLabel(allMeses,isF);
  document.getElementById('month-bar-info').textContent=isF?`${total} contrato${total!==1?'s':''} em ${activeMonth}`:`${total} contratos no total`;
  
  // Calcula variação corretamente
  let delta=null;
  if(isF){
    // Se está filtrando por um mês específico, compara com o mês anterior
    const prevIdx=allMeses.indexOf(activeMonth)-1;
    const prevTot=prevIdx>=0?DB.filter(r=>r.mes===allMeses[prevIdx]).length:null;
    delta=prevTot!=null&&prevTot>0?((total-prevTot)/prevTot*100).toFixed(0):null;
  }else{
    // Se está vendo todos os meses, compara o último mês com o penúltimo
    if(allMeses.length>=2){
      const currIdx=allMeses.length-1;
      const prevIdx=currIdx-1;
      const currMesVal=DB.filter(r=>r.mes===allMeses[currIdx]).length;
      const prevMesVal=DB.filter(r=>r.mes===allMeses[prevIdx]).length;
      delta=prevMesVal>0?((currMesVal-prevMesVal)/prevMesVal*100).toFixed(0):null;
    }
  }
  const emAndamento=view.filter(r=>!isDoneRecord(r)).length;
  const concluidos=view.filter(r=>isDoneRecord(r)).length;
  const assinados=view.filter(r=>r.dtAssinatura).length;
  const durEntrega=view.map(r=>metricDaysWithStageForwardFallback(r,'dtChegada','dtEntrega')).filter(v=>v!=null&&v>=0);
  const tempoMedio=avgArr(durEntrega);
  const pctAssin=total?Math.round(assinados/total*100):0;
  const pctAnd=total?Math.round(emAndamento/total*100):0;
  const pctConc=total?Math.round(concluidos/total*100):0;
  const kpis=[
    {l:'Contratos Assinados',v:assinados,pct:pctAssin+'%',s:'com assinatura'},
    {l:'Em Andamento',v:emAndamento,pct:pctAnd+'%',s:'pastas em aberto'},
    {l:'Concluídos',v:concluidos,pct:pctConc+'%',s:'entregues ao advogado'},
    {l:'Variação',v:delta!=null?(+delta>0?'+':'')+delta+'%':'\u2014',s:'vs mês anterior',sm:true},
    {l:'Tempo Médio',v:tempoMedio!=null?`${tempoMedio}d`:'--',s:'chegada \u2192 entrega',sm:true,bl:true},
  ];
  document.getElementById('kpi-row').innerHTML=kpis.map(k=>`
    <div class="kpi">
      <div class="kpi-l">${k.l}</div>
      <div class="kpi-top"><div class="kpi-v${k.sm?' sm':''}${k.bl?' bl':''}">${k.v}</div>${k.pct?`<div class="kpi-pct">${k.pct}</div>`:''}</div>
      <div class="kpi-s">${k.s}</div>
    </div>`).join('');
  // Month compare
  const mc=document.getElementById('mc-wrap');mc.innerHTML='';
  allMeses.forEach((m,i)=>{
    const receb=DB.filter(r=>r.mes===m).length;
    const assinM=DB.filter(r=>r.mes===m&&r.dtAssinatura).length;
    const pctM=receb?Math.round(assinM/receb*100):0;
    const prev=i>0?DB.filter(r=>r.mes===allMeses[i-1]).length:null;
    const d=prev!=null?((receb-prev)/(prev||1)*100).toFixed(0):null;
    const tag=d!=null?`<div class="mc-d ${+d>=0?'up':'dn'}">${+d>=0?'▲':'▼'} ${Math.abs(d)}%</div>`:'';
    mc.innerHTML+=`<div class="mc ${activeMonth===m?'am':''}" data-month="${escAttr(m)}">
      <div class="mc-m">${escHtml(m)}</div>
      <div class="mc-row"><div class="mc-n">${assinM}</div><div class="mc-pct">${pctM}%</div></div>
      <div class="mc-s">${activeMonth===m?'<strong style="color:var(--g)">selecionado</strong>':'assinados'}</div>
      <div style="font-size:9px;color:var(--t3);margin-top:2px">${receb} recebidos</div>
      ${tag}</div>`;
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
  const arTotalAll=arA.reduce((s,v)=>s+v,0)||1;
  const arTotalView=arV.reduce((s,v)=>s+v,0)||1;
  AREAS.map((a,i)=>({a,vAll:arA[i],vView:arV[i]})).sort((x,y)=>y.vAll-x.vAll).slice(0,10).forEach(({a,vAll,vView})=>{
    const pctAll=Math.round(vAll/arTotalAll*100);
    const pctView=Math.round(vView/arTotalView*100);
    hArea.innerHTML+=`<div class="hbr"><div class="hbr-name">${escHtml(a)}</div>
      <div class="hbr-row"><div class="hbr-lbl total">Total</div><div class="hbb"><div class="hbf total" style="width:0" data-w="${Math.round(vAll/arMax*100)}%"></div></div><div class="hbn total">${vAll} <span class="pr-n-pct">${pctAll}%</span></div></div>
      ${isF?`<div class="hbr-row"><div class="hbr-lbl month">${activeMonth.slice(0,3)}</div><div class="hbb"><div class="hbf month" style="width:0" data-w="${Math.round(vView/arMax*100)}%"></div></div><div class="hbn month">${vView} <span class="pr-n-pct">${pctView}%</span></div></div>`:''}
    </div>`;
  });
  // Acao
  const acA=ACOES.map(a=>cnt(DB,'acao',a)),acV=ACOES.map(a=>cnt(view,'acao',a)),acMax=Math.max(...acA,1);
  document.getElementById('acao-total').textContent=total;
  const hAcao=document.getElementById('hbar-acao');hAcao.innerHTML='';
  const acS=ACOES.map((a,i)=>({a,vAll:acA[i],vView:acV[i]})).filter(x=>x.vAll>0).sort((x,y)=>y.vAll-x.vAll).slice(0,10);
  const acTotalAll=acS.reduce((s,x)=>s+x.vAll,0)||1;
  const acTotalView=acS.reduce((s,x)=>s+x.vView,0)||1;
  if(!acS.length)hAcao.innerHTML=`<div style="color:var(--t3);font-size:11px;text-align:center;padding:16px;font-style:italic">Nenhuma ação registrada</div>`;
  else acS.forEach(({a,vAll,vView})=>{
    const pctAll=Math.round(vAll/acTotalAll*100);
    const pctView=Math.round(vView/acTotalView*100);
    hAcao.innerHTML+=`<div class="hbr"><div class="hbr-name" style="font-size:10px">${escHtml(a)}</div>
      <div class="hbr-row"><div class="hbr-lbl total" style="width:36px;font-size:9px">Total</div><div class="hbb"><div class="hbf total" style="width:0;background:linear-gradient(90deg,#5B8CDB,#7AADEE)" data-w="${Math.round(vAll/acMax*100)}%"></div></div><div class="hbn total" style="color:var(--blue)">${vAll} <span class="pr-n-pct">${pctAll}%</span></div></div>
      ${isF?`<div class="hbr-row"><div class="hbr-lbl month" style="width:36px;font-size:9px">${activeMonth.slice(0,3)}</div><div class="hbb"><div class="hbf month" style="width:0" data-w="${Math.round(vView/acMax*100)}%"></div></div><div class="hbn month">${vView} <span class="pr-n-pct">${pctView}%</span></div></div>`:''}
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
    tl.innerHTML+=`<div class="di"><div class="dd" style="background:${tiC[i]}"></div><div class="dn2">${escHtml(l)}</div><div class="dv">${tiV[i]}</div>${isF?`<span class="dv2">/ ${tiA[i]}</span>`:''}<div class="dp">${p}%</div></div>`;});
  // Origem donut
  const orA=ORIGENS.map(o=>cnt(DB,'origem',o)),orV=ORIGENS.map(o=>cnt(view,'origem',o)),orSum=orV.reduce((a,b)=>a+b,0);
  document.getElementById('orig-total').textContent=orSum||'--';
  const orC=['#4E8FE8','rgba(78,143,232,.5)','rgba(78,143,232,.2)'];
  charts.orig=new Chart(document.getElementById('origChart'),{type:'doughnut',
    data:{labels:ORIGENS,datasets:[{data:orSum?orV:[1,1,1],backgroundColor:orC,borderColor:'#07070F',borderWidth:3,hoverOffset:5}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false},tooltip:TT}}});
  const ol=document.getElementById('orig-leg');ol.innerHTML='';
  ORIGENS.forEach((l,i)=>{const p=orSum?Math.round(orV[i]/orSum*100):0;
    ol.innerHTML+=`<div class="di"><div class="dd" style="background:${orC[i]}"></div><div class="dn2">${escHtml(l)}</div><div class="dv">${orV[i]}</div>${isF?`<span class="dv2">/ ${orA[i]}</span>`:''}<div class="dp">${p}%</div></div>`;});
  // Adv - Mês
  const bC=['rgba(201,168,76,.8)','rgba(78,143,232,.65)','rgba(94,201,122,.55)','rgba(232,115,90,.55)'];
  charts.adv=new Chart(document.getElementById('advChart'),{type:'bar',
    data:{labels:ADVS,datasets:allMeses.map((m,i)=>({label:m,data:ADVS.map(a=>cntM(DB,m,'adv',a)),
      backgroundColor:bC[i%bC.length],borderRadius:3,borderWidth:activeMonth===m?2:0,borderColor:'rgba(255,255,255,.6)'}))},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#6E6A88',boxWidth:9,padding:12}},tooltip:TT},
      scales:{x:{grid:{display:false},ticks:{color:'#6E6A88'}},y:{grid:{color:'rgba(201,168,76,.04)'},ticks:{color:'#6E6A88'}}}}});
  // Summary
  const topArea=topValue(view,'area',AREAS);
  const topAdv=topValue(view,'adv',ADVS);
  const topTipo=topValue(view,'tipo',TIPOS);
  const topAcao=topValue(view,'acao',ACOES);
  document.getElementById('sum-tbl').innerHTML=`
    <thead><tr><th>Indicador</th><th>${isF?activeMonth:'Total'}</th>${isF?'<th>Total</th>':''}</tr></thead>
    <tbody>${[
      ['Contratos',total,DB.length],['Área Líder',topArea||'--',topArea?cnt(DB,'area',topArea):'--'],
      ['Ação Mais Comum',topAcao||'--',topAcao?cnt(DB,'acao',topAcao):'--'],
      ['Tipo Predominante',topTipo||'--',topTipo?cnt(DB,'tipo',topTipo):'--'],
      ['Advogado Líder',topAdv||'--',topAdv?cnt(DB,'adv',topAdv):'--'],
      ['Sem Adv. Vinc.',view.filter(r=>!r.adv).length,DB.filter(r=>!r.adv).length],
    ].map(([k,v,t])=>`<tr><td style="color:var(--t3)">${escHtml(k)}</td><td><span class="tag">${escHtml(v)}</span></td>${isF?`<td><span class="tag blue">${escHtml(t)}</span></td>`:''}</tr>`).join('')}
    </tbody>`;
  renderTempoWidget();
  setTimeout(()=>document.querySelectorAll('[data-w]').forEach(el=>{el.style.width=el.dataset.w;}),300);
}

/* .. PHOTO RANK .. */
function buildPhotoRank(sorted,max,isF){
  const wrap=document.getElementById('photo-rank'),pinp=document.getElementById('photo-inputs');
  wrap.innerHTML='';pinp.innerHTML='';
  const totalAll=sorted.reduce((s,x)=>s+x.vAll,0)||1;
  sorted.forEach(({n,vAll,vView},i)=>{
    const pA=Math.round(vAll/max*100),pV=Math.round(vView/max*100);
    const pct=Math.round(vAll/totalAll*100);
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
      <div class="pr-right"><div class="pr-n">${vAll} <span class="pr-n-pct">${pct}%</span></div>
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
  const m=[...new Set([...DB.map(r=>r.mes),...MESES_REF])]
    .sort((a,b)=>{
      const ai=MESES_REF.indexOf(a),bi=MESES_REF.indexOf(b);
      if(ai===-1&&bi===-1)return a.localeCompare(b,'pt-BR');
      if(ai===-1)return 1;if(bi===-1)return -1;
      return ai-bi;
    });
  const mk=(id,opts,blank='')=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML=(blank?[`<option value="">${escHtml(blank)}</option>`]:[]).concat(opts.map(o=>`<option value="${escAttr(o)}">${escHtml(o||'-- Selecionar --')}</option>`)).join('');
  };
  mk('m-mes',m);mk('m-area',AREAS,'— Selecionar —');mk('m-acao',ACOES,'— Selecionar —');
  mk('m-tipo',TIPOS,'— Selecionar —');mk('m-orig',ORIGENS,'— Selecionar —');
  mk('m-adv',ADVS,'— Selecionar —');
  const st=document.getElementById('m-status');
  if(st){
    const opts=[...new Set(['Em andamento',...STATUS])];
    st.innerHTML=opts.map(v=>`<option value="${escAttr(v)}">${escHtml(v)}</option>`).join('');
  }
}
/* .. MODAL .. */
function modalDaysBetween(aIso,bIso){
  if(!aIso||!bIso) return null;
  const a=new Date(aIso),b=new Date(bIso);
  if(isNaN(a)||isNaN(b)) return null;
  return Math.round((b-a)/86400000);
}
function setME(e){
  mCurE=e;
  document.querySelectorAll('.esb[data-e]').forEach((btn)=>{
    btn.classList.toggle('on',Number(btn.dataset.e)===e);
  });
  document.getElementById('m-csec')?.classList.toggle('show',e>=3);
  document.getElementById('m-ibox')?.classList.toggle('show',e>=3);
}
function mCalcDur(){
  const g=(id)=>document.getElementById(id)?.value||'';
  const pairs=[
    {l:'Chegada→Assin.',d:modalDaysBetween(g('m-dtCheg'),g('m-dtAssin')),ref:10},
    {l:'Chegada→Docs',d:modalDaysBetween(g('m-dtCheg'),g('m-dtDocsR')),ref:15},
    {l:'Total',d:modalDaysBetween(g('m-dtCheg'),g('m-dtEnt')||g('m-dtDocsR')),ref:20},
  ];
  const valid=pairs.filter((p)=>p.d!=null&&p.d>=0);
  const box=document.getElementById('m-dur-box');
  const grid=document.getElementById('m-dur-grid');
  if(!box||!grid) return;
  if(!valid.length){
    box.classList.remove('show');
    grid.innerHTML='';
    return;
  }
  box.classList.add('show');
  grid.innerHTML=valid.map((p)=>{
    const col=p.d<=p.ref*.7?'var(--green)':p.d<=p.ref?'var(--amber)':'var(--rose)';
    return `<div class="dur-item"><div class="dur-lbl">${p.l}</div><div class="dur-val" style="color:${col}">${p.d}d</div></div>`;
  }).join('');
}
function mSyncMesFromCheg(){
  const cheg=document.getElementById('m-dtCheg')?.value||'';
  if(!cheg) return;
  const idx=isoMonthIndex(cheg);
  const m=idx!=null ? MESES_REF[idx] : '';
  const sel=document.getElementById('m-mes');
  if(sel&&m) sel.value=m;
}
function mOnAssin(){
  const assin=document.getElementById('m-dtAssin')?.value||'';
  if(assin&&mCurE<3) setME(3);
  if(assin){
    const idx=isoMonthIndex(assin);
    const m=idx!=null ? MESES_REF[idx] : '';
    const sel=document.getElementById('m-mes');
    if(sel&&m) sel.value=m;
  }
  mCalcDur();
}
function syncModalStageDates(targetStage){
  const filled=syncStageDatesProgressive(
    targetStage,
    field=>field.modal,
    key=>document.getElementById(key)?.value||'',
    (key,val)=>{
      const el=document.getElementById(key);
      if(el) el.value=val;
    }
  );
  if(!filled.length) return;
  if(filled.includes('Chegada')) mSyncMesFromCheg();
  mCalcDur();
  toast(stageSyncFeedback(targetStage,filled),'info');
}
function openM(editUid){
  try {
    if(!ensureAuthenticated()) return;
    isEditing=true;
    const mUid = document.getElementById('m-uid'); if(mUid) mUid.value=editUid||'';
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };

    if(editUid){
      const r=(Array.isArray(DB)?DB:[]).find(x=>x.uid===editUid);if(!r)return;
      const mTitle = document.getElementById('m-title'); if(mTitle) mTitle.textContent='Editar Registro';
      setVal('m-cli', r.cliente);
      setVal('m-adv', r.adv);
      setVal('m-area', r.area);
      setVal('m-acao', r.acao);
      setVal('m-tipo', r.tipo);
      setVal('m-orig', r.origem);
      setVal('m-mes', r.mes);
      setVal('m-status', r.status || 'Em andamento');
      setVal('m-dtCheg', isoDate(r.dtChegada||r.data||''));
      setVal('m-dtCont', isoDate(r.dtContato||''));
      setVal('m-dtEnv', isoDate(r.dtEnvioContrato||''));
      setVal('m-dtAssin', isoDate(r.dtAssinatura||''));
      setVal('m-dtDocs', isoDate(r.dtDocs||''));
      setVal('m-dtDocsR', isoDate(r.dtDocsRec||''));
      setVal('m-dtEnt', isoDate(r.dtEntrega||''));
      setVal('m-obs', r.obs);
      setME(Number(r.etapa)||1);
      try { mCalcDur(); } catch(e) {}
    }else{
      const mTitle = document.getElementById('m-title'); if(mTitle) mTitle.textContent='Novo Registro';
      const mesArr = (typeof MESES_REF !== 'undefined' && Array.isArray(MESES_REF)) ? MESES_REF : [];
      const mesMoment = mesArr[new Date().getMonth()]||'';
      ['m-cli','m-obs','m-adv','m-area','m-acao','m-tipo','m-orig','m-dtCont','m-dtEnv','m-dtAssin','m-dtDocs','m-dtDocsR','m-dtEnt'].forEach(id => setVal(id, ''));
      setVal('m-dtCheg', typeof localIsoToday === 'function' ? localIsoToday() : new Date().toISOString().split('T')[0]);
      setVal('m-mes', (typeof activeMonth !== 'undefined' && activeMonth !== 'all') ? activeMonth : mesMoment);
      setVal('m-status', 'Em andamento');
      setME(1);
      try { mCalcDur(); } catch(e) {}
    }
    const overlay = document.getElementById('overlay'); if(overlay) overlay.classList.add('open');
    setTimeout(() => { const cli = document.getElementById('m-cli'); if(cli && typeof cli.focus === 'function') cli.focus(); }, 120);
  } catch(err) {
    console.error('Erro em openM:', err);
    const overlay = document.getElementById('overlay'); if(overlay) overlay.classList.add('open');
  }
}
function closeM(){finishEditing();document.getElementById('overlay').classList.remove('open');}
function overlayBg(e){if(e.target===e.currentTarget)closeM();}
async function saveC(){
  const cli=document.getElementById('m-cli').value.trim();
  if(!cli){toast('Informe o nome do cliente.','err');document.getElementById('m-cli').focus();return;}
  const chegadaRaw=document.getElementById('m-dtCheg').value.trim();
  if(!chegadaRaw){toast('Informe a data de chegada.','err');document.getElementById('m-dtCheg').focus();return;}
  const advVal=document.getElementById('m-adv').value;
  if(!advVal){toast('Selecione o advogado responsável.','err');document.getElementById('m-adv').focus();return;}
  const saveBtn=document.getElementById('save-contract-btn');
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Salvando...';}

  const editUid=document.getElementById('m-uid').value;
  const dtAssinRaw=document.getElementById('m-dtAssin').value;
  const toDMY=(id)=>{const v=document.getElementById(id)?.value||'';return v?fmtDate(v):'';};
  const obj={
    uid:editUid||uid(),
    createdAt:Date.now(),
    updatedAt:Date.now(),
    cliente:cli,
    adv:document.getElementById('m-adv').value,
    area:document.getElementById('m-area').value,
    acao:document.getElementById('m-acao').value,
    tipo:document.getElementById('m-tipo').value,
    origem:document.getElementById('m-orig').value,
    mes:document.getElementById('m-mes').value,
    status:document.getElementById('m-status').value,
    obs:document.getElementById('m-obs').value.trim(),
    etapa:Number(mCurE)||1,
    data:fmtDate(dtAssinRaw||chegadaRaw),
    docsPendentes:[],
    dtChegada:toDMY('m-dtCheg'),
    dtContato:toDMY('m-dtCont'),
    dtEnvioContrato:toDMY('m-dtEnv'),
    dtAssinatura:toDMY('m-dtAssin'),
    dtDocs:toDMY('m-dtDocs'),
    dtDocsRec:toDMY('m-dtDocsR'),
    dtEntrega:toDMY('m-dtEnt'),
  };

  let wasNew=false;
  if(editUid){
    const i=DB.findIndex(x=>x.uid===editUid);
    if(i>=0){
      obj.numero=DB[i].numero||null;
      obj.createdAt=DB[i].createdAt||estimateRecordCreatedAtMs(DB[i]);
      DB[i]=obj;
    }
  }else{
    obj.numero=Math.max(0,...DB.map(r=>r.numero||0))+1;
    DB.push(obj);wasNew=true;
  }

  const ok=await serverSave(obj);
  if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Salvar';}
  if(!ok){
    if(wasNew) DB=DB.filter(x=>x.uid!==obj.uid);
    return;
  }
  toast(`"${cli}" ${editUid?'atualizado':'adicionado'}.`);
  fillSelects();closeM();renderDash();renderReg();
}

/* .. DELETE .. */
function askDel(u){
  const r=DB.find(x=>x.uid===u);if(!r)return;pendingDelUID=u;
  document.getElementById('del-msg').innerHTML=`Deseja excluir o registro de<br><strong style="color:var(--t)">"${escHtml(r.cliente||'') }"</strong>?`;
  document.getElementById('del-ov').classList.add('open');
}
async function confirmDel(){
  if(!pendingDelUID)return;
  const u=pendingDelUID;DB=DB.filter(x=>x.uid!==u);pendingDelUID=null;
  await serverDelete(u);
  closeDel();toast('Registro excluído.','info');renderDash();renderReg();
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
  c.set([...c.list(),val]);inp.value='';renderCfg(key);fillSelects();
  await serverSaveLists();
  toast(`"${val}" adicionado(a)!`);inp.focus();
}
async function removeCfg(key,idx){
  const c=CFG[key],list=c.list(),item=list[idx];
  const u=DB.filter(r=>r[c.field]===item).length;
  if(u>0){toast(`"${item}" está em uso em ${u} contrato(s).`,'err');return;}
  c.set(list.filter((_,i)=>i!==idx));renderCfg(key);fillSelects();
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

/* ═══════════════════════════════════════════════════════
   MÓDULO REGISTROS
   ═══════════════════════════════════════════════════════ */

const ETAPA_LABELS = ['Recebida','Negociação','Contrato','Documentação','Concluído'];
const ETAPA_ICONS  = ['📥','📞','✍','📋','✅'];
const DOCS_LISTA   = [
  'PPP','Atestado','Prontuário','CNIS','Laudo Médico','Receita Médica','Declaração INSS',
  'Carteira de Trabalho','RG','CPF','Certidão de Nascimento','Certidão de Casamento',
  'Comprovante de Residência','Boletim de Ocorrência','Declaração de IR','Holerite',
  'Exames Complementares','Contrato de Trabalho','Outros'
];

/* Converte "DD/MM/AAAA" para objeto Date (ou null) */
function parseDMY(dmy){
  if(!dmy) return null;

  const MIN_YEAR = 2000;
  const MAX_YEAR = 2100;
  const buildValidDate = (y,m,d)=>{
    if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)) return null;
    if(y<MIN_YEAR || y>MAX_YEAR) return null;
    if(m<1 || m>12) return null;
    if(d<1 || d>31) return null;
    const dt = new Date(y,m-1,d);
    if(isNaN(dt)) return null;
    // Evita autocorreção silenciosa do Date (ex.: 31/02 vira março)
    if(dt.getFullYear()!==y || dt.getMonth()!==m-1 || dt.getDate()!==d) return null;
    return dt;
  };

  // Firestore Timestamp (compat) ou objeto Date
  if(typeof dmy==='object'){
    if(typeof dmy.toDate==='function'){
      const dt=dmy.toDate();
      return buildValidDate(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    }
    if(dmy instanceof Date){
      return buildValidDate(dmy.getFullYear(),dmy.getMonth()+1,dmy.getDate());
    }
    if(Number.isFinite(dmy.seconds)){
      const dt=new Date(Number(dmy.seconds)*1000);
      return buildValidDate(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    }
    return null;
  }

  if(typeof dmy==='number' && Number.isFinite(dmy)){
    const ms = dmy > 1e11 ? dmy : dmy * 1000;
    const dt = new Date(ms);
    return buildValidDate(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
  }

  const raw=String(dmy).trim();
  if(!raw) return null;

  // Epoch em string (segundos ou milissegundos)
  if(/^\d{10,13}$/.test(raw)){
    const n=Number(raw);
    const ms = raw.length===13 ? n : n*1000;
    const dt = new Date(ms);
    return buildValidDate(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
  }

  // DD/MM/AAAA
  let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    return buildValidDate(Number(m[3]),Number(m[2]),Number(m[1]));
  }

  // AAAA-MM-DD (com ou sem hora)
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if(m){
    return buildValidDate(Number(m[1]),Number(m[2]),Number(m[3]));
  }

  return null;
}
/* Converte "AAAA-MM-DD" para "DD/MM/AAAA" */
function iso2dmy(iso){if(!iso)return '';const p=iso.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:''}
/* Converte "DD/MM/AAAA" para "AAAA-MM-DD" para input[type=date] */
function dmy2iso(dmy){if(!dmy)return '';const p=dmy.split('/');return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:''}
/* Diferença em dias entre duas strings DD/MM/AAAA */
function diffDays(a,b){const da=parseDMY(a),db=parseDMY(b);if(!da||!db)return null;return Math.round((db-da)/(86400000));}

function calcRegDur(rec){
  const dCheg=rec.dtChegada||'', dSign=rec.dtAssinatura||'', dEnd=rec.dtEntrega||'';
  const hoje=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const dRef = dEnd || hoje;
  const total = diffDays(dCheg, dRef);
  const ateSign = diffDays(dCheg, dSign);
  return {total: total!=null?total+'d':'--', ateSign: ateSign!=null?ateSign+'d':'--'};
}

function getRegDurItems(rec){
  const defs=[
    {l:'Chegada→Assin.',f1:'dtChegada',f2:'dtAssinatura',ref:10},
    {l:'Assin.→Docs',f1:'dtAssinatura',f2:'dtDocsRec',ref:7},
    {l:'Docs→Entrega',f1:'dtDocsRec',f2:'dtEntrega',ref:5},
  ];
  return defs.map((d)=>{
    const days=diffDays(rec[d.f1],rec[d.f2]);
    if(days==null||days<0) return null;
    return {l:d.l,d:days,ref:d.ref};
  }).filter(Boolean);
}

function regDurGridHTML(items){
  return items.map((it)=>{
    const col=it.d<=it.ref*.7?'var(--green)':it.d<=it.ref?'var(--amber)':'var(--rose)';
    return `<div class="dur-item"><div class="dur-lbl">${it.l}</div><div class="dur-val" style="color:${col}">${it.d}d</div></div>`;
  }).join('');
}

function fillRegFilters(){
  const meses=[...new Set(DB.map(r=>r.mes))].sort((a,b)=>MESES_REF.indexOf(a)-MESES_REF.indexOf(b));
  const advs=[...new Set(DB.map(r=>r.adv).filter(Boolean))].sort();
  const mesEl=document.getElementById('reg-ff-mes');
  const advEl=document.getElementById('reg-ff-adv');
  if(!mesEl||!advEl) return;
  const areaEl=document.getElementById('reg-ff-area');
  const areas=[...new Set(DB.map(r=>r.area).filter(Boolean))].sort();
  mesEl.innerHTML='<option value="">Todos os meses</option>'+meses.map(m=>`<option value="${escAttr(m)}" ${regFilter.mes===m?'selected':''}>${escHtml(m)}</option>`).join('');
  advEl.innerHTML='<option value="">Todos os advogados</option>'+advs.map(a=>`<option value="${escAttr(a)}" ${regFilter.adv===a?'selected':''}>${escHtml(a)}</option>`).join('');
  if(areaEl) areaEl.innerHTML='<option value="">Todas as áreas</option>'+areas.map(a=>`<option value="${escAttr(a)}" ${regFilter.area===a?'selected':''}>${escHtml(a)}</option>`).join('');
}

function getRegView(){
  let list=[...DB];
  if(regFilter.srch){const q=regFilter.srch;list=list.filter(r=>(r.cliente||'').toLowerCase().includes(q)||(r.acao||'').toLowerCase().includes(q)||(r.area||'').toLowerCase().includes(q));}
  if(regFilter.mes)  list=list.filter(r=>r.mes===regFilter.mes);
  if(regFilter.adv)  list=list.filter(r=>r.adv===regFilter.adv);
  if(regFilter.etapa)list=list.filter(r=>String(r.etapa||1)===regFilter.etapa);
  if(regFilter.area) list=list.filter(r=>r.area===regFilter.area);
  return list.sort((a,b)=>(b.numero||0)-(a.numero||0));
}

function regStageBadge(etapa){
  const e=Number(etapa)||1;
  const defs={
    1:{c:'c1',l:'Primeiro Contato',i:'📥'},
    2:{c:'c2',l:'Envio Contrato',i:'📞'},
    3:{c:'c3',l:'Assinatura',i:'✍'},
    4:{c:'c4',l:'Documentos',i:'📋'},
    5:{c:'c5',l:'Entregue',i:'✅'}
  };
  const d=defs[e]||defs[1];
  return `<span class="ebx ${d.c}">${d.i} ${d.l}</span>`;
}

function regDurBadge(rec){
  const hoje=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const fim=rec.dtEntrega||hoje;
  const d=diffDays(rec.dtChegada,fim);
  if(d==null||d<0) return '<span class="bx bm">--</span>';
  if(d<=10) return `<span class="bx bgr">${d}d</span>`;
  if(d<=20) return `<span class="bx bam">${d}d</span>`;
  return `<span class="bx bro">${d}d</span>`;
}

function buildRegCard(rec){
  const etapa=Math.max(1,Math.min(5,Number(rec.etapa)||1));
  const signed=Boolean(rec.dtAssinatura)||isDoneRecord(rec);
  const area=rec.area?(rec.area.length>18?`${rec.area.slice(0,17)}…`:rec.area):'';
  const docsPend=Array.isArray(rec.docsPendentes)?rec.docsPendentes:[];
  const opt=(v,s)=>`<option value="${escAttr(v)}" ${String(s||'')===String(v)?'selected':''}>${escHtml(v)}</option>`;
  const statusList=[...new Set(['Em andamento',...STATUS,rec.status||''])].filter(Boolean);
  const dots=[1,2,3,4,5].map((s,i)=>`<div class="pdot ${s<etapa?'dn':s===etapa?'ac':'pd'}"></div>${i<4?'<div class="pln"></div>':''}`).join('');
  const durItems=getRegDurItems(rec);
  const durCalc=calcRegDur(rec);
  const dateFields=[
    {key:'dtChegada',label:'📥 Chegada'},
    {key:'dtContato',label:'📞 Ultimo Contato'},
    {key:'dtEnvioContrato',label:'📄 Envio Contrato'},
    {key:'dtAssinatura',label:'✍ Assinatura'},
    {key:'dtDocs',label:'📋 Solic. Docs'},
    {key:'dtDocsRec',label:'📦 Docs Recebidos'},
    {key:'dtEntrega',label:'🏁 Entrega ao Advogado'},
  ];

  const pipeHTML=ETAPA_LABELS.map((lbl,i)=>{
    const n=i+1;
    const cls=n===etapa?' on':'';
    const icon=ETAPA_ICONS[i]||String(n);
    return `<button class="eb${cls}" data-set-etapa="${escAttr(rec.uid)}" data-etapa="${n}" title="${escAttr(lbl)}"><span class="ei">${icon}</span>${escHtml(lbl)}</button>`;
  }).join('');

  const dateHTML=dateFields.map(f=>`
    <div class="ifield ${f.key==='dtEntrega'?'full':''}">
      <label>${escHtml(f.label)}</label>
      <input class="dg-input" type="date" data-date-field="${escAttr(f.key)}" data-uid="${escAttr(rec.uid)}" value="${escAttr(dmy2iso(rec[f.key]||''))}">
    </div>`).join('');

  const baseFieldsHTML=`
    <div class="ifield">
      <label>Cliente</label>
      <input class="dg-input" type="text" data-reg-field="cliente" data-uid="${escAttr(rec.uid)}" value="${escAttr(rec.cliente||'')}">
    </div>
    <div class="ifield">
      <label>Advogado</label>
      <select class="dg-input" data-reg-field="adv" data-uid="${escAttr(rec.uid)}">
        <option value="">-- Selecionar --</option>
        ${ADVS.map(v=>opt(v,rec.adv)).join('')}
      </select>
    </div>
    <div class="ifield">
      <label>Area</label>
      <select class="dg-input" data-reg-field="area" data-uid="${escAttr(rec.uid)}">
        <option value="">-- Selecionar --</option>
        ${AREAS.map(v=>opt(v,rec.area)).join('')}
      </select>
    </div>
    <div class="ifield">
      <label>Acao</label>
      <select class="dg-input" data-reg-field="acao" data-uid="${escAttr(rec.uid)}">
        <option value="">-- Selecionar --</option>
        ${ACOES.map(v=>opt(v,rec.acao)).join('')}
      </select>
    </div>`;

  const contractFieldsHTML=`
    <div class="ifield">
      <label>Tipo</label>
      <select class="dg-input" data-reg-field="tipo" data-uid="${escAttr(rec.uid)}">
        <option value="">-- Selecionar --</option>
        ${TIPOS.map(v=>opt(v,rec.tipo)).join('')}
      </select>
    </div>
    <div class="ifield">
      <label>Origem</label>
      <select class="dg-input" data-reg-field="origem" data-uid="${escAttr(rec.uid)}">
        <option value="">-- Selecionar --</option>
        ${ORIGENS.map(v=>opt(v,rec.origem)).join('')}
      </select>
    </div>
    <div class="ifield">
      <label>Mes Ref.</label>
      <select class="dg-input" data-reg-field="mes" data-uid="${escAttr(rec.uid)}">
        ${MESES_REF.map(v=>opt(v,rec.mes)).join('')}
      </select>
    </div>
    <div class="ifield">
      <label>Status</label>
      <select class="dg-input" data-reg-field="status" data-uid="${escAttr(rec.uid)}">
        ${statusList.map(v=>opt(v,rec.status)).join('')}
      </select>
    </div>`;

  const chipsHTML=DOCS_LISTA.map(doc=>{
    const pend=docsPend.includes(doc);
    return `<span class="doc-chip ${pend?'sel':''}" data-toggle-doc="${escAttr(rec.uid)}" data-doc="${escAttr(doc)}">${escHtml(doc)}</span>`;
  }).join('');

  return `<div class="reg-card" id="regcard-${escAttr(rec.uid)}">
  <div class="reg-hdr" data-toggle-card="${escAttr(rec.uid)}">
    <div>
      <div class="reg-cli">${rec.numero?`<span class="reg-num">#${escHtml(String(rec.numero))}</span> `:''}${escHtml(rec.cliente||'')}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
        <div class="pdots">${dots}</div>
        <span class="reg-meta">${escHtml(area||'—')}${rec.adv?` · ${escHtml(rec.adv)}`:''}</span>
      </div>
    </div>
    <div style="font-size:11px;color:var(--t3)">${escHtml(rec.data||'—')}</div>
    <div>${regStageBadge(etapa)}</div>
    <div>${signed?'<span class="bx bgr">✍ Assinado</span>':'<span class="bx bm">Pendente</span>'}</div>
    <div>${docsPend.length>0?`<span class="bx bro">📎 ${docsPend.length}</span>`:'<span style="font-size:10px;color:var(--t3)">docs ok</span>'}</div>
    <div>${regDurBadge(rec)}</div>
    <button class="reg-btn" id="btn-${escAttr(rec.uid)}">▼ Editar</button>
  </div>
  <div class="reg-panel" id="panel-${escAttr(rec.uid)}">
    <div class="panel-body">
    <div class="etapa-bar">${pipeHTML}</div>
    <div class="reg-grid4">${baseFieldsHTML}</div>
    <div class="dg">${dateHTML}</div>
    <div class="dur-strip show" id="dur-strip-${escAttr(rec.uid)}">
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--blue);margin-bottom:6px">Durações calculadas</div>  
      <div class="dur-grid" id="dur-${escAttr(rec.uid)}">${durItems.length?regDurGridHTML(durItems):'<div class="dur-item"><div class="dur-lbl">Aguardando datas</div><div class="dur-val" style="color:var(--t3)">--</div></div>'}</div>
    </div>
    <div style="margin-top:10px">
      <div class="ifield">
        <label>📎 Documentos Pendentes — clique para marcar</label>
        <div class="docs-sel">${chipsHTML}</div>
        <div class="docs-cnt" id="docs-cnt-${escAttr(rec.uid)}">${docsPend.length} pendente${docsPend.length!==1?'s':''}</div>
      </div>
    </div>
    <div class="csec show" id="csec-${escAttr(rec.uid)}">
      <div class="csec-title">Dados do Contrato — Dashboard de Métricas</div>
      <div class="csec-grid">${contractFieldsHTML}</div>
    </div>
    <div style="margin-top:10px">
      <div class="ifield">
        <label>Observações</label>
        <textarea class="reg-card-obs" data-uid="${escAttr(rec.uid)}" placeholder="Observações...">${escHtml(rec.obs||'')}</textarea>
      </div>
    </div>
    </div>
    <div class="pfooter">
      <span class="pstatus" id="pstatus-${escAttr(rec.uid)}">Editando — não salvo</span>
      <div class="pacts">
        <button class="btn sm danger" data-reg-delete="${escAttr(rec.uid)}">Excluir</button>
        <button class="btn sm primary" data-reg-save="${escAttr(rec.uid)}">Salvar</button>
      </div>
    </div>
  </div>
</div>`;
}

function renderReg(){
  const el=document.getElementById('reg-list');if(!el)return;
  const infoEl=document.getElementById('reg-pag-info');
  const btnsEl=document.getElementById('reg-pag-btns');
  const list=getRegView();
  const total=list.length;
  const pages=Math.ceil(total/REG_PG)||1;
  regPg=Math.min(regPg,pages);
  const slice=list.slice((regPg-1)*REG_PG,regPg*REG_PG);

  document.getElementById('reg-count').textContent=`— ${list.length} registro${list.length!==1?'s':''}`;
  if(!list.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--t3);">Nenhum registro encontrado.</div>';
    if(infoEl) infoEl.textContent='0 registros';
    if(btnsEl) btnsEl.innerHTML='';
    return;
  }

  el.innerHTML=slice.map(buildRegCard).join('');

  if(infoEl) infoEl.textContent=`${total} registro${total!==1?'s':''} · Página ${regPg} de ${pages}`;
  if(btnsEl){
    if(pages<=1){btnsEl.innerHTML='';}
    else{
      let h=`<button class="pb2" data-reg-page="${regPg-1}" ${regPg===1?'disabled':''}>&lsaquo;</button>`;
      for(let i=1;i<=pages;i++){
        if(i===1||i===pages||Math.abs(i-regPg)<=2)h+=`<button class="pb2 ${i===regPg?'on':''}" data-reg-page="${i}">${i}</button>`;
        else if(Math.abs(i-regPg)===3)h+=`<span style="color:var(--t3);padding:0 3px">...</span>`;
      }
      h+=`<button class="pb2" data-reg-page="${regPg+1}" ${regPg===pages?'disabled':''}>&rsaquo;</button>`;
      btnsEl.innerHTML=h;
    }
  }
}

function goRegPg(p){
  regPg=p;
  renderReg();
}

function toggleRegCard(uid){
  const card=document.getElementById(`regcard-${uid}`);
  const panel=document.getElementById(`panel-${uid}`);
  const btn=document.getElementById(`btn-${uid}`);
  if(!card||!panel||!btn)return;
  const isOpen=panel.classList.contains('open');
  panel.classList.toggle('open',!isOpen);
  btn.classList.toggle('open',!isOpen);
  btn.textContent=isOpen?'\u25bc Editar':'\u25b2 Fechar';
  card.classList.toggle('expanded',!isOpen);
  // pausa autosync quando painel esta aberto
  if(isOpen) finishEditing(); else isEditing=true;
}

function setRegEtapa(uid,etapa){
  const idx=DB.findIndex(r=>r.uid===uid);if(idx<0)return;
  DB[idx]={...DB[idx],etapa:etapa||null};
  const card=document.getElementById(`regcard-${uid}`);
  if(!card) return;
  card.querySelectorAll(`[data-set-etapa="${uid}"]`).forEach((btn)=>{
    btn.classList.toggle('on',!!etapa&&Number(btn.dataset.etapa)===Number(etapa));
  });
  const filled=etapa?syncRegCardStageDates(uid,Number(etapa),card):[];
  const st=card.querySelector(`#pstatus-${uid}`);
  if(st){
    if(!etapa) st.textContent='Etapa removida. Clique em Salvar para confirmar.';
    else if(filled.length) st.textContent=`${stageSyncFeedback(etapa,filled)} Clique em Salvar para confirmar.`;
    else st.textContent='Etapa atualizada. Clique em Salvar para confirmar.';
  }
}

function syncRegCardStageDates(uid,targetStage,cardEl){
  const card=cardEl||document.getElementById(`regcard-${uid}`);
  if(!card) return [];
  const filled=syncStageDatesProgressive(
    targetStage,
    field=>field.panel,
    key=>card.querySelector(`[data-date-field="${key}"][data-uid="${uid}"]`)?.value||'',
    (key,val)=>{
      const inp=card.querySelector(`[data-date-field="${key}"][data-uid="${uid}"]`);
      if(inp) inp.value=val;
    }
  );
  if(filled.length) refreshRegDurFromInputs(uid);
  return filled;
}

function refreshRegDurFromInputs(uid){
  const card=document.getElementById(`regcard-${uid}`);
  if(!card) return;
  const getDate=(k)=>{
    const inp=card.querySelector(`[data-date-field="${k}"][data-uid="${uid}"]`);
    return inp?.value?iso2dmy(inp.value):'';
  };
  const items=[
    {l:'Chegada→Assin.',d:diffDays(getDate('dtChegada'),getDate('dtAssinatura')),ref:10},
    {l:'Assin.→Docs',d:diffDays(getDate('dtAssinatura'),getDate('dtDocsRec')),ref:7},
    {l:'Docs→Entrega',d:diffDays(getDate('dtDocsRec'),getDate('dtEntrega')),ref:5},
  ].filter((x)=>x.d!=null&&x.d>=0);
  const grid=card.querySelector(`#dur-${uid}`);
  if(grid) grid.innerHTML=items.length
    ?regDurGridHTML(items)
    :'<div class="dur-item"><div class="dur-lbl">Aguardando datas</div><div class="dur-val" style="color:var(--t3)">--</div></div>';

  const hoje=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const dtChegada=getDate('dtChegada');
  const dtAssin=getDate('dtAssinatura');
  const dtFim=getDate('dtEntrega')||hoje;
  const total=diffDays(dtChegada,dtFim);
  const ateSign=diffDays(dtChegada,dtAssin);
  const totalEl=card.querySelector(`#dur-total-${uid}`);
  const signEl=card.querySelector(`#dur-sign-${uid}`);
  if(totalEl) totalEl.textContent=`Total: ${total!=null&&total>=0?`${total}d`:'--'}`;
  if(signEl) signEl.textContent=`Chegada→Assin.: ${ateSign!=null&&ateSign>=0?`${ateSign}d`:'--'}`;

  if(getDate('dtAssinatura')){
    const idx=DB.findIndex(r=>r.uid===uid);
    const etapaAtual=idx>=0?(Number(DB[idx].etapa)||1):1;
    if(etapaAtual<3) setRegEtapa(uid,3);
  }
}

function toggleRegDoc(uid,doc){
  const idx=DB.findIndex(r=>r.uid===uid);if(idx<0)return;
  const rec=DB[idx];
  let docs=Array.isArray(rec.docsPendentes)?[...rec.docsPendentes]:[];
  if(docs.includes(doc)) docs=docs.filter(d=>d!==doc);
  else docs.push(doc);
  DB[idx]={...rec,docsPendentes:docs};
  // Atualiza chip visualmente
  const card=document.getElementById(`regcard-${uid}`);
  if(card){
    card.querySelectorAll(`[data-toggle-doc="${uid}"]`).forEach(chip=>{
      chip.classList.toggle('sel',docs.includes(chip.dataset.doc));
    });
    const cntEl=card.querySelector(`#docs-cnt-${uid}`);
    if(cntEl) cntEl.textContent=`${docs.length} pendente${docs.length!==1?'s':''}`;
    const st=card.querySelector(`#pstatus-${uid}`);
    if(st) st.textContent='Documentos alterados — clique Salvar';
  }
}

async function saveReg(uid){
  const idx=DB.findIndex(r=>r.uid===uid);if(idx<0)return;
  const card=document.getElementById(`regcard-${uid}`);if(!card)return;

  // Item 6 - desabilita botao de salvar durante gravacao
  const saveBtn=card.querySelector(`[data-reg-save="${uid}"]`);
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Salvando...';}

  const patch={};
  card.querySelectorAll('[data-reg-field][data-uid]').forEach(inp=>{
    if(inp.dataset.uid===uid) patch[inp.dataset.regField]=(inp.value||'').trim();
  });
  card.querySelectorAll('[data-date-field][data-uid]').forEach(inp=>{
    if(inp.dataset.uid===uid) patch[inp.dataset.dateField]=iso2dmy(inp.value);
  });
  const obsEl=card.querySelector(`textarea[data-uid="${uid}"]`);
  if(obsEl) patch.obs=obsEl.value.trim();
  patch.docsPendentes=DB[idx].docsPendentes||[];
  if(patch.dtAssinatura && !DB[idx].data) patch.data=patch.dtAssinatura;
  patch.updatedAt=Date.now(); // Item 5 - timestamp de versao

  const updated={...DB[idx],...patch};
  const ok=await serverSave(updated);

  if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Salvar';}
  if(!ok) return; // Item 6 - nao fecha painel nem atualiza UI se falhou

  DB[idx]=updated;
  finishEditing(); // libera autosync apos salvar confirmado
  renderDash();renderReg();

  // finishEditing pode aplicar um snapshot que remove registros e muda os índices: busca pelo uid.
  const saved=DB.find(r=>r.uid===uid)||updated;
  const durItems=getRegDurItems(saved);
  const durEl=document.getElementById(`dur-${uid}`);
  if(durEl) durEl.innerHTML=regDurGridHTML(durItems);
  toast(`"${escHtml(saved.cliente||uid)}" salvo!`);
}

function exportRegHTML(){
  const list=getRegView();
  const now=new Date().toLocaleString('pt-BR');
  const rows=list.map(r=>{
    const etapa=r.etapa||1;
    const docs=(r.docsPendentes||[]).join(', ')||'—';
    return `<tr>
      <td>${escHtml(r.data||'')}</td>
      <td>${escHtml(r.cliente||'')}</td>
      <td>${escHtml(r.area||'')}</td>
      <td>${escHtml(r.acao||'')}</td>
      <td>${escHtml(r.adv||'')}</td>
      <td>${escHtml(r.status||'')}</td>
      <td style="text-align:center">${etapa}</td>
      <td>${escHtml(r.dtChegada||'')}</td>
      <td>${escHtml(r.dtAssinatura||'')}</td>
      <td>${escHtml(r.dtEntrega||'')}</td>
      <td>${escHtml(docs)}</td>
    </tr>`;
  }).join('');

  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Registros - Oliveira &amp; Benedet</title>
<style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;}
h2{margin-bottom:4px;}p{color:#666;margin-bottom:16px;}
table{width:100%;border-collapse:collapse;}
th{background:#1a1a35;color:#fff;padding:7px 8px;text-align:left;font-size:11px;}
td{padding:6px 8px;border-bottom:1px solid #ddd;}
tr:nth-child(even) td{background:#f7f7f7;}</style></head>
<body><h2>Oliveira &amp; Benedet &#8212; Registros</h2>
<p>Gerado em ${escHtml(now)} &bull; ${list.length} registros</p>
<table><thead><tr>
  <th>Data</th><th>Cliente</th><th>Área</th><th>Ação</th><th>Adv.</th>
  <th>Status</th><th>Etapa</th><th>Chegada</th><th>Assinatura</th><th>Entrega</th><th>Docs Pend.</th>
</tr></thead><tbody>${rows}</tbody></table></body></html>`;

  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`registros-ob-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Relatório exportado!');
}

/* .. BOOT .. */
const isDashboardRoute=new URLSearchParams(window.location.search).get('view')==='dashboard';
if(isDashboardRoute){
  document.getElementById('home-panel')?.classList.add('route-hidden');
  document.getElementById('app')?.classList.remove('route-hidden');
  document.title='Oliveira & Benedet — Dashboard';
  init();
}





