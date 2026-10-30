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
  config:{nome:'Oliveira & Benedet',honorarios:30,juros:1,correcao:5,juros_atraso:2,
          advogados:['Sandra','Valdirlei','Liandra','Jaime','Camilla','Matheus','Letícia','Larissa']},
  propria_vista:[],
  propria_parc:[],
  clientes_vista:[],
  clientes_parc:[],
  acordos:[],
  judicial:[]
};
const FIREBASE_CFG=window.OB_FIREBASE_CONFIG||null;
var S=structuredClone(DEF);
var periodo='dia', curPage='dashboard', opSubCart='propria', opMainTab='carteiras', opAcordoSub='administrativos';
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
  document.body.insertAdjacentHTML('beforeend','<div class="auth-overlay open" id="authOverlay"><div class="auth-box auth-card"><h2>Acesso à Cobrança</h2><p>Entre com seu email e senha para acessar os dados.</p><input class="auth-input" id="authEmail" type="email" placeholder="Email"><input class="auth-input" id="authPassword" type="password" placeholder="Senha"><button class="btn btn-teal auth-submit" id="authLogin">Entrar</button><button class="auth-forgot" id="authForgot" type="button">Esqueci minha senha</button><div class="auth-error" id="authError"></div></div></div><div class="sync-bar" id="syncBar"><span class="sync-dot" id="syncDot"></span><span id="syncLabel">Conectando...</span><span id="syncDetail"></span><button class="btn btn-ghost btn-sm" id="syncNow">Atualizar</button></div>');
  var authBox=document.querySelector('#authOverlay .auth-box');
  var pageLogo=document.querySelector('.sb-logo img');
  if(authBox&&pageLogo){var authLogo=document.createElement('img');authLogo.className='auth-logo';authLogo.alt='Oliveira & Benedet';authLogo.src=pageLogo.src;authBox.prepend(authLogo);}
  document.getElementById('authLogin').addEventListener('click',login);
  document.getElementById('authPassword').addEventListener('keydown',function(e){if(e.key==='Enter')login();});
  document.getElementById('authForgot').addEventListener('click',forgotPassword);
  document.getElementById('syncNow').addEventListener('click',syncNow);
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
  try{await fbAuth.signOut();}catch(e){toast('Não foi possível sair da conta','err');return;}
  if(window.OBFirestoreCache)await window.OBFirestoreCache.clearAndReload(fbDb);
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

// Reabre os listeners em vez de reler as coleções: com cache local, só o que mudou é cobrado.
function syncNow(){
  if(!currentUser)return;
  startRealtime();
}

