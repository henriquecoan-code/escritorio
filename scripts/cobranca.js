/* ============================================================
   ESTADO & PERSISTÊNCIA (Firebase — mesmo padrão de relacionamento.js)
   ============================================================ */
const COLLECTIONS={
  propria_vista:'cobranca_propria_vista',
  propria_parc:'cobranca_propria_parc',
  clientes_vista:'cobranca_clientes_vista',
  clientes_parc:'cobranca_clientes_parc',
  acordos:'cobranca_acordos',
  judicial:'cobranca_judicial'
};
const CONFIG_DOC='cobranca_config';
const DATA_KEYS=Object.keys(COLLECTIONS);
const DEF={
  config:{nome:'Oliveira & Benedet',honorarios:30,juros:1,correcao:5,
          advogados:['Sandra','Valdirlei','Liandra','Jaime','Camilla','Matheus']},
  propria_vista:[],
  propria_parc:[],
  clientes_vista:[],
  clientes_parc:[],
  acordos:[],
  judicial:[]
};
const FIREBASE_CFG=window.OB_FIREBASE_CONFIG||null;
var S=structuredClone(DEF);
var periodo='dia', curPage='dashboard', opSubCart='propria';
var charts={};

var fbDb=null, fbAuth=null, currentUser=null, firebaseReady=false;
var unsub={};
const OUTBOX_DB='ob-cobranca-outbox';
const OUTBOX_STORE='operacoes';
var pendingOperations=new Map();

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

// ══════════════════════════════════════════════════════════════
//  AUTH / SYNC UI
// ══════════════════════════════════════════════════════════════
function createFirebaseUI(){
  document.body.insertAdjacentHTML('beforeend','<div class="auth-overlay" id="authOverlay"><div class="auth-box"><h2>Acesso à Cobrança</h2><p>Entre com seu email e senha para acessar os dados.</p><input id="authEmail" type="email" placeholder="Email"><input id="authPassword" type="password" placeholder="Senha"><button class="btn btn-teal" id="authLogin">Entrar</button><button class="auth-forgot" id="authForgot" type="button">Esqueci minha senha</button><div class="auth-error" id="authError"></div></div></div><div class="sync-bar" id="syncBar"><span class="sync-dot" id="syncDot"></span><span id="syncLabel">Conectando...</span><span id="syncDetail"></span><button class="btn btn-ghost btn-sm" id="syncNow">Atualizar</button></div>');
  document.getElementById('authLogin').addEventListener('click',login);
  document.getElementById('authPassword').addEventListener('keydown',function(e){if(e.key==='Enter')login();});
  document.getElementById('authForgot').addEventListener('click',forgotPassword);
  document.getElementById('syncNow').addEventListener('click',loadFromFirebase);
  document.getElementById('authLogout').addEventListener('click',logout);
}
function setSync(state,label,detail){
  detail=detail||'';
  var dot=document.getElementById('syncDot'),text=document.getElementById('syncLabel'),info=document.getElementById('syncDetail');
  if(dot)dot.className='sync-dot '+state;
  if(text)text.textContent=label;
  if(info)info.textContent=detail;
}
function setAuth(open,error){
  var ov=document.getElementById('authOverlay');if(ov)ov.classList.toggle('open',open);
  var el=document.getElementById('authError');if(el)el.textContent=error||'';
}
function refreshAuthUI(){
  var userEl=document.getElementById('authUser'),logoutBtn=document.getElementById('authLogout');
  if(!userEl||!logoutBtn)return;
  userEl.textContent=(currentUser&&currentUser.email)||'';
  userEl.title=(currentUser&&currentUser.email)||'';
  userEl.classList.toggle('visible',!!currentUser);
  logoutBtn.classList.toggle('visible',!!currentUser);
}
async function login(){
  var email=document.getElementById('authEmail').value.trim();
  var password=document.getElementById('authPassword').value;
  if(!email||!password){setAuth(true,'Informe email e senha.');return;}
  try{await fbAuth.signInWithEmailAndPassword(email,password);}
  catch(e){setAuth(true,e.code==='auth/invalid-credential'?'Email ou senha incorretos.':'Falha no login. Tente novamente.');}
}
async function forgotPassword(){
  var email=document.getElementById('authEmail').value.trim();
  if(!email){setAuth(true,'Informe seu email para receber o link de recuperação.');return;}
  var button=document.getElementById('authForgot');
  button.disabled=true;
  try{await fbAuth.sendPasswordResetEmail(email);setAuth(true,'Enviamos um link de recuperação para seu email.');}
  catch(e){
    var message=e.code==='auth/invalid-email'?'Informe um email válido.':e.code==='auth/user-not-found'?'Não encontramos uma conta com esse email.':'Não foi possível enviar o link de recuperação.';
    setAuth(true,message);
  }finally{button.disabled=false;}
}
async function logout(){
  if(!fbAuth)return;
  try{await fbAuth.signOut();}catch(e){toast('Não foi possível sair da conta','err');}
}

// ══════════════════════════════════════════════════════════════
//  OUTBOX (fila offline em IndexedDB) — mesmo padrão de relacionamento.js
// ══════════════════════════════════════════════════════════════
function openOutbox(){
  return new Promise(function(resolve,reject){
    var request=indexedDB.open(OUTBOX_DB,1);
    request.onupgradeneeded=function(){request.result.createObjectStore(OUTBOX_STORE,{keyPath:'id'});};
    request.onsuccess=function(){resolve(request.result);};
    request.onerror=function(){reject(request.error);};
  });
}
function operationId(collection,documentId){return currentUser.uid+':'+collection+':'+documentId;}
async function queueOperations(operations){
  if(!operations.length)return;
  var database=await openOutbox();
  await new Promise(function(resolve,reject){
    var transaction=database.transaction(OUTBOX_STORE,'readwrite');
    operations.forEach(function(operation){pendingOperations.set(operation.id,operation);transaction.objectStore(OUTBOX_STORE).put(operation);});
    transaction.oncomplete=resolve;transaction.onerror=function(){reject(transaction.error);};transaction.onabort=function(){reject(transaction.error);};
  });
  database.close();
}
async function removeQueuedOperations(operations){
  if(!operations.length)return;
  var database=await openOutbox();
  await new Promise(function(resolve,reject){
    var transaction=database.transaction(OUTBOX_STORE,'readwrite');
    operations.forEach(function(operation){pendingOperations.delete(operation.id);transaction.objectStore(OUTBOX_STORE).delete(operation.id);});
    transaction.oncomplete=resolve;transaction.onerror=function(){reject(transaction.error);};transaction.onabort=function(){reject(transaction.error);};
  });
  database.close();
}
async function loadQueuedOperations(){
  if(!currentUser)return;
  var database=await openOutbox();
  var operations=await new Promise(function(resolve,reject){
    var request=database.transaction(OUTBOX_STORE,'readonly').objectStore(OUTBOX_STORE).getAll();
    request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};
  });
  database.close();
  pendingOperations=new Map(operations.filter(function(o){return o.userId===currentUser.uid;}).map(function(o){return [o.id,o];}));
}
function applyQueuedOperations(){
  pendingOperations.forEach(function(operation){
    if(operation.collection==='meta'&&operation.documentId===CONFIG_DOC){
      if(operation.type==='set')S.config=Object.assign({},structuredClone(DEF.config),operation.data);
      return;
    }
    var key=null;
    for(var k in COLLECTIONS){if(COLLECTIONS[k]===operation.collection){key=k;break;}}
    if(!key)return;
    var records=S[key];
    var index=records.findIndex(function(r){return r.id===operation.documentId;});
    if(operation.type==='delete'){if(index>=0)records.splice(index,1);return;}
    if(index>=0)records[index]=operation.data;else records.unshift(operation.data);
  });
}
function updatePendingSync(){if(pendingOperations.size)setSync('pending','Alterações pendentes',pendingOperations.size+' alteração(ões) aguardando o Firebase');}
async function sendOperations(operations){
  if(!firebaseReady||!currentUser)throw new Error('Firebase indisponível');
  for(var start=0;start<operations.length;start+=450){
    var batch=fbDb.batch();
    operations.slice(start,start+450).forEach(function(operation){
      var reference=fbDb.collection(operation.collection).doc(operation.documentId);
      if(operation.type==='delete')batch.delete(reference);else batch.set(reference,operation.data);
    });
    await batch.commit();
  }
}
async function persistOperations(operations){
  await queueOperations(operations);
  try{await sendOperations(operations);await removeQueuedOperations(operations);return true;}
  catch(error){console.error(error);updatePendingSync();toast('Alteração salva neste dispositivo e pendente de sincronização');return false;}
}
async function retryQueuedOperations(){
  var operations=Array.from(pendingOperations.values());
  if(!operations.length)return true;
  try{await sendOperations(operations);await removeQueuedOperations(operations);setSync('ok','Tempo real',syncSummary());toast('Alterações pendentes sincronizadas','ok');return true;}
  catch(error){console.error(error);setSync('error','Sincronização pendente',syncErrorDetail(error));return false;}
}
function setOperations(collection,documents){return documents.map(function(d){return {id:operationId(collection,d.id),userId:currentUser.uid,collection:collection,documentId:d.id,type:'set',data:d};});}
function deleteOperations(collection,ids){return ids.map(function(id){return {id:operationId(collection,id),userId:currentUser.uid,collection:collection,documentId:id,type:'delete'};});}