// Cada chamada ganha um número; se outra começar durante o await, esta desiste (evita listeners duplicados).
var realtimeGen=0;
async function startRealtime(){
  var gen=++realtimeGen;
  Object.keys(unsub).forEach(function(k){if(unsub[k])unsub[k]();});
  unsub={};
  try{await loadQueuedOperations();}catch(error){console.error(error);toast('Não foi possível preparar o armazenamento local','err');}
  if(gen!==realtimeGen)return;
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
    if(window.OBFirestoreCache)window.OBFirestoreCache.enable(fbDb);
    fbAuth.onAuthStateChanged(function(user){
      currentUser=user||null;
      refreshAuthUI();
      if(currentUser){firebaseReady=true;setAuth(false);if(window.OBFirestoreCache)window.OBFirestoreCache.login(fbDb);startRealtime();}
      else{firebaseReady=false;Object.keys(unsub).forEach(function(k){if(unsub[k])unsub[k]();});unsub={};setAuth(true);setSync('error','Login necessário','Entre para carregar os dados');}
      if(window.OBAuthHint)window.OBAuthHint.update(user);
      if(window.OBFirestoreCache)window.OBFirestoreCache.watch(fbDb,user);
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
function arred(v){return Math.round(Number(v||0)*100)/100;}
// Divide um total em n parcelas em centavos; o centavo que sobra vai para as primeiras parcelas.
function dividirCentavos(total,n){
  var c=Math.round(Number(total||0)*100),b=Math.floor(c/n),resto=c-b*n,out=[];
  for(var i=0;i<n;i++)out.push((b+(i<resto?1:0))/100);
  return out;
}
// Vencimento da parcela i (0 = primeira): dias 28 a 31 viram dia 30; em fevereiro, dia 28.
function vencParcela(data1,i){
  var p=String(data1).slice(0,10).split('-').map(Number);
  var m=p[1]-1+i, y=p[0]+Math.floor(m/12);
  m=((m%12)+12)%12;
  var d=p[2]>=28?(m===1?28:30):p[2];
  return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
// Honorários do registro; usa o padrão só quando o campo não existe (0% é um valor válido).
function honDe(r){
  var h=r?r.honorarios:undefined;
  return (h===undefined||h===null||h===''||isNaN(Number(h)))?Number(S.config.honorarios):Number(h);
}
// Lê um campo numérico do formulário; vazio usa o padrão, mas "0" continua 0.
function numCampo(id,padrao){var v=String(gv(id)).trim();if(v==='')return padrao;var n=parseFloat(v);return isNaN(n)?padrao:n;}
// Aceita "1.234,56", "1234,56" e "1234.56".
function lerValorBR(v){
  var s=String(v||'').replace(/\s|R\$/g,'');
  if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');
  return s===''?NaN:Number(s);
}

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
  var valParc=arred(total*(nParc>1?fator:1));
  for(var i=0;i<nParc;i++){
    parcelas.push({num:i+1,venc:vencParcela(dataInicio,i),valor:valParc,pago:0,sit:'Pendente'});
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
  var m={Recebido:'green','Em aberto':'amber',Parcial:'amber','Em dia':'green','Em atraso':'red',Renegociado:'amber',Cumprido:'green',Quebrado:'red',Inadimplente:'red',Judicial:'purple',Pendente:'amber',Pago:'green',Ativo:'blue',Suspenso:'amber',Arquivado:'dim'};
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
  var T={dashboard:['Dashboard','Visão geral consolidada'],propria:['Carteira Própria','Lançamentos e controle — à vista e parcelado'],clientes:['Clientes Externos','Cobranças com honorários — à vista e parcelado'],operadora:['Painel da Operadora','Acompanhamento de acordos por devedor'],acordos:['Acordos Administrativos','Acordos extrajudiciais com controle de parcelas'],judicial:['Acordos Judiciais','Acordos em processos com controle de parcelas'],config:['Configurações','Parâmetros do sistema']};
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
  if(curPage==='operadora'){if(opMainTab==='acordos')renderOperadoraAcordos();else renderOperadora();}
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
  document.querySelectorAll('#op-panel-carteiras .stab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderOperadora();
}
function setOpMainTab(tab,btn){
  opMainTab=tab;
  document.querySelectorAll('#op-main-tabs .stab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  document.getElementById('op-panel-carteiras').style.display=tab==='carteiras'?'':'none';
  document.getElementById('op-panel-acordos').style.display=tab==='acordos'?'':'none';
  renderCurrentPage();
}
function setOpAcordoSub(sub,btn){
  opAcordoSub=sub;
  document.querySelectorAll('#op-panel-acordos .stab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderOperadoraAcordos();
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
  var honPct_cv=cv.reduce(function(a,r){return a+(Number(r.recebido||0)*(honDe(r)/100));},0);
  var honPct_cp=cp.reduce(function(a,r){return a+(totalPago(r.parcelas)*(honDe(r)/100));},0);
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

  document.getElementById('kpi-adm').innerHTML=kpisAcordo('acordos',byPer(S.acordos||[]));
  document.getElementById('kpi-jd').innerHTML=kpisAcordo('judicial',byPer(S.judicial||[]));

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
    var cv=S.clientes_vista.filter(function(r){var d=new Date(r.lancamento||r.data_pgto||'2000-01-01');return d.getFullYear()===o.y&&d.getMonth()===o.m;}).reduce(function(a,r){return a+Number(r.recebido||0)*(honDe(r)/100);},0);
    var cp=S.clientes_parc.filter(function(r){var d=new Date(r.lancamento||'2000-01-01');return d.getFullYear()===o.y&&d.getMonth()===o.m;}).reduce(function(a,r){return a+totalPago(r.parcelas)*(honDe(r)/100);},0);
    return cv+cp;
  });
  mkChart('chartDashH','bar',{labels:labels,datasets:[{label:'Honorários',data:honMes,backgroundColor:'rgba(251,113,133,0.7)',borderRadius:3}]});
  var adm=serieAcordo(S.acordos,months), jud=serieAcordo(S.judicial,months);
  mkChart('chartAcordosAdm','bar',{labels:labels,datasets:[{label:'Acordado',data:adm.acordado,backgroundColor:'rgba(245,158,11,0.6)',borderRadius:3},{label:'Recebido',data:adm.recebido,backgroundColor:'rgba(63,185,80,0.8)',borderRadius:3}]});
  mkChart('chartAcordosJud','bar',{labels:labels,datasets:[{label:'Acordado',data:jud.acordado,backgroundColor:'rgba(188,140,255,0.6)',borderRadius:3},{label:'Recebido',data:jud.recebido,backgroundColor:'rgba(63,185,80,0.8)',borderRadius:3}]});
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
      var honVal=Number(r.recebido||0)*(honDe(r)/100);
      var honPct=honDe(r);
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
      var aRec=acSaldo(r);
      var prox=proxParc(r.parcelas);
      var proxVenc=prox?prox.venc:null;
      var dias=proxVenc&&r.situacao!=='Recebido'?diasAtraso(proxVenc,'Em aberto'):null;
      var honPct=honDe(r)/100;
      var honVal=totRec*honPct;
      var npago=(r.parcelas||[]).filter(function(p){return p.sit==='Pago';}).length;
      var nTot=(r.parcelas||[]).length;
      var base='<td><b>'+esc(r.devedor)+'</b></td>'+(isCliente?'<td class="dim">'+esc(r.credor||'—')+'</td>':'')+'<td>'+R(r.valor)+'</td><td style="color:var(--amber)">'+R(totP)+'</td><td class="dim">'+npago+'/'+nTot+'x</td><td class="pos">'+R(totRec)+'</td><td class="warn">'+R(aRec)+'</td><td class="dim">'+(proxVenc?fD(proxVenc):'—')+'</td><td>'+atrH(dias)+'</td>'+(isCliente?'<td class="dim">'+(honDe(r))+'%</td><td class="pos">'+R(honVal)+'</td>':'')+'<td class="dim">'+esc(r.responsavel||'—')+'</td><td>'+pillSit(r.situacao)+'</td>';
      return '<tr>'+base+'<td><button class="row-ab" onclick="editRec(\''+key+'\',\''+id+'\')">Editar</button><button class="row-ab" onclick="verParcelas(\''+key+'\',\''+id+'\')">Parcelas</button><button class="row-ab del" onclick="delRec(\''+key+'\',\''+id+'\')">Excluir</button></td></tr>';
    }).join('');
  }
}

// ══════════════════════════════════════════════════════════════
//  PAINEL DA OPERADORA
// ══════════════════════════════════════════════════════════════
// Ordem dos cards: Negociação primeiro, depois os demais em aberto e os Recebidos por último.
// Dentro de cada grupo, maior atraso primeiro; nos Recebidos, o pagamento mais recente primeiro.
function grupoOp(r){return r.situacao==='Negociação'?0:r.situacao==='Recebido'?2:1;}
function atrasoOp(r){
  if(r._tipo!=='parcelado') return diasAtraso(r.data_pgto,r.situacao)||0;
  if(r.situacao==='Recebido') return 0;
  var venc=(r.parcelas||[]).filter(function(p){return p.sit!=='Pago';}).map(function(p){return p.venc||'';}).filter(Boolean).sort()[0];
  return venc?(diasAtraso(venc,'Em aberto')||0):0;
}
// Parcelas pagas antes do registro da data ficam sem data_pgto: usa a data de lançamento.
function ultimoPgtoOp(r){
  if(r._tipo!=='parcelado') return r.data_pgto||r.lancamento||'';
  var ds=(r.parcelas||[]).map(function(p){return p.data_pgto||'';}).filter(Boolean).sort();
  return ds.length?ds[ds.length-1]:(r.lancamento||'');
}
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
  all.sort(function(a,b){
    var g=grupoOp(a)-grupoOp(b);
    if(g) return g;
    if(grupoOp(a)===2) return ultimoPgtoOp(b).localeCompare(ultimoPgtoOp(a));
    return atrasoOp(b)-atrasoOp(a);
  });
  var grid=document.getElementById('op-grid');
  if(!all.length){grid.innerHTML='<div style="grid-column:1/-1"><div class="empty"><div class="empty-ic">🔍</div><div class="empty-t">Nenhum acordo encontrado</div><div class="empty-s">Ajuste os filtros ou adicione lançamentos</div></div></div>';return;}
  grid.innerHTML=all.map(function(r){
    var hon=honDe(r)/100;
    var isParc=r._tipo==='parcelado';
    var totP=isParc?totalParc(r.parcelas):Number(r.valor||0);
    var totRec=isParc?totalPago(r.parcelas):Number(r.recebido||0);
    var aRec=isParc?acSaldo(r):totP-totRec;
    var atu=!isParc&&r.situacao!=='Recebido'?calcAtual(r.valor,r.lancamento,j,cm):totP;
    var honVal=totRec*hon;
    var dias=atrasoOp(r)||null;
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
//  ACORDOS — ADMINISTRATIVOS (S.acordos) E JUDICIAIS (S.judicial)
// ══════════════════════════════════════════════════════════════
// Registros antigos guardavam "parcelas" como texto e o recebido digitado à mão
// (ou a lista "pagamentos" no judicial). Eles continuam contando pelo valor antigo
// até serem reeditados, quando o cronograma de parcelas é gerado.
var TIPOS_PARCELA=['Normal contrato','Somente honorários','Somente cliente'];
var FASES_JUD=['Citação','Instrução','Sentença','Recurso','Execução','Acordo','Arquivado'];
var SIT_ACORDO={acordos:['Ativo','Cumprido','Inadimplente','Cancelado'],judicial:['Ativo','Cumprido','Inadimplente','Arquivado']};

function acParcs(r){return Array.isArray(r.parcelas)?r.parcelas:[];}
function acValor(r){return Number(r.valor_acordado||r.valor||0);}
// Pagamentos da parcela. Parcelas pagas antes do controle de pagamentos só têm "pago" e "data_pgto".
function pagtosParcela(p){
  if(Array.isArray(p.pagamentos)) return p.pagamentos;
  return p.sit==='Pago'||Number(p.pago||0)>0?[{valor:Number(p.pago||p.valor||0),data:p.data_pgto||''}]:[];
}
function totalPagoParc(p){return arred(pagtosParcela(p).reduce(function(a,x){return a+Number(x.valor||0);},0));}
function devidoParc(p){return arred(Number(p.valor||0)+Number(p.juros_atraso||0));}
// Pago quando o recebido cobre o devido (parcela zerada também conta como quitada); Parcial quando cobre só uma parte.
function statusParcela(p){
  if(!Array.isArray(p.pagamentos)&&p.sit==='Pago') return 'Pago';
  var pago=totalPagoParc(p);
  if(pago>=devidoParc(p)-0.005) return 'Pago';
  return pago>0?'Parcial':'Em aberto';
}
// Parcela fechada com dinheiro recebido: não absorve diferenças de outras parcelas.
// Converte parcela antiga (só pago/data_pgto) para a lista de pagamentos.
function normalizarParcela(p){if(!Array.isArray(p.pagamentos))p.pagamentos=pagtosParcela(p).slice();return p;}
function parcFechada(p){return p.sit==='Pago'&&totalPagoParc(p)>0;}
function parcPago(p){return totalPagoParc(p);}
// Aplica -diff nas parcelas seguintes ainda abertas, em ordem: diff>0 abate, diff<0 acrescenta.
// Nenhuma parcela fica abaixo do que já recebeu; o que não couber passa para a seguinte e o que sobrar é devolvido.
function compensarProximas(parcs,i,diff){
  var resto=arred(diff);
  for(var k=i+1;k<parcs.length&&Math.abs(resto)>=0.005;k++){
    var q=parcs[k];
    if(parcFechada(q))continue;
    normalizarParcela(q);
    var minimo=Math.max(0,arred(totalPagoParc(q)-Number(q.juros_atraso||0))), atual=Number(q.valor||0), novo=arred(atual-resto);
    if(novo<minimo){resto=arred(resto-(atual-minimo));q.valor=minimo;}
    else{q.valor=novo;resto=0;}
    q.sit=statusParcela(q);
  }
  return resto;
}
// Honorários de cada parcela proporcionais ao valor dela. Cada fatia é a diferença entre totais
// acumulados arredondados, então nenhuma fica negativa e a soma fecha exatamente no total.
function honProporcional(parcs,honTotal){
  var soma=parcs.reduce(function(a,p){return a+Number(p.valor||0);},0), n=parcs.length;
  if(!n)return [];
  if(soma<=0)return dividirCentavos(honTotal,n);
  var out=[],acum=0,anterior=0;
  for(var i=0;i<n;i++){
    acum+=Number(parcs[i].valor||0);
    var atual=i===n-1?arred(honTotal):arred(honTotal*acum/soma);
    out.push(arred(atual-anterior));anterior=atual;
  }
  return out;
}
function aplicarHonorarios(parcs,honTotal,honPct){
  var hons=honProporcional(parcs,honTotal);
  parcs.forEach(function(p,i){p.num=i+1;p.hon_valor=hons[i];p.hon_pct=Number(honPct)||0;});
}
function acRecebido(r){return acParcs(r).reduce(function(a,p){return a+parcPago(p);},0)+acRecAnterior(r);}
// Saldo = parcelas ainda em aberto (juros de atraso pagos não abatem as parcelas seguintes)
function acRecAnterior(r){return Array.isArray(r.parcelas)?Number(r.recebido_anterior||0):Number(r.recebido||0);}
function acSaldo(r){
  if(!Array.isArray(r.parcelas)) return Math.max(0,acValor(r)-acRecebido(r));
  return r.parcelas.reduce(function(a,p){return a+(p.sit==='Pago'?0:Math.max(0,devidoParc(p)-totalPagoParc(p)));},0);
}
function acProx(r){return acParcs(r).find(function(p){return p.sit!=='Pago';})||null;}
function parcVencida(p){return !!(p&&p.sit!=='Pago'&&diasAtraso(p.venc,p.sit));}
function acParcAtraso(r){
  if(!Array.isArray(r.parcelas)) return (r.situacao==='Em atraso'||r.situacao==='Quebrado')?1:0;
  return r.parcelas.filter(parcVencida).length;
}
function acAtivo(r){return ['Cumprido','Arquivado','Cancelado'].indexOf(r.situacao)<0;}
function acFiltroSit(r,sit){return !sit||(sit==='Em atraso'?acParcAtraso(r)>0:r.situacao===sit);}
function acBusca(r,busca){
  if(!busca)return true;
  var b=busca.toLowerCase();
  return [r.devedor,r.credor,r.numero,r.documento].some(function(v){return (v||'').toLowerCase().indexOf(b)>=0;});
}

// valores: valor de cada parcela (já em centavos); honorários divididos em centavos do mesmo jeito.
function gerarParcAcordo(valores,honTotal,honPct,tipo,data1){
  var n=valores.length, hons=dividirCentavos(honTotal,n), parcs=[];
  for(var i=0;i<n;i++){
    parcs.push({num:i+1,venc:vencParcela(data1,i),valor:valores[i],hon_valor:hons[i],hon_pct:Number(honPct)||0,tipo:tipo||TIPOS_PARCELA[0],sit:'Em aberto',pago:0,pagamentos:[]});
  }
  return parcs;
}
// Valor por parcela digitado à mão? Registros antigos não têm a marca: compara com a divisão automática.
function acVparcManual(r){
  if(typeof r.vparc_manual==='boolean') return r.vparc_manual;
  var n=r.nparc||acParcs(r).length||1;
  return !!Number(r.vparc)&&Math.abs(Number(r.vparc)*n-Math.max(0,acValor(r)-acRecAnterior(r)))>0.01*n;
}

// list opcional: o painel geral passa só os acordos do período escolhido.
function kpisAcordo(key,list){
  list=list||S[key]||[];
  var isJud=key==='judicial';
  var tot=list.reduce(function(a,r){return a+acValor(r);},0);
  var rec=list.reduce(function(a,r){return a+acRecebido(r);},0);
  var ati=list.filter(acAtivo).length;
  var atr=list.reduce(function(a,r){return a+acParcAtraso(r);},0);
  var pagas=0,totParc=0,vinc=0;
  list.forEach(function(r){acParcs(r).forEach(function(p){totParc++;if(p.sit==='Pago')pagas++;else if(!parcVencida(p))vinc++;});});
  var tx=tot>0?(rec/tot)*100:0;
  return kpiHTML('Total acordado',R(tot),isJud?'valor em acordos judiciais':'valor em acordos adm.',isJud?'purple':'amber')+
    kpiHTML('Total recebido',R(rec),tx.toFixed(1)+'% recuperado','green','green',tx)+
    kpiHTML(isJud?'Processos ativos':'Acordos ativos',ati,'em andamento','blue')+
    kpiHTML('Parcelas em atraso',atr,'atenção requerida','red')+
    kpiHTML('Parcelas pagas',pagas+'/'+totParc,vinc+' vincendas','teal');
}

// Valores por mês: acordado pela data de lançamento, recebido pela data de pagamento de cada parcela
function serieAcordo(list,months){
  function noMes(ds,o){if(!ds)return false;var d=new Date(String(ds).slice(0,10)+'T00:00:00');return d.getFullYear()===o.y&&d.getMonth()===o.m;}
  return {
    acordado:months.map(function(o){return list.filter(function(r){return noMes(r.lancamento,o);}).reduce(function(a,r){return a+acValor(r);},0);}),
    recebido:months.map(function(o){
      return list.reduce(function(sum,r){
        if(!Array.isArray(r.parcelas)){
          if(Array.isArray(r.pagamentos)) return sum+r.pagamentos.filter(function(p){return noMes(p.data,o);}).reduce(function(a,p){return a+Number(p.valor||0);},0);
          return sum+(noMes(r.lancamento,o)?Number(r.recebido||0):0);
        }
        // Acordo antigo que ganhou parcelas: o que foi recebido antes entra uma vez só,
        // pela lista de pagamentos datados ou, sem ela, pelo recebido anterior na data de lançamento.
        var hist=0;
        if(Array.isArray(r.pagamentos)&&r.pagamentos.length) hist=r.pagamentos.filter(function(p){return noMes(p.data,o);}).reduce(function(a,p){return a+Number(p.valor||0);},0);
        else if(Number(r.recebido_anterior||0)>0&&noMes(r.lancamento,o)) hist=Number(r.recebido_anterior);
        return sum+hist+r.parcelas.reduce(function(a,p){return a+pagtosParcela(p).filter(function(x){return noMes(x.data,o);}).reduce(function(b,x){return b+Number(x.valor||0);},0);},0);
      },0);
    })
  };
}

function linhaAcordo(key,r){
  var isJud=key==='judicial';
  var parcs=acParcs(r), prox=acProx(r);
  var pagas=parcs.filter(function(p){return p.sit==='Pago';}).length;
  var atraso=parcVencida(prox)||(!parcs.length&&acParcAtraso(r)>0);
  var tipo=r.tipo_parcela||TIPOS_PARCELA[0];
  var tipoCor=tipo==='Somente honorários'?'purple':tipo==='Somente cliente'?'blue':'teal';
  var proxHtml=prox?'<div style="font-size:11px">'+fD(prox.venc)+'</div>'+(atraso?atrH(diasAtraso(prox.venc,prox.sit)):''):(parcs.length?'<span style="color:var(--green)">Quitado</span>':'<span class="dim">—</span>');
  return '<tr class="'+(atraso?'row-atraso':'')+'" style="cursor:pointer" onclick="verAcordo(\''+key+'\',\''+r.id+'\')" title="Clique para ver as parcelas">'+
    (isJud?'<td style="color:var(--purple);font-size:11px;font-weight:600">'+esc(r.numero||'—')+'</td>':'')+
    '<td><b>'+esc(r.devedor||'—')+'</b>'+(r.credor?'<div style="font-size:10px;color:var(--tx3)">'+esc(r.credor)+'</div>':'')+'</td>'+
    '<td>'+R(acValor(r))+'</td>'+
    '<td class="pos">'+R(acRecebido(r))+'</td>'+
    '<td class="warn">'+R(acSaldo(r))+'</td>'+
    '<td class="dim">'+(parcs.length?pagas+'/'+parcs.length+'x':esc(typeof r.parcelas==='string'&&r.parcelas?r.parcelas:'—'))+'</td>'+
    '<td>'+proxHtml+'</td>'+
    '<td><span class="tag tag-'+tipoCor+'" style="font-size:9px">'+esc(tipo)+'</span></td>'+
    '<td class="dim">'+honDe(r)+'%</td>'+
    (isJud?'<td>'+pillSit(r.fase||'—')+'</td>':'')+
    '<td>'+pillSit(r.situacao||'Ativo')+'</td>'+
    '<td class="dim">'+esc(r.responsavel||'—')+'</td>'+
    '<td onclick="event.stopPropagation()"><button class="row-ab" onclick="verAcordo(\''+key+'\',\''+r.id+'\')">Parcelas</button><button class="row-ab" onclick="editRec(\''+key+'\',\''+r.id+'\')">Editar</button><button class="row-ab del" onclick="delRec(\''+key+'\',\''+r.id+'\')">Excluir</button></td>'+
    '</tr>';
}

function renderKpiAcordos(){document.getElementById('kpi-ac').innerHTML=kpisAcordo('acordos');}
function renderAcordos(){
  var bl=(document.getElementById('f-ac-b')||{}).value||'';
  var sl=(document.getElementById('f-ac-s')||{}).value||'';
  var list=S.acordos.filter(function(r){return acBusca(r,bl)&&acFiltroSit(r,sl);});
  document.getElementById('cnt-ac').textContent=list.length+' registro'+(list.length!==1?'s':'');
  var tb=document.getElementById('tb-ac');
  if(!list.length){tb.innerHTML=EROW(11);return;}
  tb.innerHTML=list.map(function(r){return linhaAcordo('acordos',r);}).join('');
}
function renderChartAcordos(){
  var months=getMonths(),labels=months.map(function(x){return x.label;});
  var cel=months.map(function(o){return S.acordos.filter(function(r){if(!r.lancamento)return false;var d=new Date(r.lancamento);return d.getFullYear()===o.y&&d.getMonth()===o.m;}).length;});
  var cum=months.map(function(o){return S.acordos.filter(function(r){if(!r.lancamento||r.situacao!=='Cumprido')return false;var d=new Date(r.lancamento);return d.getFullYear()===o.y&&d.getMonth()===o.m;}).length;});
  var cntO=JSON.parse(JSON.stringify(baseOpt()));
  cntO.scales.y.ticks.callback=function(v){return v;};
  mkChart('chartAc','bar',{labels:labels,datasets:[{label:'Celebrados',data:cel,backgroundColor:'rgba(245,158,11,0.6)',borderRadius:3},{label:'Cumpridos',data:cum,backgroundColor:'rgba(63,185,80,0.8)',borderRadius:3}]},cntO);
  var s=serieAcordo(S.acordos,months);
  mkChart('chartAcV','bar',{labels:labels,datasets:[{label:'Acordado',data:s.acordado,backgroundColor:'rgba(245,158,11,0.6)',borderRadius:3},{label:'Recebido',data:s.recebido,backgroundColor:'rgba(63,185,80,0.8)',borderRadius:3}]});
}
function renderKpiJudicial(){document.getElementById('kpi-j').innerHTML=kpisAcordo('judicial');}
function renderJudicial(){
  var bl=(document.getElementById('f-jud-b')||{}).value||'';
  var ff=(document.getElementById('f-jud-f')||{}).value||'';
  var list=S.judicial.filter(function(r){return acBusca(r,bl)&&(!ff||r.fase===ff);});
  document.getElementById('cnt-j').textContent=list.length+' registro'+(list.length!==1?'s':'');
  var tb=document.getElementById('tb-j');
  if(!list.length){tb.innerHTML=EROW(13);return;}
  tb.innerHTML=list.map(function(r){return linhaAcordo('judicial',r);}).join('');
}
function renderChartJudicial(){
  var months=getMonths(),labels=months.map(function(x){return x.label;});
  mkChart('chartJud','bar',{labels:labels,datasets:[{label:'Recebido',data:serieAcordo(S.judicial,months).recebido,backgroundColor:'rgba(188,140,255,0.7)',borderRadius:3}]});
  var fc=FASES_JUD.map(function(f){return S.judicial.filter(function(r){return r.fase===f;}).length;});
  mkChart('chartJudF','doughnut',{labels:FASES_JUD,datasets:[{data:fc,backgroundColor:['rgba(88,166,255,0.8)','rgba(63,185,80,0.8)','rgba(245,158,11,0.8)','rgba(192,122,42,0.8)','rgba(251,113,133,0.8)','rgba(188,140,255,0.8)','rgba(94,94,94,0.5)'],borderColor:'rgba(0,0,0,0.3)',borderWidth:1}]},{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'right',labels:{color:'#9a9590',font:{size:10},boxWidth:8}}}});
}

// ── Detalhe do acordo (modal com parcelas) ──
// pagIdx: parcela com o formulário de pagamento aberto
function verAcordo(key,id,pagIdx){
  var r=S[key].find(function(x){return x.id===id;});
  if(!r)return;
  var isJud=key==='judicial';
  var hon=honDe(r);
  var honCalc=(r.hon_calc===undefined||r.hon_calc===null||r.hon_calc==='')?acValor(r)*(hon/100):Number(r.hon_calc);
  var box=function(t,c){return '<div class="acd-box"><div class="acd-lbl">'+t+'</div>'+c+'</div>';};
  var html='<div class="modal-title">'+(isJud?'Acordo Judicial — '+esc(r.numero||'s/n'):'Acordo Administrativo — '+esc(r.devedor||''))+'</div>';
  html+='<div class="acd-grid">';
  html+=box('Devedor','<div style="font-weight:600">'+esc(r.devedor||'—')+'</div>'+(r.credor?'<div class="acd-sub">Credor: '+esc(r.credor)+'</div>':'')+(r.documento?'<div class="acd-sub">CNPJ/CPF: '+esc(r.documento)+'</div>':''));
  // Valor da cobrança: no judicial antigo vinha em "valor" (valor da causa); no administrativo é o valor original.
  var vCob=Number(isJud?(r.valor_cobranca||(r.valor_acordado?0:r.valor)):r.valor_original)||0;
  html+=box('Valores','<div>Valor da cobrança: <b>'+(vCob?R(vCob):'—')+'</b></div><div>Valor acordado: <b style="color:var(--teal)">'+R(acValor(r))+'</b></div><div>Recebido: <b style="color:var(--green)">'+R(acRecebido(r))+'</b></div><div>Saldo: <b style="color:var(--amber)">'+R(acSaldo(r))+'</b></div>');
  html+=box('Honorários','<div><b style="color:var(--purple)">'+hon+'%</b> = '+R(honCalc)+'</div><div class="acd-sub">'+esc(r.tipo_parcela||TIPOS_PARCELA[0])+'</div>');
  html+=box(isJud?'Fase / Situação':'Situação','<div>'+(isJud?pillSit(r.fase||'—')+' ':'')+pillSit(r.situacao||'Ativo')+'</div><div class="acd-sub" style="margin-top:4px">Operador: '+esc(r.responsavel||'—')+'</div>');
  html+='</div>';
  if(r.obs) html+='<div class="acd-obs">'+esc(r.obs)+'</div>';
  html+='<div class="modal-sec">Parcelas</div>';
  var parcs=acParcs(r);
  if(parcs.length){
    html+='<div style="overflow:auto;max-height:280px"><table><thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Honorários</th><th>Tipo</th><th>Situação</th><th>Pago</th><th></th></tr></thead><tbody>';
    parcs.forEach(function(p,pi){
      var atr=parcVencida(p);
      var opts=TIPOS_PARCELA.map(function(t){return '<option'+((p.tipo||TIPOS_PARCELA[0])===t?' selected':'')+'>'+t+'</option>';}).join('');
      html+='<tr class="'+(atr?'row-atraso':'')+'"><td class="dim">'+p.num+'ª</td><td class="dim">'+fD(p.venc)+(atr?' '+atrH(diasAtraso(p.venc,p.sit)):'')+'</td><td>'+R(p.valor)+'</td><td style="color:var(--purple)">'+R(p.hon_valor||0)+'</td>'+
        '<td><select class="input-fi acd-sel" onchange="editTipoParc(\''+key+'\',\''+id+'\','+pi+',this.value)">'+opts+'</select></td>'+
        '<td>'+pillSit(p.sit||'Em aberto')+'</td>'+
        '<td class="pos">'+listaPagtos(key,id,pi,p)+'</td>'+
        '<td>'+(p.sit==='Pago'||pi===pagIdx?'':'<button class="row-ab" onclick="verAcordo(\''+key+'\',\''+id+'\','+pi+')">Registrar pagamento</button>')+'</td></tr>';
      if(pi===pagIdx) html+=formPagamento(key,id,r,pi);
    });
    html+='</tbody></table></div>';
  } else {
    html+='<div class="dim" style="font-size:12px;padding:8px 0">Acordo sem cronograma de parcelas. Clique em Editar e salve para gerar as parcelas.</div>';
  }
  html+='<div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button><button class="btn btn-teal" onclick="editRec(\''+key+'\',\''+id+'\')">Editar</button></div>';
  showModalHTML(html);
}
function ehAcordo(key){return key==='acordos'||key==='judicial';}
// Detalhe com parcelas: acordos usam verAcordo, carteiras parceladas usam verParcelas.
function abrirDetalhe(key,id,pagIdx){if(ehAcordo(key))verAcordo(key,id,pagIdx);else verParcelas(key,id,pagIdx);}
function listaPagtos(key,id,pi,p){
  var lst=pagtosParcela(p);
  if(!lst.length) return '<span class="dim">—</span>';
  return lst.map(function(x,j){return '<div class="pg-item">'+R(x.valor)+(x.data?' <span class="acd-sub">'+fD(x.data)+'</span>':'')+'<button class="pg-del" title="Excluir pagamento" onclick="removerPagamento(\''+key+'\',\''+id+'\','+pi+','+j+')">×</button></div>';}).join('')+
    (p.transferido?'<div class="acd-sub">'+R(p.transferido)+' passou p/ a próxima</div>':'')+
    (p.excedente?'<div class="acd-sub">'+R(p.excedente)+' abatido da(s) próxima(s)</div>':'');
}
function temProximaAberta(parcs,pi){return parcs.slice(pi+1).some(function(q){return !parcFechada(q);});}
function taxaJurosAtraso(){return Number(S.config.juros_atraso!==undefined?S.config.juros_atraso:2);}
function diasEntre(ini,fim){
  var a=new Date(String(ini).slice(0,10)+'T00:00:00'), b=new Date(String(fim).slice(0,10)+'T00:00:00');
  return Math.floor((b-a)/864e5);
}
// Meses de atraso já cobrados na parcela. Pagamentos com juros anteriores a este controle
// contam como cobrados até a data do último pagamento.
function mesesJurosCobrados(p){
  if(p.juros_meses!==undefined)return Number(p.juros_meses)||0;
  if(Number(p.juros_atraso||0)>0&&p.data_pgto&&p.venc){var d=diasEntre(p.venc,p.data_pgto);return d>0?Math.ceil(d/30):0;}
  return 0;
}
// Juros de atraso até a data do pagamento: só os meses (contados do vencimento) ainda não cobrados.
function jurosAtraso(p,dataPgto){
  var dias=p.venc&&p.sit!=='Pago'?diasEntre(p.venc,dataPgto||today()):0;
  var meses=dias>0?Math.ceil(dias/30):0, novos=Math.max(0,meses-mesesJurosCobrados(p));
  return {valor:arred(Math.max(0,devidoParc(p)-totalPagoParc(p))*(taxaJurosAtraso()/100)*novos),meses:meses};
}
function formPagamento(key,id,r,pi){
  var p=r.parcelas[pi];
  var restante=Math.max(0,arred(devidoParc(p)-totalPagoParc(p)));
  var juros=jurosAtraso(p,today()).valor;
  var args='\''+key+'\',\''+id+'\','+pi;
  var h='<tr class="pg-row"><td colspan="8"><div class="pg-form" data-restante="'+restante+'">';
  h+='<label>Valor recebido (R$)<input id="pg-valor" class="input-fi" type="number" min="0" step="0.01" value="'+arred(restante+juros).toFixed(2)+'" oninput="atualizarPgForm('+args+')"></label>';
  h+='<label>Data<input id="pg-data" class="input-fi" type="date" value="'+today()+'" onchange="atualizarJurosPg('+args+')"></label>';
  h+='<label class="pg-check" id="pg-juros-wrap"'+(juros>0?'':' style="display:none"')+'><input id="pg-juros" type="checkbox" checked data-juros="'+juros+'" onchange="trocarJurosPg('+args+')"> <span id="pg-juros-txt">Juros de atraso ('+taxaJurosAtraso()+'%/mês): '+R(juros)+'</span></label>';
  h+='<div id="pg-aviso" class="pg-aviso"></div>';
  h+='<div class="pg-acoes"><button class="btn btn-ghost btn-sm" onclick="abrirDetalhe(\''+key+'\',\''+id+'\')">Cancelar</button><button class="btn btn-teal btn-sm" onclick="confirmarPagamento('+args+')">Confirmar pagamento</button></div>';
  h+='</div></td></tr>';
  setTimeout(function(){atualizarPgForm(key,id,pi);},0);
  return h;
}
// Data do pagamento mudou: recalcula os juros até essa data e o valor sugerido.
function atualizarJurosPg(key,id,pi){
  var r=S[key].find(function(x){return x.id===id;}), jEl=document.getElementById('pg-juros');
  if(!r||!jEl)return;
  var j=jurosAtraso(r.parcelas[pi],gv('pg-data')||today()).valor;
  jEl.dataset.juros=j;
  document.getElementById('pg-juros-wrap').style.display=j>0?'':'none';
  document.getElementById('pg-juros-txt').textContent='Juros de atraso ('+taxaJurosAtraso()+'%/mês): '+R(j);
  trocarJurosPg(key,id,pi);
}
function trocarJurosPg(key,id,pi){
  var jEl=document.getElementById('pg-juros'), form=jEl.closest('.pg-form');
  document.getElementById('pg-valor').value=(Number(form.dataset.restante)+(jEl.checked?Number(jEl.dataset.juros):0)).toFixed(2);
  atualizarPgForm(key,id,pi);
}
// Mostra o que acontece com a diferença entre o valor digitado e o devido.
function atualizarPgForm(key,id,pi){
  var r=S[key].find(function(x){return x.id===id;}), aviso=document.getElementById('pg-aviso');
  if(!r||!aviso)return;
  var p=r.parcelas[pi];
  var jEl=document.getElementById('pg-juros');
  var devido=arred(devidoParc(p)+(jEl&&jEl.checked?Number(jEl.dataset.juros)||0:0)-totalPagoParc(p));
  var v=arred(parseFloat(gv('pg-valor'))||0), dif=arred(v-devido);
  var temProx=temProximaAberta(r.parcelas,pi);
  if(dif<-0.005){
    aviso.innerHTML='Faltam <b>'+R(-dif)+'</b> nesta parcela. O restante:'+
      '<label><input type="radio" name="pg-resto" value="aberto" checked> fica em aberto nesta parcela</label>'+
      '<label'+(temProx?'':' class="dim"')+'><input type="radio" name="pg-resto" value="proxima"'+(temProx?'':' disabled')+'> passa para a próxima parcela'+(temProx?'':' (não há próxima em aberto)')+'</label>';
  } else if(dif>0.005){
    aviso.innerHTML=temProx?'<b>'+R(dif)+'</b> a mais serão abatidos da próxima parcela.':'<b>'+R(dif)+'</b> a mais — não há próxima parcela em aberto para abater.';
  } else aviso.innerHTML='';
}
async function confirmarPagamento(key,id,pi){
  var r=S[key].find(function(x){return x.id===id;});
  if(!r||!acParcs(r)[pi])return;
  r.parcelas.forEach(normalizarParcela);
  var p=r.parcelas[pi];
  var v=arred(parseFloat(gv('pg-valor')));
  if(!(v>0)){toast('Informe um valor recebido maior que zero.','err');return;}
  var data=gv('pg-data')||today();
  var jEl=document.getElementById('pg-juros');
  var opcResto=(document.querySelector('input[name="pg-resto"]:checked')||{}).value;
  // Parcela antiga sem contador: fixa os meses já cobrados antes que data_pgto mude.
  if(p.juros_meses===undefined) p.juros_meses=mesesJurosCobrados(p);
  var jur=jurosAtraso(p,data);
  if(jEl&&jEl.checked&&jur.valor>0){p.juros_atraso=arred(Number(p.juros_atraso||0)+jur.valor);p.juros_meses=jur.meses;}
  p.pagamentos=pagtosParcela(p).concat([{valor:v,data:data}]);
  p.pago=totalPagoParc(p);
  p.data_pgto=data;
  var dif=arred(p.pago-devidoParc(p));
  if(dif>0.005){
    // Pagou a mais: o excedente abate as próximas e esta parcela passa a valer o que cobriu.
    var sobra=compensarProximas(r.parcelas,pi,dif), usado=arred(dif-sobra);
    if(usado>0){p.valor=arred(Number(p.valor||0)+usado);p.excedente=arred(Number(p.excedente||0)+usado);}
  } else if(dif<-0.005&&opcResto==='proxima'){
    // Pagou menos e o restante vai para a próxima: esta parcela fecha no valor recebido.
    var falta=-dif;
    compensarProximas(r.parcelas,pi,-falta);
    p.valor=arred(Number(p.valor||0)-falta);
    p.transferido=arred(Number(p.transferido||0)+falta);
  }
  p.sit=statusParcela(p);
  if(ehAcordo(key)) aplicarHonorarios(r.parcelas,acHonTotal(r),honDe(r));
  if(r.parcelas.every(function(x){return x.sit==='Pago';})) r.situacao=ehAcordo(key)?'Cumprido':'Recebido';
  renderCurrentPage();
  toast('Pagamento registrado!','ok');
  abrirDetalhe(key,id);
  await persistDocuments(key,[r]);
}
async function removerPagamento(key,id,pi,j){
  var r=S[key].find(function(x){return x.id===id;});
  if(!r||!acParcs(r)[pi])return;
  if(!confirm('Excluir este pagamento?\nTransferências ou abatimentos já feitos nas outras parcelas não são desfeitos. Se precisar, ajuste em Editar → Editar parcelas.'))return;
  var p=r.parcelas[pi];
  var lst=pagtosParcela(p).slice();
  lst.splice(j,1);
  p.pagamentos=lst;
  p.pago=totalPagoParc(p);
  p.data_pgto=lst.length?lst[lst.length-1].data:'';
  p.sit=statusParcela(p);
  var quitada=ehAcordo(key)?'Cumprido':'Recebido';
  if(r.situacao===quitada&&!r.parcelas.every(function(x){return x.sit==='Pago';})) r.situacao=ehAcordo(key)?'Ativo':'Em aberto';
  renderCurrentPage();
  abrirDetalhe(key,id);
  await persistDocuments(key,[r]);
}
function acHonTotal(r){
  return (r.hon_calc===undefined||r.hon_calc===null||r.hon_calc==='')?arred(acValor(r)*honDe(r)/100):Number(r.hon_calc);
}
async function editTipoParc(key,id,pi,tipo){
  var r=S[key].find(function(x){return x.id===id;});
  if(!r||!acParcs(r)[pi])return;
  r.parcelas[pi].tipo=tipo;
  await persistDocuments(key,[r]);
}

// ── Formulário de acordo ──
// Rascunho das parcelas aberto em "Editar parcelas"; só é gravado se o usuário mexeu nele.
var parcRascunho=null, parcEditadas=false, parcEsperado=0, parcBasePagtos='';
// Pagamentos de cada parcela, para detectar o que foi registrado (em outra aba ou por outra pessoa) durante a edição.
function assinaturaPagtos(parcs){
  // Acordos antigos podem ter "parcelas" como texto: contam como sem parcelas.
  return JSON.stringify((Array.isArray(parcs)?parcs:[]).map(function(p){return [pagtosParcela(p),Number(p.juros_atraso||0),Number(p.transferido||0),Number(p.excedente||0)];}));
}
function buildFormAcordo(key,r){
  r=r||{};
  var isJud=key==='judicial';
  var cfg=S.config||DEF.config;
  var parcs=acParcs(r);
  var nparc=r.nparc||parcs.length||parseInt(r.parcelas)||1;
  var temPago=parcs.some(function(p){return totalPagoParc(p)>0;});
  var anterior=acRecAnterior(r);
  var sits=SIT_ACORDO[key].slice();
  if(r.situacao&&sits.indexOf(r.situacao)<0) sits.unshift(r.situacao);
  var inp=function(id,lbl,val,extra,full){return '<div class="ff'+(full?' full':'')+'"><label>'+lbl+'</label><input id="'+id+'" value="'+esc(String(val===undefined||val===null?'':val))+'" '+(extra||'')+'></div>';};
  var num='type="number" min="0" step="0.01"';
  var h='';
  if(isJud){
    h+='<div class="modal-sec">Processo</div>';
    h+=inp('f-numero','Nº do processo',r.numero,'',true);
    h+=inp('f-devedor','Devedor *',r.devedor);
    h+=inp('f-credor','Credor',r.credor);
  } else {
    h+='<div class="modal-sec">Devedor</div>';
    h+=inp('f-devedor','Loja / Devedor *',r.devedor,'',true);
    h+=inp('f-documento','CNPJ / CPF',r.documento);
    h+=inp('f-credor','Credor / Fornecedor',r.credor);
  }
  h+='<div class="modal-sec">Valores do acordo</div>';
  h+=isJud?inp('f-valor-cob','Valor da cobrança (R$)',r.valor_cobranca||(r.valor_acordado?'':r.valor)||'',num):inp('f-valor-orig','Valor original (R$)',r.valor_original||'',num);
  // Mudar valor ou nº de parcelas limpa o valor por parcela, que volta a ser calculado.
  h+=inp('f-valor-acordado','Valor acordado (R$) *',r.valor_acordado||(isJud?'':r.valor)||'',num+' oninput="recalcAcordo(true)"');
  h+=inp('f-nparc','Nº de parcelas',nparc,'type="number" min="1" max="120" oninput="recalcAcordo(true)"');
  h+='<div class="ff parc-ed-btn"><label>&nbsp;</label><button type="button" class="btn btn-ghost" onclick="abrirEditorParcelas()">Editar parcelas (datas e valores)</button><span id="parc-resumo" class="acd-sub">'+(r.parcelas_editadas?'Parcelas editadas à mão':'')+'</span></div>';
  h+=inp('f-vparc','Valor por parcela (R$)',acVparcManual(r)?r.vparc:'',num+' placeholder="Calculado automaticamente" oninput="descartarRascunho()"');
  h+=inp('f-honorarios','Honorários (%)',r.id?honDe(r):cfg.honorarios,'type="number" min="0" max="100" step="0.1" oninput="recalcAcordo()"');
  h+=inp('f-hon-calc','Honorários calculados (R$)',(r.hon_calc===undefined||r.hon_calc===null)?'':r.hon_calc,num);
  h+=inp('f-data1','1ª parcela em',r.data1||r.prox_venc||today(),'type="date" onchange="recalcAcordo(true)"');
  h+='<div class="ff"><label>Tipo de parcela</label><select id="f-tipo-parcela">'+SEL(TIPOS_PARCELA,r.tipo_parcela||TIPOS_PARCELA[0])+'</select></div>';
  h+='<input type="hidden" id="f-rec-ant" value="'+anterior+'">';
  if(anterior>0&&!temPago) h+='<div class="ff full acd-sub" style="color:var(--amber)">'+R(anterior)+' já recebido antes do controle por parcelas: as parcelas são geradas sobre o saldo restante.</div>';
  if(temPago) h+='<div class="ff full acd-sub" style="color:var(--amber)">Este acordo já tem parcelas pagas: alterar valor, nº de parcelas ou datas aqui não refaz o cronograma. Use “Editar parcelas” para ajustar.</div>';
  h+='<div class="modal-sec">Controle</div>';
  if(isJud) h+='<div class="ff"><label>Fase processual</label><select id="f-fase">'+SEL(FASES_JUD,r.fase||'Execução')+'</select></div>';
  h+='<div class="ff"><label>Operador</label><select id="f-responsavel">'+ADV(r.responsavel)+'</select></div>';
  h+='<div class="ff"><label>Situação</label><select id="f-situacao">'+SEL(sits,r.situacao||'Ativo')+'</select></div>';
  h+='<div class="ff full"><label>Observações</label><textarea id="f-obs">'+esc(r.obs||'')+'</textarea></div>';
  h+='<div id="parc-editor" class="ff full"></div>';
  return h;
}
function recalcAcordo(limparParcela){
  if(limparParcela) descartarRascunho();
  var v=gf('f-valor-acordado'), n=Math.max(1,parseInt(gv('f-nparc'))||1);
  var hon=numCampo('f-honorarios',S.config.honorarios);
  var hc=document.getElementById('f-hon-calc');
  if(hc&&hc!==document.activeElement) hc.value=v?(v*hon/100).toFixed(2):'';
  var vp=document.getElementById('f-vparc');
  if(!vp)return;
  if(limparParcela) vp.value='';
  vp.placeholder=v?dividirCentavos(Math.max(0,v-gf('f-rec-ant')),n)[0].toFixed(2):'Calculado automaticamente';
}
function exEmEdicao(){
  var key=gv('m-tipo'), id=gv('m-id');
  return id&&S[key]?S[key].find(function(x){return x.id===id;})||null:null;
}
function rascunhoTemPago(){return !!parcRascunho&&parcRascunho.some(function(p){return totalPagoParc(p)>0;});}
// Mudar valor, nº de parcelas ou 1ª data refaz o rascunho (se ainda não houver parcela paga).
function descartarRascunho(){
  if(!parcRascunho||rascunhoTemPago())return;
  // Carteira já salva mantém as parcelas gravadas; o formulário não refaz o cronograma.
  if(!ehAcordo(gv('m-tipo'))&&exEmEdicao())return;
  var avisar=parcEditadas;
  parcRascunho=null;parcEditadas=false;
  var res=document.getElementById('parc-resumo');
  if(res) res.innerHTML=avisar?'<span style="color:var(--amber)">Parcelas recalculadas: as edições anteriores foram descartadas.</span>':'';
}
// Parcelas de um lançamento novo de carteira, calculadas como no salvar (juros do parcelamento).
function parcelasCarteiraDoForm(){
  var nParc=parseInt(gv('f-nparc'))||3, vParc=gf('f-vparc'), data1=gv('f-data1')||today();
  var j2=gf('f-juros')||S.config.juros, valor=gf('f-valor'), jm=j2/100;
  var fator=nParc>1?(jm*Math.pow(1+jm,nParc))/(Math.pow(1+jm,nParc)-1):1;
  var valCalc=vParc>0?vParc:(valor*(nParc>1?fator:1));
  var parcelas=gerarParcelas(valor,nParc,data1,j2);
  parcelas.forEach(function(p){p.valor=arred(valCalc);});
  return parcelas;
}
// Acordo: o valor a parcelar vem do formulário. Carteira: é o total das parcelas quando o editor foi aberto.
function esperadoRascunho(){
  return ehAcordo(gv('m-tipo'))?arred(Math.max(0,gf('f-valor-acordado')-gf('f-rec-ant'))):parcEsperado;
}
function abrirEditorParcelas(){
  if(!parcRascunho&&!ehAcordo(gv('m-tipo'))){
    var exC=exEmEdicao();
    if(!(exC&&Array.isArray(exC.parcelas))&&!gf('f-valor')){toast('Informe o valor original antes de editar as parcelas.','err');return;}
    parcBasePagtos=assinaturaPagtos(exC?exC.parcelas:[]);
    parcRascunho=JSON.parse(JSON.stringify(exC&&Array.isArray(exC.parcelas)?exC.parcelas:parcelasCarteiraDoForm())).map(normalizarParcela);
    parcEsperado=arred(parcRascunho.reduce(function(a,p){return a+Number(p.valor||0);},0));
  }
  if(!parcRascunho){
    var ex=exEmEdicao(), pc=paramsCronograma(ex), exParcs=ex?acParcs(ex):[];
    var temPago=exParcs.some(function(p){return totalPagoParc(p)>0;});
    var base=(exParcs.length&&(temPago||!cronogramaMudou(ex,pc)))?exParcs:gerarParcAcordo(pc.valores,pc.honCalc,pc.hon,pc.tipoParc,pc.data1);
    parcBasePagtos=assinaturaPagtos(exParcs);
    parcRascunho=JSON.parse(JSON.stringify(base)).map(normalizarParcela);
  }
  document.getElementById('m-body').classList.add('editando-parcelas');
  document.querySelector('.modal').classList.add('modal-wide');
  renderEditorParcelas();
}
function fecharEditorParcelas(){
  document.getElementById('m-body').classList.remove('editando-parcelas');
  document.querySelector('.modal').classList.remove('modal-wide');
  var res=document.getElementById('parc-resumo');
  if(res&&parcEditadas){
    var soma=parcRascunho.reduce(function(a,p){return a+Number(p.valor||0);},0);
    res.innerHTML='Parcelas editadas: '+parcRascunho.length+'x, total '+R(soma);
  }
  recalcModal();
}
function renderEditorParcelas(){
  var box=document.getElementById('parc-editor');
  if(!box||!parcRascunho)return;
  var acordo=ehAcordo(gv('m-tipo'));
  var hon=numCampo('f-honorarios',S.config.honorarios);
  var vAc=gf('f-valor-acordado');
  var hons=acordo?honProporcional(parcRascunho,arred(numCampo('f-hon-calc',vAc*hon/100))):[];
  var esperado=esperadoRascunho();
  var soma=arred(parcRascunho.reduce(function(a,p){return a+Number(p.valor||0);},0));
  var dif=arred(soma-esperado);
  var h='<div class="modal-sec">'+(acordo?'Parcelas do acordo':'Parcelas')+'</div>';
  h+='<div class="acd-sub" style="margin:6px 0 8px">Ao alterar o valor de uma parcela, a diferença é compensada na próxima parcela em aberto.</div>';
  h+='<div style="overflow:auto;max-height:340px"><table class="parc-ed"><thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Recebido</th>'+(acordo?'<th>Honorários</th>':'')+'<th>Situação</th></tr></thead><tbody>';
  parcRascunho.forEach(function(p,i){
    h+='<tr><td class="dim">'+(i+1)+'ª</td>'+
      '<td><input class="input-fi" type="date" value="'+esc(p.venc||'')+'" onchange="editarDataParcela('+i+',this.value)"></td>'+
      '<td><input class="input-fi" type="number" min="0" step="0.01" value="'+Number(p.valor||0).toFixed(2)+'" onchange="editarValorParcela('+i+',this.value)"></td>'+
      '<td class="pos">'+(totalPagoParc(p)>0?R(totalPagoParc(p)):'<span class="dim">—</span>')+'</td>'+
      (acordo?'<td style="color:var(--purple)">'+R(hons[i])+'</td>':'')+
      '<td>'+pillSit(statusParcela(p))+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div class="parc-ed-tot"><span>Soma das parcelas: <b>'+R(soma)+'</b></span><span>Valor a parcelar: <b>'+R(esperado)+'</b></span>'+
    '<span class="'+(Math.abs(dif)>0.005?'parc-ed-dif':'dim')+'">Diferença: <b>'+R(dif)+'</b></span></div>';
  h+='<div style="text-align:right;margin-top:10px"><button type="button" class="btn btn-ghost btn-sm" onclick="fecharEditorParcelas()">'+(acordo?'Voltar ao acordo':'Voltar ao lançamento')+'</button></div>';
  box.innerHTML=h;
}
function editarValorParcela(i,valor){
  var p=parcRascunho&&parcRascunho[i];
  if(!p)return;
  var v=arred(parseFloat(valor));
  if(isNaN(v)||v<0){toast('Informe um valor válido.','err');renderEditorParcelas();return;}
  var diff=arred(v-Number(p.valor||0));
  p.valor=v;
  var sobra=compensarProximas(parcRascunho,i,diff);
  parcRascunho.forEach(function(q){q.sit=statusParcela(q);});
  parcEditadas=true;
  renderEditorParcelas();
  if(Math.abs(sobra)>=0.005) toast('Não há parcela seguinte em aberto para compensar '+R(Math.abs(sobra))+'. Confira a soma.','err');
}
function editarDataParcela(i,data){
  if(!parcRascunho||!parcRascunho[i]||!data)return;
  parcRascunho[i].venc=data;
  parcEditadas=true;
}

// Parâmetros do cronograma lidos do formulário (usados ao salvar e ao abrir o editor de parcelas).
function paramsCronograma(ex){
  var vAc=gf('f-valor-acordado');
  var n=Math.max(1,Math.min(120,parseInt(gv('f-nparc'))||1));
  var anterior=ex?acRecAnterior(ex):0;
  // Parcela digitada à mão vale para todas; senão o saldo é dividido em centavos (a soma fecha exata).
  var vParcManual=String(gv('f-vparc')).trim()!=='';
  var valores=vParcManual?Array(n).fill(arred(gf('f-vparc'))):dividirCentavos(Math.max(0,vAc-anterior),n);
  var hon=numCampo('f-honorarios',S.config.honorarios);
  return {vAc:vAc,n:n,anterior:anterior,vParcManual:vParcManual,valores:valores,vParc:valores[0],hon:hon,
    honCalc:arred(numCampo('f-hon-calc',vAc*hon/100)),data1:gv('f-data1')||today(),tipoParc:gv('f-tipo-parcela')||TIPOS_PARCELA[0]};
}
function cronogramaMudou(ex,pc){
  return !ex||!Array.isArray(ex.parcelas)
    ||String(ex.valor_acordado)!==String(pc.vAc)||String(ex.nparc)!==String(pc.n)
    ||String(ex.data1)!==String(pc.data1)||String(ex.tipo_parcela)!==String(pc.tipoParc)
    ||acVparcManual(ex)!==pc.vParcManual
    ||(pc.vParcManual&&arred(ex.vparc)!==pc.vParc);
}
function lerFormAcordo(key,ex){
  var isJud=key==='judicial';
  var pc=paramsCronograma(ex);
  var vAc=pc.vAc, n=pc.n, anterior=pc.anterior, vParcManual=pc.vParcManual, valores=pc.valores, vParc=pc.vParc;
  var hon=pc.hon, honCalc=pc.honCalc, data1=pc.data1, tipoParc=pc.tipoParc;
  var rec={devedor:gv('f-devedor').trim(),credor:gv('f-credor').trim(),valor_acordado:vAc,nparc:n,vparc:vParc,vparc_manual:vParcManual,honorarios:hon,hon_calc:honCalc,data1:data1,tipo_parcela:tipoParc,responsavel:gv('f-responsavel'),situacao:gv('f-situacao'),obs:gv('f-obs').trim(),lancamento:ex&&ex.lancamento?ex.lancamento:today(),criado_em:ex&&ex.criado_em?ex.criado_em:today()};
  if(isJud){rec.numero=gv('f-numero').trim();rec.valor_cobranca=gf('f-valor-cob');rec.fase=gv('f-fase');}
  else{rec.documento=gv('f-documento').trim();rec.valor_original=gf('f-valor-orig');}
  // Cronograma: gerado no cadastro e refeito na edição só enquanto nenhuma parcela foi paga
  var exParcs=ex?acParcs(ex):[];
  var temPago=exParcs.some(function(p){return totalPagoParc(p)>0;});
  if(parcRascunho&&parcEditadas){
    rec.parcelas=JSON.parse(JSON.stringify(parcRascunho));
    rec.parcelas.forEach(function(p){p.sit=statusParcela(p);});
    aplicarHonorarios(rec.parcelas,honCalc,hon);
    rec.nparc=rec.parcelas.length;
    rec.parcelas_editadas=true;
  } else {
    var manter=temPago||!cronogramaMudou(ex,pc);
    if(manter){rec.parcelas=JSON.parse(JSON.stringify(exParcs));aplicarHonorarios(rec.parcelas,honCalc,hon);}
    else rec.parcelas=gerarParcAcordo(valores,honCalc,hon,tipoParc,data1);
    rec.parcelas_editadas=!!(manter&&ex&&ex.parcelas_editadas);
  }
  if(anterior>0) rec.recebido_anterior=anterior;
  if(ex&&Array.isArray(ex.pagamentos)&&ex.pagamentos.length) rec.pagamentos=ex.pagamentos;
  return rec;
}

// ══════════════════════════════════════════════════════════════
//  PAINEL DA OPERADORA — ACORDOS
// ══════════════════════════════════════════════════════════════
// Ordem dos cards de acordo: em andamento primeiro (maior atraso primeiro), depois Cumpridos
// e por fim Cancelados/Arquivados, esses dois pelo pagamento mais recente.
function grupoAcOp(r){return r.situacao==='Cumprido'?1:(r.situacao==='Cancelado'||r.situacao==='Arquivado')?2:0;}
function atrasoAcOp(r){
  if(!Array.isArray(r.parcelas)) return acParcAtraso(r)?1:0;
  var venc=r.parcelas.filter(function(p){return p.sit!=='Pago';}).map(function(p){return p.venc||'';}).filter(Boolean).sort()[0];
  return venc?(diasAtraso(venc,'Em aberto')||0):0;
}
function ultimoPgtoAcOp(r){
  var ds=[];
  acParcs(r).forEach(function(p){pagtosParcela(p).forEach(function(x){if(x.data)ds.push(String(x.data).slice(0,10));});});
  (Array.isArray(r.pagamentos)?r.pagamentos:[]).forEach(function(x){if(x.data)ds.push(String(x.data).slice(0,10));});
  ds.sort();
  return ds.length?ds[ds.length-1]:(r.lancamento||'');
}
function renderOperadoraAcordos(){
  var grid=document.getElementById('op-ac-grid');
  if(!grid)return;
  var busca=(document.getElementById('op-ac-search')||{}).value||'';
  var sitF=(document.getElementById('op-ac-sit')||{}).value||'';
  var key=opAcordoSub==='judiciais'?'judicial':'acordos', isJud=key==='judicial';
  var list=(S[key]||[]).filter(function(r){return acBusca(r,busca)&&acFiltroSit(r,sitF);});
  list.sort(function(a,b){
    var g=grupoAcOp(a)-grupoAcOp(b);
    if(g) return g;
    if(grupoAcOp(a)>0) return ultimoPgtoAcOp(b).localeCompare(ultimoPgtoAcOp(a));
    return atrasoAcOp(b)-atrasoAcOp(a);
  });
  if(!list.length){grid.innerHTML='<div style="grid-column:1/-1"><div class="empty"><div class="empty-ic">🤝</div><div class="empty-t">Nenhum acordo encontrado</div><div class="empty-s">Ajuste os filtros ou lance acordos</div></div></div>';return;}
  var cor=isJud?'var(--purple)':'var(--amber)';
  grid.innerHTML=list.map(function(r){
    var parcs=acParcs(r), prox=acProx(r), atraso=parcVencida(prox);
    var pagas=parcs.filter(function(p){return p.sit==='Pago';}).length;
    var vAc=acValor(r), vRec=acRecebido(r);
    var prog=vAc>0?Math.min(100,(vRec/vAc)*100):0;
    var head='<div class="ac-head"><div><div class="ac-devedor">'+esc(r.devedor||'—')+'</div>'+(isJud&&r.numero?'<div class="ac-credor">Proc.: '+esc(r.numero)+'</div>':'')+(r.credor?'<div class="ac-credor">Credor: '+esc(r.credor)+'</div>':'')+'</div><div style="text-align:right">'+pillSit(r.situacao||'Ativo')+'<div style="font-size:9px;color:var(--tx3);margin-top:3px">'+(isJud?'Judicial':'Administrativo')+'</div></div></div>';
    var body='<div class="ac-body">';
    body+='<div class="ac-row"><span class="ac-key">Acordado</span><span class="ac-val" style="color:'+cor+'">'+R(vAc)+'</span></div>';
    body+='<div class="ac-row"><span class="ac-key">Recebido</span><span class="ac-val" style="color:var(--green)">'+R(vRec)+'</span></div>';
    body+='<div class="ac-row"><span class="ac-key">Saldo</span><span class="ac-val" style="color:var(--amber)">'+R(acSaldo(r))+'</span></div>';
    body+='<div class="ac-row"><span class="ac-key">Operador</span><span class="ac-val">'+esc(r.responsavel||'—')+'</span></div>';
    if(atraso) body+='<div class="ac-row"><span class="ac-key" style="color:var(--red)">Parcela em atraso</span><span class="ac-val">'+fD(prox.venc)+' '+atrH(diasAtraso(prox.venc,prox.sit))+'</span></div>';
    if(parcs.length) body+='<div class="parc-progress"><div class="parc-label"><span>Parcelas pagas</span><span>'+pagas+'/'+parcs.length+'</span></div><div class="parc-track"><div class="parc-fill" style="width:'+prog.toFixed(0)+'%;background:'+cor+'"></div></div></div>';
    body+='<div class="ac-row" style="margin-top:6px"><button class="row-ab" onclick="verAcordo(\''+key+'\',\''+r.id+'\')">Ver parcelas</button><button class="row-ab" onclick="editRec(\''+key+'\',\''+r.id+'\')">Editar</button></div>';
    body+='</div>';
    return '<div class="ac-card'+(atraso?' ac-atraso':'')+'">'+head+body+'</div>';
  }).join('');
}


// ══════════════════════════════════════════════════════════════
//  VER PARCELAS (modal extra)
// ══════════════════════════════════════════════════════════════
// pagIdx: parcela com o formulário de pagamento aberto
function verParcelas(key,id,pagIdx){
  var r=S[key].find(function(x){return x.id===id;});
  if(!r)return;
  var parcs=r.parcelas||[], isCli=key.indexOf('clientes')===0;
  var box=function(t,c){return '<div class="acd-box"><div class="acd-lbl">'+t+'</div>'+c+'</div>';};
  var html='<div class="modal-title">Parcelas — '+esc(r.devedor||'')+'</div>';
  html+='<div class="acd-grid">';
  html+=box('Devedor','<div style="font-weight:600">'+esc(r.devedor||'—')+'</div>'+(r.credor?'<div class="acd-sub">Credor: '+esc(r.credor)+'</div>':''));
  html+=box('Valores','<div>Valor original: <b>'+R(r.valor)+'</b></div><div>Total parcelado: <b style="color:var(--teal)">'+R(totalParc(parcs))+'</b></div><div>Recebido: <b style="color:var(--green)">'+R(acRecebido(r))+'</b></div><div>A receber: <b style="color:var(--amber)">'+R(acSaldo(r))+'</b></div>');
  if(isCli) html+=box('Honorários','<div><b style="color:var(--purple)">'+honDe(r)+'%</b> sobre o recebido = '+R(acRecebido(r)*honDe(r)/100)+'</div>');
  html+=box('Situação','<div>'+pillSit(r.situacao||'Em aberto')+'</div><div class="acd-sub" style="margin-top:4px">Operador: '+esc(r.responsavel||'—')+'</div>');
  html+='</div>';
  if(r.obs) html+='<div class="acd-obs">'+esc(r.obs)+'</div>';
  html+='<div class="modal-sec">Parcelas</div>';
  html+='<div style="overflow:auto;max-height:280px"><table><thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Recebido</th><th></th></tr></thead><tbody>';
  parcs.forEach(function(p,pi){
    var atr=parcVencida(p);
    html+='<tr class="'+(atr?'row-atraso':'')+'"><td class="dim">'+p.num+'ª</td><td class="dim">'+fD(p.venc)+(atr?' '+atrH(diasAtraso(p.venc,p.sit)):'')+'</td><td>'+R(p.valor)+'</td>'+
      '<td>'+pillSit(p.sit||'Em aberto')+'</td>'+
      '<td class="pos">'+listaPagtos(key,id,pi,p)+'</td>'+
      '<td>'+(p.sit==='Pago'||pi===pagIdx?'':'<button class="row-ab" onclick="verParcelas(\''+key+'\',\''+id+'\','+pi+')">Registrar pagamento</button>')+'</td></tr>';
    if(pi===pagIdx) html+=formPagamento(key,id,r,pi);
  });
  html+='</tbody></table></div>';
  html+='<div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button><button class="btn btn-teal" onclick="editRec(\''+key+'\',\''+id+'\')">Editar</button></div>';
  showModalHTML(html);
}

// ══════════════════════════════════════════════════════════════
//  MODAL FORMS
// ══════════════════════════════════════════════════════════════
// O modal de lançamento é substituído pelas telas de parcelas; resetModal restaura o formulário original.
var MODAL_HTML=document.querySelector('.modal').innerHTML;
function resetModal(){parcRascunho=null;parcEditadas=false;parcEsperado=0;parcBasePagtos='';var m=document.querySelector('.modal');m.classList.remove('modal-wide');if(!document.getElementById('m-body'))m.innerHTML=MODAL_HTML;document.getElementById('m-body').classList.remove('editando-parcelas');}
function showModalHTML(html){var m=document.querySelector('.modal');m.innerHTML=html;m.classList.add('modal-wide');document.getElementById('mbg').classList.add('open');}

// Mantém o operador já gravado no registro mesmo que ele tenha sido removido da lista
var ADV=function(atual){
  var nomes=(Array.isArray(S.config.advogados)?S.config.advogados:DEF.config.advogados).slice();
  if(atual&&nomes.indexOf(atual)<0) nomes.unshift(atual);
  if(!nomes.length) return '<option value="">Nenhum operador cadastrado</option>';
  return nomes.map(function(a){return '<option value="'+esc(a)+'"'+(a===atual?' selected':'')+'>'+esc(a)+'</option>';}).join('');
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
    html+='<div class="ff"><label>1ª parcela em</label><input id="f-data1" type="date" value="'+(r._data1||today())+'" oninput="descartarRascunho();recalcModal()"></div>';
    html+='<div class="ff"><label>Juros mensais (%)</label><input id="f-juros" type="number" value="'+(r.juros_custom||j)+'" min="0" step="0.1" oninput="syncParcelamento(\'juros\')"></div>';
    html+='<div class="ff"><label>Correção monetária anual (%)</label><input id="f-cm" type="number" value="'+(r.cm_custom||cm)+'" min="0" step="0.1" oninput="syncParcelamento(\'cm\')"></div>';
    html+='<div class="ff parc-ed-btn"><label>&nbsp;</label><button type="button" class="btn btn-ghost" onclick="abrirEditorParcelas()">Editar parcelas (datas e valores)</button><span id="parc-resumo" class="acd-sub">'+(r.parcelas_editadas?'Parcelas editadas à mão':'')+'</span></div>';
  }

  if(isCliente){
    html+='<div class="ff"><label>Honorários (%)</label><input id="f-honorarios" type="number" value="'+(r.id?honDe(r):hon)+'" min="0" max="100" step="0.1" oninput="recalcModal()"></div>';
  }

  html+='<div class="calc-box" id="calc-preview"><div class="calc-box-title">Prévia do cálculo</div><div id="calc-rows"><div style="font-size:11px;color:var(--tx3)">Preencha os valores acima para ver a prévia</div></div></div>';

  html+='<div class="modal-sec">Controle</div>';
  html+='<div class="ff"><label>Operador</label><select id="f-responsavel">'+ADV(r.responsavel)+'</select></div>';
  html+='<div class="ff"><label>Situação</label><select id="f-situacao">'+SEL(['Em aberto','Em dia','Em atraso','Negociação','Recebido','Inadimplente','Judicial'],r.situacao||'Em aberto')+'</select></div>';
  html+='<div class="ff full"><label>Observações</label><textarea id="f-obs">'+esc(r.obs||'')+'</textarea></div>';
  if(isParc) html+='<div id="parc-editor" class="ff full"></div>';
  return html;
}

function openModal(toOverride){
  try {
    resetModal();
    var btnNew=document.getElementById('btn-new');
    var page=toOverride||(btnNew&&btnNew.dataset?btnNew.dataset.page:'')||'propria';
    var tipo=page==='clientes'?'clientes_vista':'propria_vista';
    if(toOverride==='acordos') tipo='acordos';
    if(toOverride==='judicial') tipo='judicial';
    var mTipo=document.getElementById('m-tipo'); if(mTipo) mTipo.value=tipo;
    var mId=document.getElementById('m-id'); if(mId) mId.value='';
    var lbls={propria_vista:'Carteira Própria — À Vista',propria_parc:'Carteira Própria — Parcelado',clientes_vista:'Clientes Externos — À Vista',clientes_parc:'Clientes Externos — Parcelado',acordos:'Acordo Administrativo',judicial:'Acordo Judicial'};
    var mTitle=document.getElementById('m-title'); if(mTitle) mTitle.textContent='Novo Lançamento — '+(lbls[tipo]||'');
    var mBody=document.getElementById('m-body');
    if(mBody){
      if(tipo==='acordos'||tipo==='judicial') mBody.innerHTML=buildFormAcordo(tipo);
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
    parcRascunho=null;parcEditadas=false;parcEsperado=0;
    var mBody=document.getElementById('m-body'); if(mBody) mBody.innerHTML=buildForm(novoTipo,{devedor:dv,credor:cr});
    if(dv&&document.getElementById('f-devedor')) document.getElementById('f-devedor').value=dv;
    if(cr&&document.getElementById('f-credor')) document.getElementById('f-credor').value=cr;
    try { syncParcelamento('init'); } catch(e0) { console.error('Erro syncParcelamento:', e0); }
  } catch(err) {
    console.error('Erro em switchTipoModal:', err);
  }
}

function syncParcelamento(src){
  if(src!=='init') descartarRascunho();
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
    var total=valCalc*nParc, descParc=nParc+'x de '+R(valCalc);
    // Parcelas já gravadas (edição) ou editadas à mão: a prévia mostra as parcelas reais.
    var exP=exEmEdicao(), reais=parcRascunho||(exP&&Array.isArray(exP.parcelas)?exP.parcelas:null);
    if(reais&&reais.length){
      total=arred(reais.reduce(function(a,p){return a+Number(p.valor||0);},0));
      var iguais=reais.every(function(p){return Math.abs(Number(p.valor||0)-Number(reais[0].valor||0))<0.005;});
      descParc=iguais?reais.length+'x de '+R(reais[0].valor):reais.length+' parcelas (valores editados)';
    }
    rows+='<div class="calc-row"><span class="calc-key">Valor original</span><span class="calc-val">'+R(valor)+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Parcelas</span><span class="calc-val">'+descParc+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Total parcelado</span><span class="calc-val" style="color:var(--amber)">'+R(total)+'</span></div>';
    if(isCliente) rows+='<div class="calc-row"><span class="calc-key">Honorários sobre total ('+Math.round(hon*100)+'%)</span><span class="calc-val" style="color:var(--purple)">'+R(total*hon)+'</span></div>';
    rows+='<div class="calc-row"><span class="calc-key">Acréscimo de juros</span><span class="calc-val" style="color:var(--amber)">+'+R(total-valor)+'</span></div>';
  }
  preview.innerHTML=rows;
}

function editRec(key,id){
  var found=S[key].find(function(x){return x.id===id;});
  if(!found)return;
  resetModal();
  var r=Object.assign({},found,{_editing:true});
  document.getElementById('m-tipo').value=key;
  document.getElementById('m-id').value=id;
  var lbls={propria_vista:'Carteira Própria — À Vista',propria_parc:'Carteira Própria — Parcelado',clientes_vista:'Clientes Externos — À Vista',clientes_parc:'Clientes Externos — Parcelado',acordos:'Acordo Administrativo',judicial:'Acordo Judicial'};
  document.getElementById('m-title').textContent='Editar — '+(lbls[key]||'');
  if(key==='acordos'||key==='judicial') document.getElementById('m-body').innerHTML=buildFormAcordo(key,r);
  else document.getElementById('m-body').innerHTML=buildForm(key,r);
  syncParcelamento('init');
  setTimeout(function(){var s=document.getElementById('f-responsavel');if(s&&r.responsavel)s.value=r.responsavel;},15);
  document.getElementById('mbg').classList.add('open');
}

// Com o editor de parcelas aberto, Cancelar (ou clicar fora) volta ao formulário do acordo em vez de fechar o lançamento.
function closeModal(){
  var body=document.getElementById('m-body');
  if(body&&body.classList.contains('editando-parcelas')){fecharEditorParcelas();return;}
  document.getElementById('mbg').classList.remove('open');
}

function gv(id){var e=document.getElementById(id);return e?e.value:'';}
function gf(id){var e=document.getElementById(id);return e?parseFloat(e.value)||0:0;}

// Confirma quando as parcelas editadas não fecham com o valor a parcelar e recusa salvar
// se o lançamento recebeu pagamentos depois que o editor foi aberto (o rascunho os apagaria).
function somaRascunhoOk(){
  if(!(parcRascunho&&parcEditadas))return true;
  var exAtual=exEmEdicao();
  if(exAtual&&assinaturaPagtos(exAtual.parcelas)!==parcBasePagtos){
    parcRascunho=null;parcEditadas=false;
    fecharEditorParcelas();
    alert('Este lançamento recebeu pagamentos enquanto as parcelas eram editadas. As edições foram descartadas para não apagar esses pagamentos: abra "Editar parcelas" de novo e refaça os ajustes.');
    return false;
  }
  var somaP=arred(parcRascunho.reduce(function(a,p){return a+Number(p.valor||0);},0)), espP=esperadoRascunho();
  return Math.abs(somaP-espP)<=0.01||confirm('A soma das parcelas ('+R(somaP)+') é diferente do valor a parcelar ('+R(espP)+'). Salvar mesmo assim?');
}
// Todas as parcelas pagas: quitado. Parcela reaberta num registro quitado: volta a ativo/em aberto.
function reconciliarSituacao(key,r){
  if(r.situacao==='Arquivado'||r.situacao==='Cancelado')return;
  var quitada=ehAcordo(key)?'Cumprido':'Recebido', todas=r.parcelas.length&&r.parcelas.every(function(p){return p.sit==='Pago';});
  if(todas) r.situacao=quitada;
  else if(r.situacao===quitada) r.situacao=ehAcordo(key)?'Ativo':'Em aberto';
}
async function salvar(){
  var tipo=gv('m-tipo'), id=gv('m-id');
  var list=S[tipo], ex=id?list.find(function(r){return r.id===id;}):null;
  var rec={}, editouParcelas=!!(parcRascunho&&parcEditadas);
  if(tipo==='acordos'||tipo==='judicial'){
    if(!gv('f-devedor').trim()||!gf('f-valor-acordado')){toast('Informe devedor e valor acordado.','err');return;}
    if(!somaRascunhoOk())return;
    rec=lerFormAcordo(tipo,ex);
  } else if(tipo.slice(-5)==='vista'){
    if(!gv('f-devedor').trim()||!gf('f-valor')){toast('Informe devedor e valor.','err');return;}
    rec={devedor:gv('f-devedor').trim(),credor:gv('f-credor').trim(),valor:gf('f-valor'),recebido:gf('f-recebido'),data_pgto:gv('f-data-pgto'),lancamento:gv('f-lanc')||today(),criado_em:ex?ex.criado_em:today(),juros_custom:gf('f-juros'),cm_custom:gf('f-cm'),honorarios:numCampo('f-honorarios',S.config.honorarios),responsavel:gv('f-responsavel'),situacao:gv('f-situacao'),obs:gv('f-obs').trim()};
  } else {
    if(!gv('f-devedor').trim()||!gf('f-valor')){toast('Informe devedor e valor.','err');return;}
    if(!somaRascunhoOk())return;
    var nParc=parseInt(gv('f-nparc'))||3;
    var data1=gv('f-data1')||today();
    var j2=gf('f-juros')||S.config.juros;
    var valor=gf('f-valor');
    var editadas=!!(parcRascunho&&parcEditadas);
    var parcelas=editadas?JSON.parse(JSON.stringify(parcRascunho)):(ex?ex.parcelas:parcelasCarteiraDoForm());
    if(editadas){parcelas.forEach(function(p,i){p.num=i+1;p.sit=statusParcela(p);});nParc=parcelas.length;}
    rec={parcelas_editadas:editadas||!!(ex&&ex.parcelas_editadas),devedor:gv('f-devedor').trim(),credor:gv('f-credor').trim(),valor:valor,parcelas:parcelas,_nparc:nParc,_data1:data1,juros_custom:j2,cm_custom:gf('f-cm'),honorarios:numCampo('f-honorarios',S.config.honorarios),responsavel:gv('f-responsavel'),situacao:gv('f-situacao'),obs:gv('f-obs').trim(),lancamento:ex?ex.lancamento:today(),criado_em:ex?ex.criado_em:today()};
  }
  // Só quando as parcelas foram editadas neste salvamento (parcelas_editadas é uma marca permanente).
  if(editouParcelas&&Array.isArray(rec.parcelas)) reconciliarSituacao(tipo,rec);
  rec.id=ex?ex.id:uid();
  if(ex){var i=list.findIndex(function(r){return r.id===rec.id;});list[i]=rec;} else list.push(rec);
  document.getElementById('m-body').classList.remove('editando-parcelas');
  closeModal();
  toast('Lançamento salvo!','ok');
  if(tipo.indexOf('propria')===0||tipo.indexOf('clientes')===0){renderTbl(tipo.split('_')[0],tipo.split('_')[1]);renderDash();}
  if(tipo==='acordos'||tipo==='judicial')renderCurrentPage();
  await persistDocuments(tipo,[rec]);
}

async function delRec(key,id){
  if(!confirm('Excluir este lançamento?'))return;
  var idx=S[key].findIndex(function(r){return r.id===id;});
  if(idx<0)return;
  S[key].splice(idx,1);
  if(key.indexOf('propria')===0||key.indexOf('clientes')===0){renderTbl(key.split('_')[0],key.split('_')[1]);renderDash();}
  if(key==='acordos'||key==='judicial')renderCurrentPage();
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
  document.getElementById('cfg-juratr').value=S.config.juros_atraso!==undefined?S.config.juros_atraso:2;
  var el=document.getElementById('adv-list');
  el.innerHTML=S.config.advogados.map(function(a,i){return '<div class="cfg-row" style="padding:6px 0"><div class="cfg-lbl">'+esc(a)+'</div><button class="row-ab del" onclick="removeAdv('+i+')">Remover</button></div>';}).join('')||'<div style="font-size:11px;color:var(--tx3);padding:6px 0">Nenhum operador cadastrado.</div>';
}
async function saveCfg(){
  S.config.nome=gv('cfg-nome').trim()||'Oliveira & Benedet';
  S.config.honorarios=Math.min(100,Math.max(0,parseFloat(document.getElementById('cfg-hon').value)||30));
  S.config.juros=Math.max(0,parseFloat(document.getElementById('cfg-juros').value)||1);
  S.config.correcao=Math.max(0,parseFloat(document.getElementById('cfg-cm').value)||5);
  var juratr=parseFloat(document.getElementById('cfg-juratr').value);
  S.config.juros_atraso=isNaN(juratr)?2:Math.max(0,juratr);
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