function persistDocuments(key,documents){
  if(!currentUser||!documents.length)return Promise.resolve(false);
  return persistOperations(setOperations(COLLECTIONS[key],documents));
}
function deleteDocuments(key,ids){
  if(!currentUser||!ids.length)return Promise.resolve(false);
  return persistOperations(deleteOperations(COLLECTIONS[key],ids));
}
function persistConfig(){
  if(!currentUser)return Promise.resolve(false);
  return persistOperations(setOperations('meta',[Object.assign({id:CONFIG_DOC},S.config)]));
}
function syncSummary(){
  var total=DATA_KEYS.reduce(function(a,k){return a+S[k].length;},0);
  return total+' registro(s) sincronizados';
}
function syncErrorDetail(error){
  if(error&&error.code==='resource-exhausted')return 'Limite diário do Firebase atingido. Aguarde a renovação da cota.';
  if(error&&error.code==='permission-denied')return 'Seu acesso não permite carregar estes dados.';
  return 'Não foi possível sincronizar. Verifique sua conexão e tente novamente.';
}

async function loadFromFirebase(){
  if(!currentUser)return;
  setSync('loading','Carregando Firebase...');
  try{
    var promises=DATA_KEYS.map(function(k){return fbDb.collection(COLLECTIONS[k]).get();});
    promises.push(fbDb.collection('meta').doc(CONFIG_DOC).get());
    var results=await Promise.all(promises);
    var configSnap=results[results.length-1];
    var hasRemote=configSnap.exists;
    DATA_KEYS.forEach(function(k,i){if(!results[i].empty)hasRemote=true;});
    if(hasRemote){
      DATA_KEYS.forEach(function(k,i){S[k]=results[i].docs.map(function(d){return d.data();});});
      S.config=Object.assign({},structuredClone(DEF.config),(configSnap.exists?configSnap.data():{}));
    }
    applyQueuedOperations();
    firebaseReady=true;renderAll();setSync('ok','Tempo real',syncSummary());
    await retryQueuedOperations();
  }catch(e){console.error(e);setSync('error','Erro no Firebase',syncErrorDetail(e));toast(syncErrorDetail(e),'err');}
}

async function startRealtime(){
  Object.keys(unsub).forEach(function(k){if(unsub[k])unsub[k]();});
  unsub={};
  try{await loadQueuedOperations();}catch(error){console.error(error);toast('Não foi possível preparar o armazenamento local','err');}
  setSync('loading','Conectando ao Firebase...');
  function handleRealtimeError(error){console.error(error);setSync('error','Sincronização indisponível',syncErrorDetail(error));toast(syncErrorDetail(error),'err');}
  DATA_KEYS.forEach(function(k){
    unsub[k]=fbDb.collection(COLLECTIONS[k]).onSnapshot(function(snap){
      S[k]=snap.docs.map(function(d){return d.data();});
      applyQueuedOperations();renderAll();updatePendingSync();
      if(!pendingOperations.size)setSync('ok','Tempo real',syncSummary());
    },handleRealtimeError);
  });
  unsub.config=fbDb.collection('meta').doc(CONFIG_DOC).onSnapshot(function(snap){
    if(snap.exists)S.config=Object.assign({},structuredClone(DEF.config),snap.data());
    applyQueuedOperations();renderAll();updatePendingSync();
  },handleRealtimeError);
  await retryQueuedOperations();
}

function initFirebase(){
  if(!FIREBASE_CFG||typeof firebase==='undefined'){setSync('error','Firebase não configurado','Verifique firebase-config.public.js');setAuth(true,'Firebase não configurado.');return;}
  try{
    var app=firebase.apps.length?firebase.app():firebase.initializeApp(FIREBASE_CFG);
    fbDb=firebase.firestore(app);fbAuth=firebase.auth(app);
    fbAuth.onAuthStateChanged(function(user){
      currentUser=user||null;
      refreshAuthUI();
      if(currentUser){firebaseReady=true;setAuth(false);startRealtime();}
      else{firebaseReady=false;Object.keys(unsub).forEach(function(k){if(unsub[k])unsub[k]();});unsub={};setAuth(true);setSync('error','Login necessário','Entre para carregar os dados');}
    });
  }catch(e){console.error(e);setSync('error','Erro ao iniciar Firebase');setAuth(true,'Não foi possível iniciar o Firebase.');}
}

function renderAll(){renderCurrentPage();}

// ══════════════════════════════════════════════════════════════
//  FORMAT / CALC UTILS
// ══════════════════════════════════════════════════════════════
var MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function R(v){return 'R$\u00a0'+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function pct(v){return Number(v||0).toFixed(1)+'%';}
function fD(s){if(!s)return '—';try{var p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0];}catch(e){return s;}}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function today(){return new Date().toISOString().split('T')[0];}

// Calcula valor atualizado: juros compostos mensais + correção anual proporcional
function calcAtual(valor, dataRef, jurosMes, correcaoAno){
  if(!dataRef||!valor) return Number(valor||0);
  var d0=new Date(dataRef+'T00:00:00'), d1=new Date();
  if(d1<=d0) return Number(valor);
  var meses=(d1.getFullYear()-d0.getFullYear())*12+(d1.getMonth()-d0.getMonth());
  if(meses<0) meses=0;
  var j=Number(jurosMes||1)/100;
  var cm=Number(correcaoAno||5)/100/12;
  var fator=Math.pow(1+j+cm, meses);
  return Number(valor)*fator;
}

// Gera parcelas baseado no total e nº de parcelas, com juros
function gerarParcelas(total, nParc, dataInicio, jurosMes){
  var parcelas=[];
  var j=Number(jurosMes||1)/100;
  var fator=nParc>1?(j*Math.pow(1+j,nParc))/(Math.pow(1+j,nParc)-1):1;
  var valParc=total*(nParc>1?fator:1);
  for(var i=0;i<nParc;i++){
    var d=new Date(dataInicio+'T00:00:00');
    d.setMonth(d.getMonth()+i);
    var ds=d.toISOString().split('T')[0];
    parcelas.push({num:i+1,venc:ds,valor:valParc,pago:0,sit:'Pendente'});
  }
  return parcelas;
}

function totalPago(parcelas){return (parcelas||[]).reduce(function(a,p){return a+Number(p.pago||0);},0);}
function totalParc(parcelas){return (parcelas||[]).reduce(function(a,p){return a+Number(p.valor||0);},0);}
function proxParc(parcelas){
  var hoje=today();
  var pend=(parcelas||[]).filter(function(p){return p.sit!=='Pago'&&p.venc>=hoje;});
  return pend.length?pend[0]:null;
}
function diasAtraso(dataRef,sit){
  if(!dataRef||sit==='Recebido'||sit==='Cumprido'||sit==='Pago') return null;
  var d=new Date(dataRef+'T00:00:00'),h=new Date();h.setHours(0,0,0,0);
  var diff=Math.floor((h-d)/864e5);
  return diff>0?diff:null;
}
function atrH(dias){
  if(dias===null||dias===undefined) return '<span class="dim">—</span>';
  if(dias<=0) return '<span class="atr-badge" style="background:var(--green-d);color:var(--green)">Hoje</span>';
  if(dias<=7) return '<span class="atr-badge" style="background:var(--amber-d);color:var(--amber)">'+dias+'d</span>';
  if(dias<=30) return '<span class="atr-badge" style="background:var(--red-d);color:var(--red)">'+dias+'d</span>';
  return '<span class="atr-badge" style="background:rgba(248,81,73,0.25);color:#ff9090">'+dias+'d</span>';
}
function pillSit(s){
  var m={Recebido:'green','Em aberto':'amber','Em dia':'green','Em atraso':'red',Renegociado:'amber',Cumprido:'green',Quebrado:'red',Inadimplente:'red',Judicial:'purple',Pendente:'amber',Pago:'green',Ativo:'blue',Suspenso:'amber',Arquivado:'dim'};
  var c=m[s]||'amber';
  if(c==='dim') return '<span class="tag" style="background:var(--ink4);color:var(--tx3)">'+esc(s)+'</span>';
  return '<span class="tag tag-'+c+'">'+esc(s)+'</span>';
}
var EROW=function(c){return '<tr><td colspan="'+c+'"><div class="empty"><div class="empty-ic">📂</div><div class="empty-t">Nenhum registro lançado</div><div class="empty-s">Clique em "+ Lançar" para começar</div></div></td></tr>';};

// ══════════════════════════════════════════════════════════════
//  NAVIGATE / PERIOD
// ══════════════════════════════════════════════════════════════
function nav(page, btn){
  curPage=page;
  document.querySelectorAll('.nb').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  if(btn) btn.classList.add('active');
  document.getElementById('pg-'+page).classList.add('active');
  var T={dashboard:['Dashboard','Visão geral consolidada'],propria:['Carteira Própria','Lançamentos e controle — à vista e parcelado'],clientes:['Clientes Externos','Cobranças com honorários — à vista e parcelado'],operadora:['Painel da Operadora','Acompanhamento de acordos por devedor'],acordos:['Acordos — Lojas','Renegociações comerciais'],judicial:['Títulos Judiciais','Processos ativos com controle de entradas'],config:['Configurações','Parâmetros do sistema']};
  var t=T[page]||['',''];
  document.getElementById('pg-title').textContent=t[0];
  document.getElementById('pg-sub').textContent=t[1];
  var showPtabs=page==='dashboard'?'flex':'none';
  var ptabs=document.getElementById('ptabs'); if(ptabs) ptabs.style.display=showPtabs;
  var pcw=document.getElementById('per-custom-wrap'); if(pcw) pcw.style.display=showPtabs;
  var bn=document.getElementById('btn-new');
  bn.style.display=(page==='propria'||page==='clientes')?'flex':'none';
  bn.dataset.page=page;
  renderCurrentPage();
}
function renderCurrentPage(){
  if(curPage==='dashboard') renderDash();
  if(curPage==='propria'){renderTbl('propria','vista');renderTbl('propria','parcelado');}
  if(curPage==='clientes'){renderTbl('clientes','vista');renderTbl('clientes','parcelado');}
  if(curPage==='operadora') renderOperadora();
  if(curPage==='acordos'){renderKpiAcordos();renderAcordos();renderChartAcordos();}
  if(curPage==='judicial'){renderKpiJudicial();renderJudicial();renderChartJudicial();}
  if(curPage==='config') renderConfig();
}
function setPer(p,btn){
  periodo=p;
  document.querySelectorAll('.ptab').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  var elIni=document.getElementById('per-ini'), elFim=document.getElementById('per-fim');
  if(elIni) elIni.value='';
  if(elFim) elFim.value='';
  renderDash();
}
function setCustomPer(){
  var elIni=document.getElementById('per-ini'), elFim=document.getElementById('per-fim');
  var ini=elIni?elIni.value:'', fim=elFim?elFim.value:'';
  if(ini || fim){
    periodo='custom';
    document.querySelectorAll('.ptab').forEach(function(b){b.classList.remove('active');});
  }
  renderDash();
}
function setSub(cart,sub,btn){
  document.querySelectorAll('#pg-'+cart+' .stab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  document.getElementById('sub-'+cart+'-vista').style.display=sub==='vista'?'block':'none';
  document.getElementById('sub-'+cart+'-parcelado').style.display=sub==='parcelado'?'block':'none';
}
function setOpSub(cart,btn){
  opSubCart=cart;
  document.querySelectorAll('#pg-operadora .stab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderOperadora();
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
function byPer(list){
  var now=new Date(),y=now.getFullYear(),m=now.getMonth(),day=now.getDate();
  return list.filter(function(r){
    // criado_em = data real do cadastro no sistema (sempre hoje)
    // lancamento = data de vencimento/origem informada pelo usuário (pode ser passada)
    var lkDia=r.criado_em||r.lancamento||r.data_pgto;
    var lk=r.lancamento||r.data_pgto;
    if(!lkDia) return periodo==='ano';
    if(periodo==='dia'){
      var dd=new Date(lkDia+'T00:00:00');
      return dd.getFullYear()===y&&dd.getMonth()===m&&dd.getDate()===day;
    }
    var d=new Date((lk||lkDia)+'T00:00:00');
    if(periodo==='semana') return (now-d)/864e5<=7;
    if(periodo==='mes') return d.getFullYear()===y&&d.getMonth()===m;
    if(periodo==='ano') return d.getFullYear()===y;
    if(periodo==='custom'){
      var ini=document.getElementById('per-ini')?document.getElementById('per-ini').value:'';
      var fim=document.getElementById('per-fim')?document.getElementById('per-fim').value:'';
      var ds=(lk||lkDia)?(lk||lkDia).slice(0,10):'';
      if(!ds) return true;
      if(ini && ds < ini) return false;
      if(fim && ds > fim) return false;
      return true;
    }
    return true;
  });
}
function renderDash(){
  var j=S.config.juros,cm=S.config.correcao,hon=S.config.honorarios/100;
  var pv=byPer(S.propria_vista), pp=byPer(S.propria_parc);
  var cv=byPer(S.clientes_vista), cp=byPer(S.clientes_parc);

  // Carteira propria
  var pvCob=pv.reduce(function(a,r){return a+Number(r.valor||0);},0);
  var pvRec=pv.reduce(function(a,r){return a+Number(r.recebido||0);},0);
  var pvAtual=pv.reduce(function(a,r){return a+(r.situacao!=='Recebido'?calcAtual(r.valor,r.lancamento,j,cm):Number(r.valor));},0);
  var ppTotal=pp.reduce(function(a,r){return a+totalParc(r.parcelas);},0);
  var ppRec=pp.reduce(function(a,r){return a+totalPago(r.parcelas);},0);
  var pTot=pvCob+ppTotal, pRecTot=pvRec+ppRec;
  var pTx=pTot>0?(pRecTot/pTot)*100:0;

  document.getElementById('kpi-p').innerHTML=
    kpiHTML('Total cobrado',R(pTot),'à vista + parcelado','teal','teal')+
    kpiHTML('Recebido',R(pRecTot),pTx.toFixed(1)+'% recuperado','green','green',pTx)+
    kpiHTML('Atualizado c/ juros',R(pvAtual+ppTotal),'saldo corrigido','amber','amber')+
    kpiHTML('Em aberto',R(pTot-pRecTot),'pendente','red','red');

  // Clientes externos
  var cvCob=cv.reduce(function(a,r){return a+Number(r.valor||0);},0);
  var cvRec=cv.reduce(function(a,r){return a+Number(r.recebido||0);},0);
  var cpTotal=cp.reduce(function(a,r){return a+totalParc(r.parcelas);},0);
  var cpRec=cp.reduce(function(a,r){return a+totalPago(r.parcelas);},0);
  var cRecTot=cvRec+cpRec;
  var honPct_cv=cv.reduce(function(a,r){return a+(Number(r.recebido||0)*(Number(r.honorarios||S.config.honorarios)/100));},0);
  var honPct_cp=cp.reduce(function(a,r){return a+(totalPago(r.parcelas)*(Number(r.honorarios||S.config.honorarios)/100));},0);
  var cHonTot=honPct_cv+honPct_cp;
  var cTot=cvCob+cpTotal, cTx=cTot>0?(cRecTot/cTot)*100:0;

  document.getElementById('kpi-c').innerHTML=
    kpiHTML('Bruto cobrado',R(cTot),'à vista + parcelado','rose','rose')+
    kpiHTML('Bruto recebido',R(cRecTot),cTx.toFixed(1)+'% recuperado','green','green',cTx)+
    kpiHTML('Honorários O&B',R(cHonTot),'receita do escritório','purple','purple')+
    kpiHTML('Em aberto',R(cTot-cRecTot),'pendente','amber','amber');

  var fat=pRecTot+cHonTot;
  var pPct=fat>0?((pRecTot/fat)*100).toFixed(1):0;
  var hPct=fat>0?((cHonTot/fat)*100).toFixed(1):0;
  document.getElementById('fat-strip').innerHTML=
    '<div class="fat-card hero"><div class="fc-label">Faturamento total O&B</div><div class="fc-val">'+R(fat)+'</div><div class="fc-sub">carteira própria + honorários</div></div>'+
    '<div class="fat-card"><div class="fc-label">Receita — carteira própria</div><div class="fc-val">'+R(pRecTot)+'</div><div class="fc-sub">'+pPct+'% do faturamento</div><div class="fc-bar"><div class="fc-fill" style="width:'+pPct+'%;background:var(--teal)"></div></div></div>'+
    '<div class="fat-card"><div class="fc-label">Receita — honorários '+S.config.honorarios+'%</div><div class="fc-val">'+R(cHonTot)+'</div><div class="fc-sub">'+hPct+'% do faturamento</div><div class="fc-bar"><div class="fc-fill" style="width:'+hPct+'%;background:var(--rose)"></div></div></div>';

  renderChartDash();
}

function kpiHTML(label,val,sub,accent,tag,prog){
  var p=prog!==undefined?'<div class="pbar"><div class="pbar-fill" style="width:'+Math.min(100,prog).toFixed(0)+'%;background:var(--'+accent+')"></div></div>':'';
  return '<div class="kpi"><div class="kpi-accent" style="background:var(--'+accent+')"></div><div class="kpi-label">'+label+'</div><div class="kpi-val">'+val+'</div><div class="kpi-sub">'+sub+'</div>'+p+'</div>';
}

// ══════════════════════════════════════════════════════════════
//  CHARTS
// ══════════════════════════════════════════════════════════════
function getMonths(){var now=new Date(),ms=[];for(var i=6;i>=0;i--){var d=new Date(now.getFullYear(),now.getMonth()-i,1);ms.push({y:d.getFullYear(),m:d.getMonth(),label:MESES[d.getMonth()]});}return ms;}
function mSum(list,field,months){return months.map(function(o){return list.filter(function(r){var lk=r.lancamento||r.data_pgto;if(!lk)return false;var d=new Date(lk);return d.getFullYear()===o.y&&d.getMonth()===o.m;}).reduce(function(a,r){return a+Number(r[field]||0);},0);});}
function baseOpt(){return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1a2235',titleColor:'#9a9590',bodyColor:'#f0ede8',borderColor:'rgba(255,255,255,0.08)',borderWidth:1,callbacks:{label:function(ctx){return 'R$'+ctx.parsed.y.toLocaleString('pt-BR',{minimumFractionDigits:2});}}}},scales:{x:{grid:{display:false},ticks:{color:'#5e5b57',font:{size:10}},border:{color:'rgba(255,255,255,0.05)'}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5e5b57',font:{size:10},callback:function(v){return v>=1000?'R$'+(v/1000).toFixed(0)+'k':'R$'+v;}},border:{display:false}}}};}
function mkChart(id,type,data,opts){if(charts[id])charts[id].destroy();charts[id]=new Chart(document.getElementById(id),{type:type,data:data,options:opts||baseOpt()});}

function renderChartDash(){
  var months=getMonths(),labels=months.map(function(x){return x.label;});
  mkChart('chartDashP','bar',{labels:labels,datasets:[
    {label:'Vista cobrado',data:mSum(S.propria_vista,'valor',months),backgroundColor:'rgba(201,168,76,0.6)',borderRadius:3},
    {label:'Vista recebido',data:mSum(S.propria_vista,'recebido',months),backgroundColor:'rgba(63,185,80,0.8)',borderRadius:3},
    {label:'Parcelado pago',data:months.map(function(o){return S.propria_parc.filter(function(r){var lk=r.lancamento;if(!lk)return false;var d=new Date(lk);return d.getFullYear()===o.y&&d.getMonth()===o.m;}).reduce(function(a,r){return a+totalPago(r.parcelas);},0);}),backgroundColor:'rgba(88,166,255,0.7)',borderRadius:3}
  ]});
  var honMes=months.map(function(o){
    var cv=S.clientes_vista.filter(function(r){var d=new Date(r.lancamento||r.data_pgto||'2000-01-01');return d.getFullYear()===o.y&&d.getMonth()===o.m;}).reduce(function(a,r){return a+Number(r.recebido||0)*(Number(r.honorarios||S.config.honorarios)/100);},0);
    var cp=S.clientes_parc.filter(function(r){var d=new Date(r.lancamento||'2000-01-01');return d.getFullYear()===o.y&&d.getMonth()===o.m;}).reduce(function(a,r){return a+totalPago(r.parcelas)*(Number(r.honorarios||S.config.honorarios)/100);},0);
    return cv+cp;
  });
  mkChart('chartDashH','bar',{labels:labels,datasets:[{label:'Honorários',data:honMes,backgroundColor:'rgba(251,113,133,0.7)',borderRadius:3}]});
}

// ══════════════════════════════════════════════════════════════
//  TABLES
// ══════════════════════════════════════════════════════════════
function renderTbl(cart,tipo){
  var key=cart+'_'+(tipo==='vista'?'vista':'parc');
  var list=S[key];
  var busca=(document.getElementById('f-'+cart.charAt(0)+tipo.charAt(0)+'-b')||{}).value||'';
  var filtered=list.filter(function(r){return !busca||(r.devedor||'').toLowerCase().indexOf(busca.toLowerCase())>=0||(r.credor||'').toLowerCase().indexOf(busca.toLowerCase())>=0;});
  var cnt=document.getElementById('cnt-'+cart.charAt(0)+tipo.charAt(0));
  if(cnt)cnt.textContent=filtered.length+' registro'+(filtered.length!==1?'s':'');
  var hon=S.config.honorarios/100, j=S.config.juros, cm=S.config.correcao;
  var isCliente=cart==='clientes';
  if(tipo==='vista'){
    var cols=isCliente?12:10;
    var tb=document.getElementById('tb-'+cart.charAt(0)+'v');
    if(!filtered.length){tb.innerHTML=EROW(cols);return;}
    tb.innerHTML=filtered.map(function(r){
      var id=r.id;
      var atu=r.situacao!=='Recebido'?calcAtual(r.valor,r.lancamento,j,cm):Number(r.valor);
      var dias=diasAtraso(r.data_pgto,r.situacao);
      var honVal=Number(r.recebido||0)*(Number(r.honorarios||S.config.honorarios)/100);
      var honPct=Number(r.honorarios||S.config.honorarios);
      var base='<td><b>'+esc(r.devedor)+'</b></td>'+(isCliente?'<td class="dim">'+esc(r.credor||'—')+'</td>':'')+'<td>'+R(r.valor)+'</td><td class="pos">'+(Number(r.recebido||0)>0?R(r.recebido):'<span class="dim">—</span>')+'</td><td style="color:var(--amber)">'+R(atu)+'</td><td class="dim">'+fD(r.data_pgto)+'</td><td>'+atrH(dias)+'</td>'+(isCliente?'<td class="pos">'+R(honVal)+'</td><td class="dim">'+honPct+'%</td>':'<td style="display:none"></td>')+'<td class="dim">'+esc(r.responsavel||'—')+'</td><td>'+pillSit(r.situacao)+'</td>';
      if(!isCliente) base=base.replace('<td style="display:none"></td>','');
      return '<tr>'+base+'<td><button class="row-ab" onclick="editRec(\''+key+'\',\''+id+'\')">Editar</button><button class="row-ab del" onclick="delRec(\''+key+'\',\''+id+'\')">Excluir</button></td></tr>';
    }).join('');
  } else {
    var cols=isCliente?14:12;
    var tb=document.getElementById('tb-'+cart.charAt(0)+'p');
    if(!filtered.length){tb.innerHTML=EROW(cols);return;}
    tb.innerHTML=filtered.map(function(r){
      var id=r.id;
      var totP=totalParc(r.parcelas), totRec=totalPago(r.parcelas);
      var aRec=totP-totRec;
      var prox=proxParc(r.parcelas);
      var proxVenc=prox?prox.venc:null;
      var dias=proxVenc&&r.situacao!=='Recebido'?diasAtraso(proxVenc,'Em aberto'):null;
      var honPct=Number(r.honorarios||S.config.honorarios)/100;
      var honVal=totRec*honPct;
      var npago=(r.parcelas||[]).filter(function(p){return p.sit==='Pago';}).length;
      var nTot=(r.parcelas||[]).length;
      var base='<td><b>'+esc(r.devedor)+'</b></td>'+(isCliente?'<td class="dim">'+esc(r.credor||'—')+'</td>':'')+'<td>'+R(r.valor)+'</td><td style="color:var(--amber)">'+R(totP)+'</td><td class="dim">'+npago+'/'+nTot+'x</td><td class="pos">'+R(totRec)+'</td><td class="warn">'+R(aRec)+'</td><td class="dim">'+(proxVenc?fD(proxVenc):'—')+'</td><td>'+atrH(dias)+'</td>'+(isCliente?'<td class="dim">'+(Number(r.honorarios||S.config.honorarios))+'%</td><td class="pos">'+R(honVal)+'</td>':'')+'<td class="dim">'+esc(r.responsavel||'—')+'</td><td>'+pillSit(r.situacao)+'</td>';
      return '<tr>'+base+'<td><button class="row-ab" onclick="editRec(\''+key+'\',\''+id+'\')">Editar</button><button class="row-ab" onclick="verParcelas(\''+key+'\',\''+id+'\')">Parcelas</button><button class="row-ab del" onclick="delRec(\''+key+'\',\''+id+'\')">Excluir</button></td></tr>';
    }).join('');
  }
}

// ══════════════════════════════════════════════════════════════
//  PAINEL DA OPERADORA
// ══════════════════════════════════════════════════════════════
function renderOperadora(){
  var busca=(document.getElementById('op-search')||{}).value||'';
  var tipoF=(document.getElementById('op-tipo')||{}).value||'';
  var sitF=(document.getElementById('op-sit')||{}).value||'';
  var j=S.config.juros, cm=S.config.correcao;
  var listVista=S[opSubCart+'_vista'].map(function(r){return Object.assign({},r,{_tipo:'vista'});});
  var listParc=S[opSubCart+'_parc'].map(function(r){return Object.assign({},r,{_tipo:'parcelado'});});
  var all=listVista.concat(listParc);
  if(busca) all=all.filter(function(r){return (r.devedor||'').toLowerCase().indexOf(busca.toLowerCase())>=0;});
  if(tipoF) all=all.filter(function(r){return r._tipo===tipoF;});
  if(sitF) all=all.filter(function(r){return (r.situacao||'').indexOf(sitF)>=0;});
  var grid=document.getElementById('op-grid');
  if(!all.length){grid.innerHTML='<div style="grid-column:1/-1"><div class="empty"><div class="empty-ic">🔍</div><div class="empty-t">Nenhum acordo encontrado</div><div class="empty-s">Ajuste os filtros ou adicione lançamentos</div></div></div>';return;}
  grid.innerHTML=all.map(function(r){
    var hon=Number(r.honorarios||S.config.honorarios)/100;
    var isParc=r._tipo==='parcelado';
    var totP=isParc?totalParc(r.parcelas):Number(r.valor||0);
    var totRec=isParc?totalPago(r.parcelas):Number(r.recebido||0);
    var aRec=totP-totRec;
    var atu=!isParc&&r.situacao!=='Recebido'?calcAtual(r.valor,r.lancamento,j,cm):totP;
    var honVal=totRec*hon;
    var prox=isParc?proxParc(r.parcelas):null;
    var dias=isParc?(prox?diasAtraso(prox.venc,'Em aberto'):null):diasAtraso(r.data_pgto,r.situacao);
    var progPct=totP>0?(totRec/totP)*100:0;
    var nPago=isParc?(r.parcelas||[]).filter(function(p){return p.sit==='Pago';}).length:0;
    var nTot=isParc?(r.parcelas||[]).length:0;
    var acHead='<div class="ac-head"><div><div class="ac-devedor">'+esc(r.devedor)+'</div>'+(r.credor?'<div class="ac-credor">Credor: '+esc(r.credor)+'</div>':'')+'</div><div style="text-align:right">'+pillSit(r.situacao)+'<div style="font-size:9px;color:var(--tx3);margin-top:3px">'+esc(r._tipo==='vista'?'À vista':'Parcelado')+'</div></div></div>';
    var acBody='<div class="ac-body">';
    acBody+='<div class="ac-row"><span class="ac-key">Valor total</span><span class="ac-val">'+R(totP)+'</span></div>';
    if(!isParc) acBody+='<div class="ac-row"><span class="ac-key">Atualizado c/ juros</span><span class="ac-val" style="color:var(--amber)">'+R(atu)+'</span></div>';
    acBody+='<div class="ac-row"><span class="ac-key">Recebido</span><span class="ac-val" style="color:var(--teal)">'+R(totRec)+'</span></div>';
    acBody+='<div class="ac-row"><span class="ac-key">A receber</span><span class="ac-val" style="color:var(--amber)">'+R(aRec)+'</span></div>';
    if(opSubCart==='clientes') acBody+='<div class="ac-row"><span class="ac-key">Honorários O&B ('+Math.round(hon*100)+'%)</span><span class="ac-val" style="color:var(--purple)">'+R(honVal)+'</span></div>';
    if(dias) acBody+='<div class="ac-row"><span class="ac-key">Atraso</span><span class="ac-val">'+atrH(dias)+'</span></div>';
    if(isParc){
      acBody+='<div class="parc-progress"><div class="parc-label"><span>Parcelas pagas</span><span>'+nPago+'/'+nTot+'</span></div><div class="parc-track"><div class="parc-fill" style="width:'+progPct.toFixed(0)+'%"></div></div></div>';
      var parcList=(r.parcelas||[]).slice(0,4).map(function(p){
        var dAtras=diasAtraso(p.venc,p.sit);
        return '<div class="parc-item"><span class="pi-num">'+p.num+'ª</span><span class="pi-venc">'+fD(p.venc)+'</span><span class="pi-val">'+R(p.valor)+'</span><span class="pi-sit">'+pillSit(p.sit)+'</span>'+(dAtras?atrH(dAtras):'')+'</div>';
      }).join('');
      if(parcList) acBody+='<div class="parc-list">'+parcList+'</div>';
      if((r.parcelas||[]).length>4) acBody+='<div style="font-size:10px;color:var(--tx3);margin-top:4px;text-align:center">+ '+(r.parcelas.length-4)+' parcelas — clique em Parcelas para ver todas</div>';
      acBody+='<div class="ac-row"><button class="row-ab" style="margin-top:4px" onclick="verParcelas(\''+opSubCart+'_parc\',\''+r.id+'\')">Ver parcelas</button></div>';
    }
    acBody+='</div>';
    return '<div class="ac-card">'+acHead+acBody+'</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  ACORDOS / JUDICIAL
// ══════════════════════════════════════════════════════════════
function renderKpiAcordos(){
  var list=S.acordos;
  var tot=list.reduce(function(a,r){return a+Number(r.valor_acordado||0);},0);
  var rec=list.reduce(function(a,r){return a+Number(r.recebido||0);},0);
  var atr=list.filter(function(r){return r.situacao==='Em atraso'||r.situacao==='Quebrado';}).length;
  var ati=list.filter(function(r){return r.situacao!=='Cumprido'&&r.situacao!=='Arquivado';}).length;
  document.getElementById('kpi-ac').innerHTML=kpiHTML('Total acordado',R(tot),'em renegociações','amber','amber')+kpiHTML('Total recebido',R(rec),(tot>0?((rec/tot)*100).toFixed(1):0)+'% recuperado','green','green',tot>0?(rec/tot)*100:0)+kpiHTML('Acordos ativos',ati,'em andamento','blue','blue')+kpiHTML('Em atraso/Quebrado',atr,'atenção requerida','red','red');
}
function renderAcordos(){
  var bl=(document.getElementById('f-ac-b')||{}).value||'';
  var sl=(document.getElementById('f-ac-s')||{}).value||'';
  var list=S.acordos.slice();
  if(bl)list=list.filter(function(r){return (r.devedor||'').toLowerCase().indexOf(bl.toLowerCase())>=0;});
  if(sl)list=list.filter(function(r){return r.situacao===sl;});
  document.getElementById('cnt-ac').textContent=list.length+' registro'+(list.length!==1?'s':'');
  var tb=document.getElementById('tb-ac');
  if(!list.length){tb.innerHTML=EROW(12);return;}
  tb.innerHTML=list.map(function(r){
    var id=r.id;
    var dias=diasAtraso(r.prox_venc,r.situacao);
    return '<tr><td><b>'+esc(r.devedor)+'</b></td><td class="dim" style="font-size:11px">'+esc(r.documento||'—')+'</td><td class="dim">'+R(r.valor_original)+'</td><td style="color:var(--amber)">'+R(r.valor_acordado)+'</td><td>'+pillSit(r.tipo_pgto==='parcelado'?'Parcelado':'À vista')+'</td><td class="dim">'+esc(r.parcelas||'—')+'</td><td class="pos">'+R(r.recebido)+'</td><td class="dim">'+fD(r.prox_venc)+'</td><td>'+atrH(dias)+'</td><td>'+pillSit(r.situacao)+'</td><td class="dim">'+esc(r.responsavel||'—')+'</td><td><button class="row-ab" onclick="editRec(\'acordos\',\''+id+'\')">Editar</button><button class="row-ab del" onclick="delRec(\'acordos\',\''+id+'\')">Excluir</button></td></tr>';
  }).join('');
}
function renderChartAcordos(){
  var months=getMonths(),labels=months.map(function(x){return x.label;});
  var cel=months.map(function(o){return S.acordos.filter(function(r){if(!r.lancamento)return false;var d=new Date(r.lancamento);return d.getFullYear()===o.y&&d.getMonth()===o.m;}).length;});
  var cum=months.map(function(o){return S.acordos.filter(function(r){if(!r.lancamento||r.situacao!=='Cumprido')return false;var d=new Date(r.lancamento);return d.getFullYear()===o.y&&d.getMonth()===o.m;}).length;});
  var cntO=JSON.parse(JSON.stringify(baseOpt()));
  cntO.scales.y.ticks.callback=function(v){return v;};
  mkChart('chartAc','bar',{labels:labels,datasets:[{label:'Celebrados',data:cel,backgroundColor:'rgba(245,158,11,0.6)',borderRadius:3},{label:'Cumpridos',data:cum,backgroundColor:'rgba(63,185,80,0.8)',borderRadius:3}]},cntO);
  mkChart('chartAcV','bar',{labels:labels,datasets:[{label:'Acordado',data:mSum(S.acordos,'valor_acordado',months),backgroundColor:'rgba(245,158,11,0.6)',borderRadius:3},{label:'Recebido',data:mSum(S.acordos,'recebido',months),backgroundColor:'rgba(63,185,80,0.8)',borderRadius:3}]});
}
function renderKpiJudicial(){
  var list=S.judicial;
  var tc=list.reduce(function(a,r){return a+Number(r.valor||0);},0);
  var tr=list.reduce(function(a,r){return a+Number(r.recebido||0);},0);
  var at=list.filter(function(r){return r.situacao!=='Arquivado';}).length;
  var ex=list.filter(function(r){return r.fase==='Execução';}).length;
  document.getElementById('kpi-j').innerHTML=kpiHTML('Carteira judicial',R(tc),'total em processos','purple','purple')+kpiHTML('Total recebido',R(tr),(tc>0?((tr/tc)*100).toFixed(1):0)+'% recuperado','green','green',tc>0?(tr/tc)*100:0)+kpiHTML('Processos ativos',at,'em andamento','blue','blue')+kpiHTML('Em execução',ex,'fase avançada','rose','rose');
}
function renderJudicial(){
  var bl=(document.getElementById('f-jud-b')||{}).value||'';
  var ff=(document.getElementById('f-jud-f')||{}).value||'';
  var list=S.judicial.slice();
  if(bl)list=list.filter(function(r){return (r.devedor||'').toLowerCase().indexOf(bl.toLowerCase())>=0||(r.numero||'').indexOf(bl)>=0;});
  if(ff)list=list.filter(function(r){return r.fase===ff;});
  document.getElementById('cnt-j').textContent=list.length+' registro'+(list.length!==1?'s':'');
  var tb=document.getElementById('tb-j');
  if(!list.length){tb.innerHTML=EROW(10);return;}
  tb.innerHTML=list.map(function(r){
    var id=r.id,pgts=r.pagamentos||[],ult=pgts.length?pgts[pgts.length-1]:null;
    return '<tr><td style="color:var(--purple);font-size:11px;font-weight:600">'+esc(r.numero||'—')+'</td><td><b>'+esc(r.devedor)+'</b></td><td>'+R(r.valor)+'</td><td class="pos">'+R(r.recebido)+'</td><td>'+pillSit(r.fase||'—')+'</td><td class="dim">'+fD(r.prox_mov)+'</td><td>'+(ult?'<span style="color:var(--teal)">'+R(ult.valor)+'</span> <span class="dim">'+fD(ult.data)+'</span>':'<span class="dim">—</span>')+'<button class="row-ab" style="margin-left:6px;font-size:10px" onclick="addPgtoJud(\''+id+'\')">+Pgto</button></td><td class="dim">'+esc(r.responsavel||'—')+'</td><td>'+pillSit(r.situacao||'—')+'</td><td><button class="row-ab" onclick="editRec(\'judicial\',\''+id+'\')">Editar</button><button class="row-ab del" onclick="delRec(\'judicial\',\''+id+'\')">Excluir</button></td></tr>';
  }).join('');
}
function renderChartJudicial(){
  var months=getMonths(),labels=months.map(function(x){return x.label;});
  var recMes=months.map(function(o){var t=0;S.judicial.forEach(function(r){(r.pagamentos||[]).forEach(function(p){if(!p.data)return;var d=new Date(p.data);if(d.getFullYear()===o.y&&d.getMonth()===o.m)t+=Number(p.valor||0);});});return t;});
  mkChart('chartJud','bar',{labels:labels,datasets:[{label:'Recebido',data:recMes,backgroundColor:'rgba(188,140,255,0.7)',borderRadius:3}]});
  var fases=['Citação','Instrução','Sentença','Recurso','Execução','Acordo','Arquivado'];
  var fc=fases.map(function(f){return S.judicial.filter(function(r){return r.fase===f;}).length;});
  mkChart('chartJudF','doughnut',{labels:fases,datasets:[{data:fc,backgroundColor:['rgba(88,166,255,0.8)','rgba(63,185,80,0.8)','rgba(245,158,11,0.8)','rgba(192,122,42,0.8)','rgba(251,113,133,0.8)','rgba(188,140,255,0.8)','rgba(94,94,94,0.5)'],borderColor:'rgba(0,0,0,0.3)',borderWidth:1}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'right',labels:{color:'#9a9590',font:{size:10},boxWidth:8}}}});
}
async function addPgtoJud(id){
  var valor=prompt('Valor recebido (R$):');if(!valor||isNaN(parseFloat(valor)))return;
  var data=prompt('Data (AAAA-MM-DD):')||today();
  var r=S.judicial.find(function(x){return x.id===id;});
  if(!r)return;
  if(!r.pagamentos)r.pagamentos=[];
  r.pagamentos.push({valor:parseFloat(valor),data:data});
  r.recebido=(Number(r.recebido)||0)+parseFloat(valor);
  renderJudicial();renderKpiJudicial();toast('Pagamento registrado: '+R(parseFloat(valor)),'ok');
  await persistDocuments('judicial',[r]);
}

// ══════════════════════════════════════════════════════════════
//  VER PARCELAS (modal extra)
// ══════════════════════════════════════════════════════════════
function verParcelas(key,id){
  var r=S[key].find(function(x){return x.id===id;});
  if(!r)return;
  var html='<div class="modal-title">Parcelas — '+esc(r.devedor)+'</div><div style="overflow-y:auto;max-height:400px"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Situação</th><th>Ações</th></tr></thead><tbody>';
  (r.parcelas||[]).forEach(function(p,pi){
    html+='<tr><td class="dim">'+p.num+'ª</td><td class="dim">'+fD(p.venc)+'</td><td>'+R(p.valor)+'</td><td class="pos">'+(p.pago>0?R(p.pago):'<span class="dim">—</span>')+'</td><td>'+pillSit(p.sit)+'</td><td><button class="row-ab" onclick="marcarPago(\''+key+'\',\''+id+'\','+pi+')">Marcar pago</button></td></tr>';
  });
  html+='</tbody></table></div><div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button></div>';
  document.getElementById('m-body').innerHTML='';
  document.getElementById('m-title').innerHTML='';
  document.querySelector('.modal').innerHTML=html;
  document.getElementById('mbg').classList.add('open');
}
async function marcarPago(key,id,pi){
  var r=S[key].find(function(x){return x.id===id;});
  if(!r)return;
  var p=r.parcelas[pi];
  var val=prompt('Valor pago (R$):',p.valor.toFixed(2));
  if(!val) return;
  p.pago=parseFloat(val)||p.valor;
  p.sit='Pago';
  var todoPago=r.parcelas.every(function(x){return x.sit==='Pago';});
  if(todoPago) r.situacao='Recebido';
  closeModal();
  renderTbl(key.split('_')[0],key.split('_')[1]);
  renderOperadora();
  toast('Parcela marcada como paga!','ok');
  await persistDocuments(key,[r]);
}

// ══════════════════════════════════════════════════════════════
//  MODAL FORMS
// ══════════════════════════════════════════════════════════════
var ADV=function(){
  var advs = (S && S.config && Array.isArray(S.config.advogados)) ? S.config.advogados : (DEF && DEF.config && Array.isArray(DEF.config.advogados) ? DEF.config.advogados : []);
  return advs.map(function(a){return '<option value="'+esc(a)+'">'+esc(a)+'</option>';}).join('');
};
var SEL=function(opts,val){return opts.map(function(o){return '<option value="'+esc(o)+'"'+(val===o?' selected':'')+'>'+esc(o)+'</option>';}).join('');};

function buildForm(tipo,r){
  r=r||{};
  var isCliente=tipo==='clientes_vista'||tipo==='clientes_parc';
  var isParc=tipo==='propria_parc'||tipo==='clientes_parc';
  var cfg=(S&&S.config)?S.config:(DEF&&DEF.config?DEF.config:{});
  var j=cfg.juros!==undefined?cfg.juros:1;
  var cm=cfg.correcao!==undefined?cfg.correcao:5;
  var hon=cfg.honorarios!==undefined?cfg.honorarios:30;
  var vParcVal = (r && r.parcelas && r.parcelas.length > 0 && r.parcelas[0].valor) ? Number(r.parcelas[0].valor).toFixed(2) : '';
  var html='';

  // tipo pagamento toggle (apenas para abertura, não edição de carteira)
  if(!r._editing){
    html+='<div style="grid-column:1/-1;margin-bottom:4px"><div class="modal-sec">Modalidade de pagamento</div></div>';
    html+='<div class="tipo-tabs"><button class="ttab '+(isParc?'':'active')+'" onclick="switchTipoModal(false,\''+tipo+'\')">À Vista</button><button class="ttab '+(isParc?'active':'')+'" onclick="switchTipoModal(true,\''+tipo+'\')">Parcelado</button></div>';
  }

  html+='<div class="modal-sec">Dados do devedor</div>';
  html+='<div class="ff full"><label>Devedor *</label><input id="f-devedor" value="'+esc(r.devedor||'')+'"></div>';
  if(isCliente) html+='<div class="ff full"><label>Cliente credor</label><input id="f-credor" value="'+esc(r.credor||'')+'"></div>';

  html+='<div class="modal-sec">Valores</div>';
  html+='<div class="ff"><label>Valor original (R$) *</label><input id="f-valor" type="number" value="'+(r.valor||'')+'" min="0" step="0.01" oninput="syncParcelamento(\'valor\')"></div>';

  if(!isParc){
    html+='<div class="ff"><label>Valor recebido (R$)</label><input id="f-recebido" type="number" value="'+(r.recebido||'')+'" min="0" step="0.01" oninput="recalcModal()"></div>';
    html+='<div class="ff"><label>Data do pagamento</label><input id="f-data-pgto" type="date" value="'+(r.data_pgto||'')+'"></div>';
    html+='<div class="ff"><label>Data do lançamento / vencimento orig.</label><input id="f-lanc" type="date" value="'+(r.lancamento||today())+'" oninput="recalcModal()"></div>';
    html+='<div class="ff"><label>Juros mensais (%)</label><input id="f-juros" type="number" value="'+(r.juros_custom||j)+'" min="0" step="0.1" oninput="recalcModal()"></div>';
    html+='<div class="ff"><label>Correção monetária anual (%)</label><input id="f-cm" type="number" value="'+(r.cm_custom||cm)+'" min="0" step="0.1" oninput="recalcModal()"></div>';
  } else {
    html+='<div class="ff"><label>Nº de parcelas</label><input id="f-nparc" type="number" value="'+(r._nparc||3)+'" min="1" max="120" oninput="syncParcelamento(\'nparc\')"></div>';
    html+='<div class="ff"><label>Ou: valor de cada parcela (R$)</label><input id="f-vparc" type="number" value="'+vParcVal+'" min="0" step="0.01" placeholder="Deixe em branco para calcular" oninput="syncParcelamento(\'vparc\')"></div>';
    html+='<div class="ff"><label>1ª parcela em</label><input id="f-data1" type="date" value="'+(r._data1||today())+'" oninput="recalcModal()"></div>';
    html+='<div class="ff"><label>Juros mensais (%)</label><input id="f-juros" type="number" value="'+(r.juros_custom||j)+'" min="0" step="0.1" oninput="syncParcelamento(\'juros\')"></div>';
    html+='<div class="ff"><label>Correção monetária anual (%)</label><input id="f-cm" type="number" value="'+(r.cm_custom||cm)+'" min="0" step="0.1" oninput="syncParcelamento(\'cm\')"></div>';
  }

  if(isCliente){
    html+='<div class="ff"><label>Honorários (%)</label><input id="f-honorarios" type="number" value="'+(r.honorarios||hon)+'" min="0" max="100" step="0.1" oninput="recalcModal()"></div>';
  }

  html+='<div class="calc-box" id="calc-preview"><div class="calc-box-title">Prévia do cálculo</div><div id="calc-rows"><div style="font-size:11px;color:var(--tx3)">Preencha os valores acima para ver a prévia</div></div></div>';

  html+='<div class="modal-sec">Controle</div>';
  html+='<div class="ff"><label>Responsável</label><select id="f-responsavel">'+ADV()+'</select></div>';
  html+='<div class="ff"><label>Situação</label><select id="f-situacao">'+SEL(['Em aberto','Em dia','Em atraso','Negociação','Recebido','Inadimplente','Judicial'],r.situacao||'Em aberto')+'</select></div>';
  html+='<div class="ff full"><label>Observações</label><textarea id="f-obs">'+esc(r.obs||'')+'</textarea></div>';
  return html;
}

function openModal(toOverride){
  try {
    var btnNew=document.getElementById('btn-new');
    var page=toOverride||(btnNew&&btnNew.dataset?btnNew.dataset.page:'')||'propria';
    var tipo=page==='clientes'?'clientes_vista':'propria_vista';
    if(toOverride==='acordos') tipo='acordos';
    if(toOverride==='judicial') tipo='judicial';
    var mTipo=document.getElementById('m-tipo'); if(mTipo) mTipo.value=tipo;
    var mId=document.getElementById('m-id'); if(mId) mId.value='';
    var lbls={propria_vista:'Carteira Própria — À Vista',propria_parc:'Carteira Própria — Parcelado',clientes_vista:'Clientes Externos — À Vista',clientes_parc:'Clientes Externos — Parcelado',acordos:'Acordo de Loja',judicial:'Título Judicial'};
    var mTitle=document.getElementById('m-title'); if(mTitle) mTitle.textContent='Novo Lançamento — '+(lbls[tipo]||'');
    var mBody=document.getElementById('m-body');
    if(mBody){
      if(tipo==='acordos') mBody.innerHTML=buildFormAcordos();
      else if(tipo==='judicial') mBody.innerHTML=buildFormJudicial();
      else mBody.innerHTML=buildForm(tipo);
    }
    var mbg=document.getElementById('mbg'); if(mbg) mbg.classList.add('open');
    try { syncParcelamento('init'); } catch(e0) { console.error('Erro syncParcelamento:', e0); }
    setTimeout(function(){var f=document.getElementById('f-devedor');if(f&&typeof f.focus==='function')f.focus();},60);
  } catch(err) {
    console.error('Erro em openModal:', err);
    var mbgErr=document.getElementById('mbg'); if(mbgErr) mbgErr.classList.add('open');
  }
}

function switchTipoModal(isParc,tipoBase){
  try {
    var cart=tipoBase.indexOf('clientes')===0?'clientes':'propria';
    var novoTipo=cart+'_'+(isParc?'parc':'vista');
    var mTipo=document.getElementById('m-tipo'); if(mTipo) mTipo.value=novoTipo;
    var lbls={propria_vista:'Carteira Própria — À Vista',propria_parc:'Carteira Própria — Parcelado',clientes_vista:'Clientes Externos — À Vista',clientes_parc:'Clientes Externos — Parcelado'};
    var mTitle=document.getElementById('m-title'); if(mTitle) mTitle.textContent='Novo Lançamento — '+(lbls[novoTipo]||'');
    var dv=document.getElementById('f-devedor')&&document.getElementById('f-devedor').value||'';
    var cr=document.getElementById('f-credor')&&document.getElementById('f-credor').value||'';
    var mBody=document.getElementById('m-body'); if(mBody) mBody.innerHTML=buildForm(novoTipo,{devedor:dv,credor:cr});
    if(dv&&document.getElementById('f-devedor')) document.getElementById('f-devedor').value=dv;
    if(cr&&document.getElementById('f-credor')) document.getElementById('f-credor').value=cr;
    try { syncParcelamento('init'); } catch(e0) { console.error('Erro syncParcelamento:', e0); }
  } catch(err) {
    console.error('Erro em switchTipoModal:', err);
  }
}

function syncParcelamento(src){
  var elValor = document.getElementById('f-valor');
  var elNparc = document.getElementById('f-nparc');
  var elVparc = document.getElementById('f-vparc');
  var elJuros = document.getElementById('f-juros');

  if(elValor && elNparc && elVparc){
    var valor = parseFloat(elValor.value || 0);
    var nParc = parseInt(elNparc.value || 3) || 3;
    var j = parseFloat((elJuros || {}).value || (typeof S !== 'undefined' && S && S.config ? S.config.juros : 1));
    if(isNaN(j)) j = 0;
    var jm = j / 100;

    if(src === 'vparc'){
      var vParc = parseFloat(elVparc.value || 0);
      if(vParc > 0 && valor > 0){
        var n = 1;
        if(jm > 0){
          if(vParc > valor * jm){
            n = Math.round(Math.log(vParc / (vParc - valor * jm)) / Math.log(1 + jm));
          } else {
            n = Math.round(valor / vParc);
          }
        } else {
          n = Math.round(valor / vParc);
        }
        if(isNaN(n) || n < 1) n = 1;
        if(n > 120) n = 120;
        elNparc.value = n;
      }
    } else if(src === 'init'){
      if(!elVparc.value && valor > 0 && nParc > 0){
        var fatorInit = (nParc > 1 && jm > 0) ? (jm * Math.pow(1 + jm, nParc)) / (Math.pow(1 + jm, nParc) - 1) : (1 / nParc);
        var valCalcInit = (nParc > 1 && jm > 0) ? (valor * fatorInit) : (valor / nParc);
        elVparc.value = valCalcInit.toFixed(2);
      }
    } else {
      if(valor > 0 && nParc > 0){
        var fator = (nParc > 1 && jm > 0) ? (jm * Math.pow(1 + jm, nParc)) / (Math.pow(1 + jm, nParc) - 1) : (1 / nParc);
        var valCalc = (nParc > 1 && jm > 0) ? (valor * fator) : (valor / nParc);
        elVparc.value = valCalc.toFixed(2);
      } else if(!valor) {
        elVparc.value = '';
      }
    }
  }
  recalcModal();
}

function recalcModal(){
  var preview=document.getElementById('calc-rows');
  if(!preview)return;
  var tipoEl=document.getElementById('m-tipo');
  var tipo=tipoEl?tipoEl.value:'propria_vista';
  var cfg=(S&&S.config)?S.config:(DEF&&DEF.config?DEF.config:{});
  var valor=parseFloat((document.getElementById('f-valor')||{}).value||0);
  var j=parseFloat((document.getElementById('f-juros')||{}).value||cfg.juros||1);
  var cm=parseFloat((document.getElementById('f-cm')||{}).value||cfg.correcao||5);
  var hon=parseFloat((document.getElementById('f-honorarios')||{}).value||cfg.honorarios||30)/100;
  var isParc=tipo.slice(-4)==='parc';
  var isCliente=tipo.indexOf('clientes')===0;
  var rows='';
  if(!valor){preview.innerHTML='<div style="font-size:11px;color:var(--tx3)">Informe o valor para ver a prévia</div>';return;}
  if(!isParc){
    var lanc=(document.getElementById('f-lanc')||{}).value||today();
    var atu=calcAtual(valor,lanc,j,cm);
    var rec=parseFloat((document.getElementById('f-recebido')||{}).value||0);
    rows+='<div class="calc-row"><span class="calc-key">Valor original</span><span class="calc-val">'+R(valor)+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Atualizado (juros '+j+'%/m + CM '+cm+'%/a)</span><span class="calc-val" style="color:var(--amber)">'+R(atu)+'</span></div>';
    if(isCliente&&rec>0) rows+='<div class="calc-row"><span class="calc-key">Honorários O&B ('+Math.round(hon*100)+'%)</span><span class="calc-val" style="color:var(--purple)">'+R(rec*hon)+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Acréscimo</span><span class="calc-val" style="color:var(--amber)">+'+R(atu-valor)+'</span></div>';
  } else {
    var nParc=parseInt((document.getElementById('f-nparc')||{}).value||3)||3;
    var vParc=parseFloat((document.getElementById('f-vparc')||{}).value||0);
    var data1=(document.getElementById('f-data1')||{}).value||today();
    var jm=j/100;
    var fator=nParc>1?(jm*Math.pow(1+jm,nParc))/(Math.pow(1+jm,nParc)-1):1;
    var valCalc=vParc>0?vParc:(valor*(nParc>1?fator:1));
    var total=valCalc*nParc;
    rows+='<div class="calc-row"><span class="calc-key">Valor original</span><span class="calc-val">'+R(valor)+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Parcelas</span><span class="calc-val">'+nParc+'x de '+R(valCalc)+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Total parcelado</span><span class="calc-val" style="color:var(--amber)">'+R(total)+'</span></div>';
    if(isCliente) rows+='<div class="calc-row"><span class="calc-key">Honorários sobre total ('+Math.round(hon*100)+'%)</span><span class="calc-val" style="color:var(--purple)">'+R(total*hon)+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Acréscimo de juros</span><span class="calc-val" style="color:var(--amber)">+'+R(total-valor)+'</span></div>';
  }
  preview.innerHTML=rows;
}

function buildFormAcordos(r){
  r=r||{};
  return '<div class="modal-sec">Loja / Devedor</div><div class="ff full"><label>Nome *</label><input id="f-devedor" value="'+esc(r.devedor||'')+'"></div><div class="ff"><label>CNPJ/CPF</label><input id="f-documento" value="'+esc(r.documento||'')+'"></div><div class="modal-sec">Valores do Acordo</div><div class="ff"><label>Valor original (R$)</label><input id="f-valor-orig" type="number" value="'+(r.valor_original||'')+'" min="0" step="0.01"></div><div class="ff"><label>Valor acordado (R$) *</label><input id="f-valor" type="number" value="'+(r.valor_acordado||'')+'" min="0" step="0.01"></div><div class="ff"><label>Recebido até hoje (R$)</label><input id="f-recebido" type="number" value="'+(r.recebido||'')+'" min="0" step="0.01"></div><div class="ff"><label>Tipo</label><select id="f-tipo-pgto"><option value="vista"'+(r.tipo_pgto==='vista'?' selected':'')+'>&Agrave; vista</option><option value="parcelado"'+(r.tipo_pgto==='parcelado'?' selected':'')+'>Parcelado</option></select></div><div class="ff"><label>Parcelas (ex: 3x R$500)</label><input id="f-parcelas" value="'+esc(r.parcelas||'')+'"></div><div class="ff"><label>Próx. vencimento</label><input id="f-prox-venc" type="date" value="'+(r.prox_venc||'')+'"></div><div class="modal-sec">Controle</div><div class="ff"><label>Responsável</label><select id="f-responsavel">'+ADV()+'</select></div><div class="ff"><label>Situação</label><select id="f-situacao">'+SEL(['Em dia','Em atraso','Renegociado','Cumprido','Quebrado'],r.situacao||'Em dia')+'</select></div><div class="ff full"><label>Observações</label><textarea id="f-obs">'+esc(r.obs||'')+'</textarea></div>';
}
function buildFormJudicial(r){
  r=r||{};
  return '<div class="modal-sec">Processo</div><div class="ff full"><label>Nº do Processo *</label><input id="f-numero" value="'+esc(r.numero||'')+'"></div><div class="ff full"><label>Devedor *</label><input id="f-devedor" value="'+esc(r.devedor||'')+'"></div><div class="modal-sec">Valores</div><div class="ff"><label>Valor da causa (R$)</label><input id="f-valor" type="number" value="'+(r.valor||'')+'" min="0" step="0.01"></div><div class="ff"><label>Total recebido (R$)</label><input id="f-recebido" type="number" value="'+(r.recebido||'')+'" min="0" step="0.01"></div><div class="modal-sec">Controle</div><div class="ff"><label>Fase atual</label><select id="f-fase">'+SEL(['Citação','Instrução','Sentença','Recurso','Execução','Acordo','Arquivado'],r.fase||'Citação')+'</select></div><div class="ff"><label>Próx. movimentação</label><input id="f-prox-mov" type="date" value="'+(r.prox_mov||'')+'"></div><div class="ff"><label>Responsável</label><select id="f-responsavel">'+ADV()+'</select></div><div class="ff"><label>Situação</label><select id="f-situacao">'+SEL(['Ativo','Acordo','Suspenso','Arquivado'],r.situacao||'Ativo')+'</select></div><div class="ff full"><label>Observações</label><textarea id="f-obs">'+esc(r.obs||'')+'</textarea></div>';
}

function editRec(key,id){
  var found=S[key].find(function(x){return x.id===id;});
  if(!found)return;
  var r=Object.assign({},found,{_editing:true});
  document.getElementById('m-tipo').value=key;
  document.getElementById('m-id').value=id;
  var lbls={propria_vista:'Carteira Própria — À Vista',propria_parc:'Carteira Própria — Parcelado',clientes_vista:'Clientes Externos — À Vista',clientes_parc:'Clientes Externos — Parcelado',acordos:'Acordo de Loja',judicial:'Título Judicial'};
  document.getElementById('m-title').textContent='Editar — '+(lbls[key]||'');
  if(key==='acordos') document.getElementById('m-body').innerHTML=buildFormAcordos(r);
  else if(key==='judicial') document.getElementById('m-body').innerHTML=buildFormJudicial(r);
  else document.getElementById('m-body').innerHTML=buildForm(key,r);
  syncParcelamento('init');
  setTimeout(function(){var s=document.getElementById('f-responsavel');if(s&&r.responsavel)s.value=r.responsavel;},15);
  document.getElementById('mbg').classList.add('open');
}

function closeModal(){document.getElementById('mbg').classList.remove('open');}

function gv(id){var e=document.getElementById(id);return e?e.value:'';}
function gf(id){var e=document.getElementById(id);return e?parseFloat(e.value)||0:0;}

async function salvar(){
  var tipo=gv('m-tipo'), id=gv('m-id');
  var list=S[tipo], ex=id?list.find(function(r){return r.id===id;}):null;
  var rec={};
  if(tipo==='acordos'){
    if(!gv('f-devedor').trim()){toast('Informe a loja/devedor.','err');return;}
    rec={devedor:gv('f-devedor').trim(),documento:gv('f-documento').trim(),valor_original:gf('f-valor-orig'),valor_acordado:gf('f-valor'),recebido:gf('f-recebido'),tipo_pgto:gv('f-tipo-pgto'),parcelas:gv('f-parcelas').trim(),prox_venc:gv('f-prox-venc'),responsavel:gv('f-responsavel'),situacao:gv('f-situacao'),obs:gv('f-obs').trim(),lancamento:ex?ex.lancamento:today(),criado_em:ex?ex.criado_em:today()};
  } else if(tipo==='judicial'){
    if(!gv('f-devedor').trim()){toast('Informe o devedor.','err');return;}
    rec={numero:gv('f-numero').trim(),devedor:gv('f-devedor').trim(),valor:gf('f-valor'),recebido:gf('f-recebido'),fase:gv('f-fase'),prox_mov:gv('f-prox-mov'),responsavel:gv('f-responsavel'),situacao:gv('f-situacao'),obs:gv('f-obs').trim(),lancamento:ex?ex.lancamento:today(),criado_em:ex?ex.criado_em:today(),pagamentos:ex?ex.pagamentos:[]};
  } else if(tipo.slice(-5)==='vista'){
    if(!gv('f-devedor').trim()||!gf('f-valor')){toast('Informe devedor e valor.','err');return;}
    rec={devedor:gv('f-devedor').trim(),credor:gv('f-credor').trim(),valor:gf('f-valor'),recebido:gf('f-recebido'),data_pgto:gv('f-data-pgto'),lancamento:gv('f-lanc')||today(),criado_em:ex?ex.criado_em:today(),juros_custom:gf('f-juros'),cm_custom:gf('f-cm'),honorarios:gf('f-honorarios')||S.config.honorarios,responsavel:gv('f-responsavel'),situacao:gv('f-situacao'),obs:gv('f-obs').trim()};
  } else {
    if(!gv('f-devedor').trim()||!gf('f-valor')){toast('Informe devedor e valor.','err');return;}
    var nParc=parseInt(gv('f-nparc'))||3;
    var vParc=gf('f-vparc');
    var data1=gv('f-data1')||today();
    var j2=gf('f-juros')||S.config.juros;
    var valor=gf('f-valor');
    var jm=j2/100;
    var fator=nParc>1?(jm*Math.pow(1+jm,nParc))/(Math.pow(1+jm,nParc)-1):1;
    var valCalc=vParc>0?vParc:(valor*(nParc>1?fator:1));
    var parcelas=ex?ex.parcelas:gerarParcelas(valor,nParc,data1,j2);
    if(!ex) parcelas.forEach(function(p){p.valor=valCalc;});
    rec={devedor:gv('f-devedor').trim(),credor:gv('f-credor').trim(),valor:valor,parcelas:parcelas,_nparc:nParc,_data1:data1,juros_custom:j2,cm_custom:gf('f-cm'),honorarios:gf('f-honorarios')||S.config.honorarios,responsavel:gv('f-responsavel'),situacao:gv('f-situacao'),obs:gv('f-obs').trim(),lancamento:ex?ex.lancamento:today(),criado_em:ex?ex.criado_em:today()};
  }
  rec.id=ex?ex.id:uid();
  if(ex){var i=list.findIndex(function(r){return r.id===rec.id;});list[i]=rec;} else list.push(rec);
  closeModal();
  toast('Lançamento salvo!','ok');
  if(tipo.indexOf('propria')===0||tipo.indexOf('clientes')===0){renderTbl(tipo.split('_')[0],tipo.split('_')[1]);renderDash();}
  if(tipo==='acordos'){renderKpiAcordos();renderAcordos();}
  if(tipo==='judicial'){renderKpiJudicial();renderJudicial();}
  await persistDocuments(tipo,[rec]);
}

async function delRec(key,id){
  if(!confirm('Excluir este lançamento?'))return;
  var idx=S[key].findIndex(function(r){return r.id===id;});
  if(idx<0)return;
  S[key].splice(idx,1);
  if(key.indexOf('propria')===0||key.indexOf('clientes')===0){renderTbl(key.split('_')[0],key.split('_')[1]);renderDash();}
  if(key==='acordos'){renderKpiAcordos();renderAcordos();}
  if(key==='judicial'){renderKpiJudicial();renderJudicial();}
  toast('Excluído.','ok');
  await deleteDocuments(key,[id]);
}

// ══════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════
function renderConfig(){
  document.getElementById('cfg-nome').value=S.config.nome||'';
  document.getElementById('cfg-hon').value=S.config.honorarios||30;
  document.getElementById('cfg-juros').value=S.config.juros||1;
  document.getElementById('cfg-cm').value=S.config.correcao||5;
  var el=document.getElementById('adv-list');
  el.innerHTML=S.config.advogados.map(function(a,i){return '<div class="cfg-row" style="padding:6px 0"><div class="cfg-lbl">'+esc(a)+'</div><button class="row-ab del" onclick="removeAdv('+i+')">Remover</button></div>';}).join('')||'<div style="font-size:11px;color:var(--tx3);padding:6px 0">Nenhum advogado cadastrado.</div>';
}
async function saveCfg(){
  S.config.nome=gv('cfg-nome').trim()||'Oliveira & Benedet';
  S.config.honorarios=Math.min(100,Math.max(0,parseFloat(document.getElementById('cfg-hon').value)||30));
  S.config.juros=Math.max(0,parseFloat(document.getElementById('cfg-juros').value)||1);
  S.config.correcao=Math.max(0,parseFloat(document.getElementById('cfg-cm').value)||5);
  renderConfig();renderDash();toast('Configurações salvas!','ok');
  await persistConfig();
}
async function addAdv(){
  var v=gv('novo-adv').trim();if(!v)return;
  if(S.config.advogados.indexOf(v)>=0){toast('Já cadastrado.','err');return;}
  S.config.advogados.push(v);document.getElementById('novo-adv').value='';
  renderConfig();toast('Adicionado.','ok');
  await persistConfig();
}
async function removeAdv(i){
  if(!confirm('Remover?'))return;
  S.config.advogados.splice(i,1);
  renderConfig();
  await persistConfig();
}
function exportData(){var b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='OB_Cob_'+today()+'.json';a.click();toast('Exportado!','ok');}
function importData(e){
  var f=e.target.files[0];if(!f)return;
  var r=new FileReader();
  r.onload=async function(ev){
    try{
      var p=JSON.parse(ev.target.result);
      DATA_KEYS.forEach(function(k){
        if(Array.isArray(p[k])){
          p[k].forEach(function(rec){if(!rec.id)rec.id=uid();});
          S[k]=p[k];
        }
      });
      if(p.config) S.config=Object.assign({},S.config,p.config);
      renderDash();renderConfig();toast('Dados importados! Sincronizando...','ok');
      var allOps=[];
      DATA_KEYS.forEach(function(k){allOps=allOps.concat(setOperations(COLLECTIONS[k],S[k]));});
      allOps=allOps.concat(setOperations('meta',[Object.assign({id:CONFIG_DOC},S.config)]));
      await persistOperations(allOps);
    }catch(err){console.error(err);toast('Arquivo inválido.','err');}
  };
  r.readAsText(f);
}
async function clearAll(){
  if(!confirm('Apagar todos os lançamentos?'))return;
  var ops=[];
  DATA_KEYS.forEach(function(k){
    var ids=S[k].map(function(r){return r.id;});
    ops=ops.concat(deleteOperations(COLLECTIONS[k],ids));
    S[k]=[];
  });
  renderDash();
  toast('Dados apagados.','ok');
  await persistOperations(ops);
}

// ══════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════
function toast(msg,type){var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type||'');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2600);}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
document.getElementById('mbg').addEventListener('click',function(e){if(e.target===this)closeModal();});
createFirebaseUI();
document.getElementById('sb-date').textContent=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
var tbd=document.getElementById('topbar-date');if(tbd)tbd.textContent=new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'long',year:'numeric'});
renderDash();
initFirebase();
