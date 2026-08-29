/* ============================================================
   ESTADO & PERSISTÊNCIA
   ============================================================ */
const CLIENTES_COLLECTION='relacionamento_clientes';
const INTERACOES_COLLECTION='relacionamento_interacoes';
const CONFIG_DOC='relacionamento_config';
const DEF={
  clientes:[], interacoes:[],
  config:{
    sdrs:['Cheila','Andrea','Letícia'],
    servicos:['Aposentadoria especial','Revisão de benefício INSS','Trabalhista','Família / Sucessões','Cobrança / Recuperação de crédito','Imobiliário'],
    areas:['Previdenciário','Trabalhista','Família / Sucessões','Cível','Cobrança','Empresarial / Tributário'],
    tipos:[
      {id:'minerar',label:'Mineração',color:'blue'},
      {id:'ativar',label:'Ativação',color:'gold'},
      {id:'informacao',label:'Informação',color:'neutral'},
      {id:'aniversario',label:'Aniversário',color:'purple'},
      {id:'inbound',label:'Cliente contatou',color:'green'}
    ],
    origens:['Indicação','Tráfego pago','Cliente antigo','Balcão / espontâneo','Prospecção ativa','Convênio / parceria']
  }
};
const FIREBASE_CFG=window.OB_FIREBASE_CONFIG||null;
let db=structuredClone(DEF);
let fbDb=null;
let fbAuth=null;
let currentUser=null;
let unsubClientes=null;
let unsubInteracoes=null;
let unsubConfig=null;
let firebaseReady=false;

function save(){
  if(firebaseReady&&currentUser)persistDb().catch(()=>toast('Não foi possível sincronizar com o Firebase'));
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

function createFirebaseUI(){
  document.body.insertAdjacentHTML('beforeend',`<div class="auth-overlay" id="authOverlay"><div class="auth-box"><h2>Acesso ao relacionamento</h2><p>Entre com seu email e senha para acessar a carteira.</p><input id="authEmail" type="email" placeholder="Email"><input id="authPassword" type="password" placeholder="Senha"><button class="btn primary" id="authLogin">Entrar</button><button class="auth-forgot" id="authForgot" type="button">Esqueci minha senha</button><div class="auth-error" id="authError"></div></div></div><div class="sync-bar" id="syncBar"><span class="sync-dot" id="syncDot"></span><span id="syncLabel">Conectando...</span><span id="syncDetail"></span><button class="btn sm" id="syncNow">Atualizar</button></div>`);
  document.getElementById('authLogin').addEventListener('click',login);
  document.getElementById('authPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
  document.getElementById('authForgot').addEventListener('click',forgotPassword);
  document.getElementById('syncNow').addEventListener('click',loadFromFirebase);
  document.getElementById('authLogout').addEventListener('click',logout);
}

function setSync(state,label,detail=''){
  const dot=document.getElementById('syncDot');const text=document.getElementById('syncLabel');const info=document.getElementById('syncDetail');
  if(dot)dot.className=`sync-dot ${state}`;
  if(text)text.textContent=label;
  if(info)info.textContent=detail;
}

function setAuth(open,error=''){
  document.getElementById('authOverlay')?.classList.toggle('open',open);
  const el=document.getElementById('authError');if(el)el.textContent=error;
}

function refreshAuthUI(){
  const userEl=document.getElementById('authUser');
  const logoutBtn=document.getElementById('authLogout');
  if(!userEl||!logoutBtn)return;
  userEl.textContent=currentUser?.email||'';
  userEl.title=currentUser?.email||'';
  userEl.classList.toggle('visible',!!currentUser);
  logoutBtn.classList.toggle('visible',!!currentUser);
}

async function login(){
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  if(!email||!password){setAuth(true,'Informe email e senha.');return;}
  try{await fbAuth.signInWithEmailAndPassword(email,password);}
  catch(e){setAuth(true,e.code==='auth/invalid-credential'?'Email ou senha incorretos.':'Falha no login. Tente novamente.');}
}

async function forgotPassword(){
  const email=document.getElementById('authEmail').value.trim();
  if(!email){setAuth(true,'Informe seu email para receber o link de recuperação.');return;}
  const button=document.getElementById('authForgot');
  button.disabled=true;
  try{
    await fbAuth.sendPasswordResetEmail(email);
    setAuth(true,'Enviamos um link de recuperação para seu email.');
  }catch(e){
    const message=e.code==='auth/invalid-email'?'Informe um email válido.':e.code==='auth/user-not-found'?'Não encontramos uma conta com esse email.':'Não foi possível enviar o link de recuperação.';
    setAuth(true,message);
  }finally{button.disabled=false;}
}

async function logout(){
  if(!fbAuth)return;
  try{await fbAuth.signOut();}
  catch(e){toast('Não foi possível sair da conta');}
}

async function persistDb(){
  if(!firebaseReady||!currentUser)return;
  const writes=[
    ...db.clientes.map(c=>({ref:fbDb.collection(CLIENTES_COLLECTION).doc(c.id),data:c})),
    ...db.interacoes.map(i=>({ref:fbDb.collection(INTERACOES_COLLECTION).doc(i.id),data:i})),
    {ref:fbDb.collection('meta').doc(CONFIG_DOC),data:db.config}
  ];
  const total=writes.length;
  const chunkSize=450;
  setSync('loading','Enviando backup...',`${total} registro(s)`);
  for(let start=0;start<total;start+=chunkSize){
    const batch=fbDb.batch();
    writes.slice(start,start+chunkSize).forEach(write=>batch.set(write.ref,write.data));
    await batch.commit();
    setSync('loading','Enviando backup...',`${Math.min(start+chunkSize,total)}/${total} registros`);
  }
  setSync('ok','Tempo real',`${db.clientes.length} clientes · ${db.interacoes.length} interações`);
}

function renderAll(){renderDash();renderCli();renderInter();renderCfg();renderAcoes();}

async function loadFromFirebase(){
  if(!currentUser)return;
  setSync('loading','Carregando Firebase...');
  try{
    const [clientesSnap,interacoesSnap,configSnap]=await Promise.all([
      fbDb.collection(CLIENTES_COLLECTION).get(),
      fbDb.collection(INTERACOES_COLLECTION).get(),
      fbDb.collection('meta').doc(CONFIG_DOC).get()
    ]);
    const hasRemote=!clientesSnap.empty||!interacoesSnap.empty||configSnap.exists;
    if(hasRemote){
      db.clientes=clientesSnap.docs.map(d=>d.data());
      db.interacoes=interacoesSnap.docs.map(d=>d.data());
      db.config={...structuredClone(DEF.config),...(configSnap.exists?configSnap.data():{})};
    }
    firebaseReady=true;renderAll();setSync('ok','Tempo real',`${db.clientes.length} clientes · ${db.interacoes.length} interações`);
  }catch(e){console.error(e);setSync('error','Erro no Firebase','Verifique as Rules e a configuração');toast('Não foi possível carregar os dados do Firebase');}
}

function startRealtime(){
  [unsubClientes,unsubInteracoes,unsubConfig].forEach(unsub=>unsub?.());
  unsubClientes=fbDb.collection(CLIENTES_COLLECTION).onSnapshot(snap=>{db.clientes=snap.docs.map(d=>d.data());renderAll();});
  unsubInteracoes=fbDb.collection(INTERACOES_COLLECTION).onSnapshot(snap=>{db.interacoes=snap.docs.map(d=>d.data());renderAll();});
  unsubConfig=fbDb.collection('meta').doc(CONFIG_DOC).onSnapshot(snap=>{if(snap.exists)db.config={...structuredClone(DEF.config),...snap.data()};renderAll();});
}

function initFirebase(){
  if(!FIREBASE_CFG||typeof firebase==='undefined'){setSync('error','Firebase não configurado','Verifique firebase-config.public.js');setAuth(true,'Firebase não configurado.');return;}
  try{
    const app=firebase.apps.length?firebase.app():firebase.initializeApp(FIREBASE_CFG);
    fbDb=firebase.firestore(app);fbAuth=firebase.auth(app);
    fbAuth.onAuthStateChanged(user=>{
      currentUser=user||null;
      refreshAuthUI();
      if(currentUser){firebaseReady=true;setAuth(false);loadFromFirebase().then(startRealtime);}
      else{firebaseReady=false;[unsubClientes,unsubInteracoes,unsubConfig].forEach(unsub=>unsub?.());setAuth(true);setSync('error','Login necessário','Entre para carregar os dados');}
    });
  }catch(e){console.error(e);setSync('error','Erro ao iniciar Firebase');setAuth(true,'Não foi possível iniciar o Firebase.');}
}

/* ============================================================
   HELPERS
   ============================================================ */
const TIPO_COLORS={
  gold:['rgba(201,168,76,.3)','#C9A84C','rgba(201,168,76,.07)'],
  blue:['rgba(78,143,232,.3)','#4E8FE8','rgba(78,143,232,.07)'],
  green:['rgba(94,201,122,.3)','#5EC97A','rgba(94,201,122,.07)'],
  purple:['rgba(167,139,250,.3)','#A78BFA','rgba(167,139,250,.07)'],
  amber:['rgba(240,167,50,.3)','#F0A732','rgba(240,167,50,.07)'],
  rose:['rgba(232,115,90,.3)','#E8735A','rgba(232,115,90,.07)'],
  neutral:['rgba(184,180,204,.25)','#B8B4CC','rgba(184,180,204,.04)']
};
function tipos(){return db.config.tipos||[];}
function tipoOf(id){return tipos().find(t=>t.id===id);}
function tipoLabel(id){const t=tipoOf(id);return t?t.label:(id||'—');}
function tipoChip(id){const t=tipoOf(id);const c=TIPO_COLORS[(t&&t.color)||'neutral']||TIPO_COLORS.neutral;return `<span class="chip" style="border-color:${c[0]};color:${c[1]};background:${c[2]}">${esc(tipoLabel(id))}</span>`;}
function escJsSQ(s){return String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/[\r\n]/g,c=>c==='\r'?'\\r':'\\n');}
function parseD(s){if(!s)return null;const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function fmtD(s){const d=parseD(s);if(!d)return '—';return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});}
function fmtDL(s){const d=parseD(s);if(!d)return '—';return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});}
function daysAgo(s){const d=parseD(s);if(!d)return Infinity;return Math.floor((new Date().setHours(0,0,0,0)-d.getTime())/864e5);}
function cliById(id){return db.clientes.find(c=>c.id===id);}
function interByCli(id){return db.interacoes.filter(i=>i.clienteId===id).sort((a,b)=>b.data.localeCompare(a.data));}
function lastContact(id){const arr=interByCli(id);return arr.length?arr[0].data:null;}
function telDigits(t){return (t||'').replace(/\D/g,'').replace(/^0+/,'');}
function waLink(tel,msg){const d=telDigits(tel);const n=d.length>=11?'55'+d:d;return `https://wa.me/${n}?text=${encodeURIComponent(msg||'')}`;}
function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

let toastT;
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
document.getElementById('tabs').addEventListener('click',e=>{
  const b=e.target.closest('.tab');if(!b)return;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  b.classList.add('active');
  document.getElementById('view-'+b.dataset.view).classList.add('active');
  if(b.dataset.view==='dash')renderDash();
  if(b.dataset.view==='sdr')renderSdr();
  if(b.dataset.view==='acoes')renderAcoes();
  if(b.dataset.view==='inter')renderInter();
  if(b.dataset.view==='cli')renderCli();
  if(b.dataset.view==='cfg')renderCfg();
});

/* período */
let period=30;
document.getElementById('period').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('#period button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');period=b.dataset.p==='all'?'all':Number(b.dataset.p);renderDash();
});
function inPeriod(s){if(period==='all')return true;return daysAgo(s)<=period;}

/* período — aba Por SDR */
let periodSdr=30;
document.getElementById('periodSdr').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('#periodSdr button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');periodSdr=b.dataset.p==='all'?'all':Number(b.dataset.p);renderSdr();
});
function inPeriodSdr(s){if(periodSdr==='all')return true;return daysAgo(s)<=periodSdr;}

/* ============================================================
   PILLS (toggle yes/no) genérico
   ============================================================ */
document.body.addEventListener('click',e=>{
  const p=e.target.closest('.pill');if(!p)return;
  const grp=p.closest('.pills');if(!grp)return;
  grp.querySelectorAll('.pill').forEach(x=>x.classList.remove('on'));
  p.classList.add('on');
  const key=grp.dataset.pill;
  if(key==='conexao')document.getElementById('connFields').style.display=p.dataset.v==='1'?'block':'none';
  if(key==='interesse')document.getElementById('servWrap').style.display=p.dataset.v==='1'?'block':'none';
  if(key==='proc')document.getElementById('areaWrap').style.display=p.dataset.v==='1'?'block':'none';
});
function pillVal(key){const on=document.querySelector(`.pills[data-pill="${key}"] .pill.on`);return on?on.dataset.v:null;}
function setPill(key,v){document.querySelectorAll(`.pills[data-pill="${key}"] .pill`).forEach(p=>{p.classList.toggle('on',p.dataset.v===String(v));});}

/* ============================================================
   MODAL: INTERAÇÃO
   ============================================================ */
function fillSelect(id,arr,ph){const s=document.getElementById(id);s.innerHTML=(ph?`<option value="">${ph}</option>`:'')+arr.map(o=>`<option value="${esc(o.v??o)}">${esc(o.l??o)}</option>`).join('');}

function openInter(id){
  const m=document.getElementById('interModal');
  fillSelect('iCliente',db.clientes.map(c=>({v:c.id,l:c.nome})),db.clientes.length?'':'Cadastre um cliente primeiro');
  fillSelect('iSdr',db.config.sdrs);
  fillSelect('iTipo',db.config.tipos.map(t=>({v:t.id,l:t.label})));
  fillSelect('iServico',db.config.servicos,'—');
  document.querySelectorAll('#interModal .pill').forEach(p=>p.classList.remove('on'));
  document.getElementById('connFields').style.display='none';
  document.getElementById('servWrap').style.display='none';
  if(id){
    const i=db.interacoes.find(x=>x.id===id);
    document.getElementById('interTitle').textContent='Editar contato';
    document.getElementById('iId').value=i.id;
    document.getElementById('iCliente').value=i.clienteId;
    document.getElementById('iData').value=i.data;
    document.getElementById('iSdr').value=i.sdr;
    document.getElementById('iTipo').value=i.tipo;
    renderIndList(i.indicados);
    document.getElementById('iObs').value=i.obs||'';
    document.getElementById('iServico').value=i.servico||'';
    setPill('conexao',i.conexao?1:0);
    document.getElementById('connFields').style.display=i.conexao?'block':'none';
    if(i.conexao){
      setPill('feliz',i.feliz?1:0); setPill('satisfeito',i.satisfeito);
      setPill('interesse',i.interesse?1:0); setPill('indicaria',i.indicaria?1:0);
      setPill('ativado',i.resultado||'nenhum');
      document.getElementById('servWrap').style.display=i.interesse?'block':'none';
    }
  }else{
    document.getElementById('interTitle').textContent='Registrar contato';
    document.getElementById('iId').value='';
    document.getElementById('iData').value=todayISO();
    renderIndList([]);
    document.getElementById('iObs').value='';
  }
  m.classList.add('show');
}

function saveInter(){
  const cli=document.getElementById('iCliente').value;
  if(!cli){toast('Selecione ou cadastre um cliente');return;}
  const conexao=pillVal('conexao')==='1';
  const rec={
    id:document.getElementById('iId').value||uid(),
    clienteId:cli,
    data:document.getElementById('iData').value||todayISO(),
    sdr:document.getElementById('iSdr').value,
    tipo:document.getElementById('iTipo').value,
    conexao,
    feliz:conexao&&pillVal('feliz')==='1',
    satisfeito:conexao?pillVal('satisfeito'):null,
    interesse:conexao&&pillVal('interesse')==='1',
    servico:conexao&&pillVal('interesse')==='1'?document.getElementById('iServico').value:'',
    indicaria:conexao&&pillVal('indicaria')==='1',
    resultado:conexao?(pillVal('ativado')||'nenhum'):'nenhum',
    obs:document.getElementById('iObs').value.trim()
  };
  // Processar indicados: cada um vira/aponta para um cliente, com origem rastreada
  let indicados=[];
  if(conexao){
    const referrer=cliById(cli);
    const refNome=referrer?referrer.nome:'';
    collectIndicados().forEach(x=>{
      let cid=x.clienteId;
      if(cid){ const rc=cliById(cid); if(rc){rc.nome=x.nome; rc.tel=x.tel; if(!rc.indicadoPor)rc.indicadoPor=cli;} }
      else { cid=ensureReferredClient(x.nome,x.tel,refNome,cli); }
      indicados.push({clienteId:cid,nome:x.nome,tel:x.tel});
    });
  }
  rec.indicados=indicados;
  rec.indicacoes=indicados.length;
  const ix=db.interacoes.findIndex(x=>x.id===rec.id);
  if(ix>=0)db.interacoes[ix]=rec;else db.interacoes.unshift(rec);
  save();closeModal('interModal');
  toast(indicados.length?`Contato salvo · ${indicados.length} indicado(s) na carteira`:'Contato registrado');
  renderInter();renderCli();renderDash();renderAcoes();
}

/* ---- Indicados (referrals) ---- */
function indRowHTML(o){o=o||{};return `<div class="ind-row" data-cid="${esc(o.clienteId||'')}"><input class="ind-nome" placeholder="Nome do indicado" value="${esc(o.nome||'')}"><input class="ind-tel" placeholder="Telefone (opcional)" value="${esc(o.tel||'')}"><button type="button" class="ind-rm" title="Remover" onclick="rmIndRow(this)">×</button></div>`;}
function renderIndList(arr){const box=document.getElementById('indList');box.innerHTML='';(arr||[]).forEach(o=>box.insertAdjacentHTML('beforeend',indRowHTML(o)));if(!box.children.length)box.innerHTML='<div class="ind-empty">Nenhum indicado adicionado.</div>';}
function addIndicado(o){const box=document.getElementById('indList');const e=box.querySelector('.ind-empty');if(e)e.remove();box.insertAdjacentHTML('beforeend',indRowHTML(o));const inputs=box.querySelectorAll('.ind-row:last-child input');if(inputs[0])inputs[0].focus();}
function rmIndRow(btn){const box=document.getElementById('indList');btn.closest('.ind-row').remove();if(!box.children.length)box.innerHTML='<div class="ind-empty">Nenhum indicado adicionado.</div>';}
function collectIndicados(){return [...document.querySelectorAll('#indList .ind-row')].map(r=>({clienteId:r.dataset.cid||'',nome:r.querySelector('.ind-nome').value.trim(),tel:r.querySelector('.ind-tel').value.trim()})).filter(x=>x.nome);}
function ensureReferredClient(nome,tel,refNome,refId){
  const k=keyOf(nome,tel);
  const existing=db.clientes.find(c=>keyOf(c.nome,c.tel)===k);
  if(existing){ if(!existing.indicadoPor){existing.indicadoPor=refId; if(!existing.origem)existing.origem='Indicação de '+(refNome||'cliente');} return existing.id; }
  const c={id:uid(),nome,tel,proc:false,area:'',nasc:'',origem:'Indicação de '+(refNome||'cliente'),indicadoPor:refId,obs:'',criadoEm:todayISO()};
  db.clientes.unshift(c);
  return c.id;
}

async function delInter(id){
  if(!confirm('Excluir este registro de contato?'))return;
  db.interacoes=db.interacoes.filter(i=>i.id!==id);
  if(firebaseReady&&currentUser)await fbDb.collection(INTERACOES_COLLECTION).doc(id).delete();
  save();renderInter();renderDash();toast('Contato excluído');
}

/* ============================================================
   MODAL: CLIENTE
   ============================================================ */
function openCli(id){
  const m=document.getElementById('cliModal');
  fillSelect('cArea',db.config.areas,'—');
  document.getElementById('origensList').innerHTML=(db.config.origens||[]).map(o=>`<option value="${esc(o)}">`).join('');
  document.querySelectorAll('#cliModal .pill').forEach(p=>p.classList.remove('on'));
  document.getElementById('areaWrap').style.display='none';
  if(id){
    const c=cliById(id);
    document.getElementById('cliTitle').textContent='Editar cliente';
    document.getElementById('cId').value=c.id;
    document.getElementById('cNome').value=c.nome;
    document.getElementById('cTel').value=c.tel||'';
    document.getElementById('cNasc').value=c.nasc||'';
    document.getElementById('cOrigem').value=c.origem||'';
    document.getElementById('cObs').value=c.obs||'';
    setPill('proc',c.proc?1:0);
    if(c.proc){document.getElementById('areaWrap').style.display='block';document.getElementById('cArea').value=c.area||'';}
  }else{
    document.getElementById('cliTitle').textContent='Novo cliente';
    ['cId','cNome','cTel','cNasc','cOrigem','cObs'].forEach(x=>document.getElementById(x).value='');
  }
  m.classList.add('show');
}
function saveCli(){
  const nome=document.getElementById('cNome').value.trim();
  if(!nome){toast('Informe o nome do cliente');return;}
  const proc=pillVal('proc')==='1';
  const rec={
    id:document.getElementById('cId').value||uid(),
    nome, tel:document.getElementById('cTel').value.trim(),
    proc, area:proc?document.getElementById('cArea').value:'',
    nasc:document.getElementById('cNasc').value,
    origem:document.getElementById('cOrigem').value.trim(),
    obs:document.getElementById('cObs').value.trim(),
    criadoEm:document.getElementById('cId').value?undefined:todayISO()
  };
  const ix=db.clientes.findIndex(c=>c.id===rec.id);
  if(ix>=0)db.clientes[ix]={...db.clientes[ix],...rec};else db.clientes.unshift(rec);
  save();closeModal('cliModal');toast('Cliente salvo');renderCli();renderDash();renderAcoes();
}
async function delCli(id){
  const n=interByCli(id).length;
  if(!confirm(`Excluir este cliente${n?` e seus ${n} contato(s)`:''}?`))return;
  const interactionIds=db.interacoes.filter(i=>i.clienteId===id).map(i=>i.id);
  db.clientes=db.clientes.filter(c=>c.id!==id);
  db.interacoes=db.interacoes.filter(i=>i.clienteId!==id);
  if(firebaseReady&&currentUser){
    const batch=fbDb.batch();
    batch.delete(fbDb.collection(CLIENTES_COLLECTION).doc(id));
    interactionIds.forEach(interactionId=>batch.delete(fbDb.collection(INTERACOES_COLLECTION).doc(interactionId)));
    await batch.commit();
  }
  save();renderCli();renderDash();renderAcoes();toast('Cliente excluído');
}

function closeModal(id){document.getElementById(id).classList.remove('show');}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');}));

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDash(){
  const I=db.interacoes.filter(i=>inPeriod(i.data));
  const conex=I.filter(i=>i.conexao);
  const ativados=I.filter(i=>i.resultado==='ativado');
  const ativClientes=new Set(ativados.map(i=>i.clienteId)).size;
  const indic=I.reduce((s,i)=>s+(i.indicacoes||0),0);
  const promotores=new Set(I.filter(i=>i.indicaria).map(i=>i.clienteId)).size;
  const felizes=conex.filter(i=>i.feliz).length;
  const satis=conex.filter(i=>i.satisfeito==='1').length;
  const satisBase=conex.filter(i=>i.satisfeito==='1'||i.satisfeito==='0').length;
  const interesse=conex.filter(i=>i.interesse).length;

  const taxaConex=I.length?Math.round(conex.length/I.length*100):0;
  const taxaFeliz=conex.length?Math.round(felizes/conex.length*100):0;
  const taxaSatis=satisBase?Math.round(satis/satisBase*100):0;

  document.getElementById('kpis').innerHTML=`
    ${kpi('Contatos realizados',I.length,'navy',`${conex.length} com conexão`)}
    ${kpi('Taxa de conexão',taxaConex+'<small>%</small>','',`${conex.length} de ${I.length}`)}
    ${kpi('Clientes ativados',ativClientes,'good',ativClientes?'retorno positivo':'—')}
    ${kpi('Indicações geradas',indic,'good',`${promotores} promotores`)}
    ${kpi('Interesse em serviços',interesse,'',`em ${conex.length} conversas`)}
    ${kpi('Satisfação na ligação',taxaFeliz+'<small>%</small>','',`serviço: ${taxaSatis}%`)}
  `;

  // Funil
  const f=[
    {l:'Contatos realizados',v:I.length,cls:'s1'},
    {l:'Conexões (falamos)',v:conex.length,cls:'s2'},
    {l:'Demonstraram interesse',v:interesse,cls:'s3'},
    {l:'Ativações + indicações',v:ativClientes+indic,cls:'s4'}
  ];
  const fmax=Math.max(1,...f.map(x=>x.v));
  document.getElementById('funnel').innerHTML=f.map(s=>{
    const pct=Math.max(6,Math.round(s.v/fmax*100));
    const rel=I.length?Math.round(s.v/I.length*100):0;
    return `<div class="fstep ${s.cls}"><div class="ff" style="width:${pct}%"></div><div class="fc"><span class="fl">${s.l}</span><span class="fr">${s.v}<small>${rel}%</small></span></div></div>`;
  }).join('');

  // Por tipo
  const TL=tipos();
  const tCount={}; TL.forEach(t=>tCount[t.id]=0);
  I.forEach(i=>{if(tCount[i.tipo]===undefined)tCount[i.tipo]=0;tCount[i.tipo]++;});
  const tmax=Math.max(1,...Object.values(tCount),1);
  document.getElementById('byType').innerHTML=TL.map(t=>{
    const c=TIPO_COLORS[t.color||'neutral']||TIPO_COLORS.neutral;
    const v=tCount[t.id]||0;
    return `<div class="barrow"><div class="bl">${esc(t.label)}</div><div class="bartrack"><div class="barfill" style="width:${Math.round(v/tmax*100)}%;background:linear-gradient(90deg,${c[1]},${c[0]})"></div></div><div class="bv" style="color:${c[1]}">${v}</div></div>`;
  }).join('')||emptyMini('Sem contatos no período');

  // Por SDR
  const sdrMap={};
  I.forEach(i=>{const s=i.sdr||'—';sdrMap[s]=sdrMap[s]||{t:0,c:0};sdrMap[s].t++;if(i.conexao)sdrMap[s].c++;});
  const sdrArr=Object.entries(sdrMap).sort((a,b)=>b[1].t-a[1].t);
  const smax=Math.max(1,...sdrArr.map(s=>s[1].t));
  document.getElementById('bySdr').innerHTML=sdrArr.length?sdrArr.map(([n,d])=>
    `<div class="barrow"><div class="bl">${esc(n)}</div><div class="bartrack"><div class="barfill" style="width:${Math.round(d.t/smax*100)}%"></div><div class="barfill g" style="width:${Math.round(d.c/smax*100)}%;position:absolute;top:0;left:0;opacity:.95"></div></div><div class="bv">${d.t}</div></div>`
  ).join(''):emptyMini('Sem registros por SDR');

  // Daily
  renderDaily(I);

  // Wins
  const wins=[...ativados.map(i=>({...i,k:'ativado'})),...I.filter(i=>i.indicacoes>0).map(i=>({...i,k:'indicacao'}))]
    .sort((a,b)=>b.data.localeCompare(a.data)).slice(0,8);
  document.getElementById('wins').innerHTML=wins.length?wins.map(w=>{
    const c=cliById(w.clienteId);
    const tag=w.k==='ativado'?'<span class="chip good">✓ Ativado</span>':`<span class="chip warn">★ ${w.indicacoes} indicação(ões)</span>`;
    return `<div class="spot"><div class="av">${esc((c?.nome||'?')[0])}</div><div class="info"><div class="n">${esc(c?.nome||'Cliente')}</div><div class="m">${fmtDL(w.data)} · ${esc(w.sdr||'')}</div></div>${tag}</div>`;
  }).join(''):emptyMini('As ativações e indicações aparecem aqui');

  // Interesse por serviço
  const sv={};
  conex.filter(i=>i.interesse&&i.servico).forEach(i=>sv[i.servico]=(sv[i.servico]||0)+1);
  const svArr=Object.entries(sv).sort((a,b)=>b[1]-a[1]);
  const svmax=Math.max(1,...svArr.map(s=>s[1]));
  document.getElementById('byService').innerHTML=svArr.length?svArr.map(([n,v])=>bar(n,v,svmax,'g')).join(''):emptyMini('Marque o serviço de interesse ao registrar o contato');
}

function renderDaily(I){
  const days=period==='all'?30:Math.min(period,60);
  const buckets=[];const today=new Date();today.setHours(0,0,0,0);
  for(let k=days-1;k>=0;k--){const d=new Date(today);d.setDate(d.getDate()-k);buckets.push({d,n:0});}
  I.forEach(i=>{const dd=daysAgo(i.data);if(dd>=0&&dd<days)buckets[days-1-dd].n++;});
  const max=Math.max(1,...buckets.map(b=>b.n));
  const step=Math.ceil(days/7);
  document.getElementById('daily').innerHTML=
    `<div class="daily">${buckets.map(b=>`<div class="daycol" title="${b.d.toLocaleDateString('pt-BR')}: ${b.n}"><div class="d" style="height:${Math.round(b.n/max*100)}%"></div></div>`).join('')}</div>`+
    `<div class="dayaxis">${buckets.map((b,k)=>k%step===0?`<span>${b.d.getDate()}/${b.d.getMonth()+1}</span>`:'<span></span>').join('')}</div>`;
}

function kpi(label,num,cls,foot){return `<div class="kpi ${cls}"><div class="label">${label}</div><div class="num">${num}</div><div class="foot">${foot||''}</div></div>`;}
function bar(label,v,max,g){return `<div class="barrow"><div class="bl">${esc(label)}</div><div class="bartrack"><div class="barfill ${g}" style="width:${Math.round(v/max*100)}%"></div></div><div class="bv">${v}</div></div>`;}
function emptyMini(t){return `<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">${t}</div>`;}

/* ============================================================
   POR SDR
   ============================================================ */
function sdrMetrics(sdr,I){
  const mine=I.filter(i=>i.sdr===sdr);
  const conex=mine.filter(i=>i.conexao);
  const interesse=conex.filter(i=>i.interesse).length;
  const ativados=new Set(mine.filter(i=>i.resultado==='ativado').map(i=>i.clienteId)).size;
  const indic=mine.reduce((s,i)=>s+(i.indicacoes||0),0);
  const promot=new Set(mine.filter(i=>i.indicaria).map(i=>i.clienteId)).size;
  const feliz=conex.filter(i=>i.feliz).length;
  const satisBase=conex.filter(i=>i.satisfeito==='1'||i.satisfeito==='0').length;
  const satis=conex.filter(i=>i.satisfeito==='1').length;
  return {
    sdr, contatos:mine.length, conex:conex.length,
    taxaConex:mine.length?Math.round(conex.length/mine.length*100):0,
    interesse, ativados, indic, promot,
    taxaFeliz:conex.length?Math.round(feliz/conex.length*100):0,
    taxaSatis:satisBase?Math.round(satis/satisBase*100):0,
    mine
  };
}

function renderSdr(){
  const I=db.interacoes.filter(i=>inPeriodSdr(i.data));
  const sel=document.getElementById('sdrPick');
  const cur=sel.value;
  sel.innerHTML='<option value="">Todas as SDR (comparativo)</option>'+db.config.sdrs.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  sel.value=cur;
  const box=document.getElementById('sdrContent');

  if(!db.config.sdrs.length){box.innerHTML=`<div class="panel"><div class="panel-body"><div class="empty"><div class="ic">👤</div><h3>Nenhuma SDR cadastrada</h3><p>Cadastre o time em Configurações → Time de SDR / Relacionamento para acompanhar os números individuais.</p></div></div></div>`;return;}

  const pick=sel.value;
  if(!pick){box.innerHTML=renderSdrComparativo(I);return;}
  box.innerHTML=renderSdrDetalhe(pick,I);
}

function renderSdrComparativo(I){
  const data=db.config.sdrs.map(s=>sdrMetrics(s,I)).sort((a,b)=>b.contatos-a.contatos);
  const leader=k=>data.reduce((a,b)=>b[k]>(a?a[k]:-1)?b:a,null);
  const lc=leader('contatos'),la=leader('ativados'),li=leader('indic');
  const head=`<div class="kpis" style="margin-bottom:18px">
    ${kpi('Contatos no período',I.length,'navy',`${db.config.sdrs.length} SDR no time`)}
    ${kpi('Mais contatos',lc&&lc.contatos?esc(lc.sdr):'—','',lc&&lc.contatos?`${lc.contatos} contatos`:'—')}
    ${kpi('Mais ativações',la&&la.ativados?esc(la.sdr):'—','good',la&&la.ativados?`${la.ativados} clientes`:'—')}
    ${kpi('Mais indicações',li&&li.indic?esc(li.sdr):'—','',li&&li.indic?`${li.indic} indicações`:'—')}
  </div>`;
  const rows=data.map((m,idx)=>{
    const medal=idx===0?'🥇 ':idx===1?'🥈 ':idx===2?'🥉 ':'';
    return `<tr style="cursor:pointer" onclick="document.getElementById('sdrPick').value='${escJsSQ(m.sdr)}';renderSdr()">
      <td><div class="cli-name">${medal}${esc(m.sdr)}</div></td>
      <td>${m.contatos}</td>
      <td><span style="color:var(--g)">${m.conex}</span> <span style="color:var(--t3)">· ${m.taxaConex}%</span></td>
      <td>${m.interesse}</td>
      <td>${m.ativados?`<span class="chip good">${m.ativados}</span>`:'<span style="color:var(--t3)">0</span>'}</td>
      <td>${m.indic?`<span class="chip warn">★ ${m.indic}</span>`:'<span style="color:var(--t3)">0</span>'}</td>
      <td>${m.promot||'<span style="color:var(--t3)">0</span>'}</td>
      <td>${m.contatos?m.taxaFeliz+'%':'—'}</td>
    </tr>`;
  }).join('');
  return head+`<div class="tablewrap"><div class="tscroll"><table>
    <thead><tr><th>SDR</th><th>Contatos</th><th>Conexões</th><th>Interesse</th><th>Ativados</th><th>Indicações</th><th>Promotores</th><th>Satisf.</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>
    <p class="imp-hint" style="margin-top:12px">Clique em uma SDR para abrir o detalhe completo dos números dela.</p>`;
}

function renderSdrDetalhe(sdr,I){
  const m=sdrMetrics(sdr,I);
  const kpis=`<div class="kpis">
    ${kpi('Contatos realizados',m.contatos,'navy',`${m.conex} com conexão`)}
    ${kpi('Taxa de conexão',m.taxaConex+'<small>%</small>','',`${m.conex} de ${m.contatos}`)}
    ${kpi('Clientes ativados',m.ativados,'good',m.ativados?'retorno positivo':'—')}
    ${kpi('Indicações geradas',m.indic,'good',`${m.promot} promotores`)}
    ${kpi('Interesse gerado',m.interesse,'',`em ${m.conex} conversas`)}
    ${kpi('Satisfação na ligação',m.taxaFeliz+'<small>%</small>','',`serviço: ${m.taxaSatis}%`)}
  </div>`;

  // por tipo de contato
  const TL=tipos();
  const tCount={};TL.forEach(t=>tCount[t.id]=0);
  m.mine.forEach(i=>{if(tCount[i.tipo]===undefined)tCount[i.tipo]=0;tCount[i.tipo]++;});
  const tmax=Math.max(1,...Object.values(tCount),1);
  const byType=TL.map(t=>{
    const c=TIPO_COLORS[t.color||'neutral']||TIPO_COLORS.neutral;const v=tCount[t.id]||0;
    return `<div class="barrow"><div class="bl">${esc(t.label)}</div><div class="bartrack"><div class="barfill" style="width:${Math.round(v/tmax*100)}%;background:linear-gradient(90deg,${c[1]},${c[0]})"></div></div><div class="bv" style="color:${c[1]}">${v}</div></div>`;
  }).join('')||emptyMini('Sem contatos no período');

  // conquistas (ativações + indicações) desta SDR
  const wins=[...m.mine.filter(i=>i.resultado==='ativado').map(i=>({...i,k:'ativado'})),
              ...m.mine.filter(i=>i.indicacoes>0).map(i=>({...i,k:'indic'}))]
    .sort((a,b)=>b.data.localeCompare(a.data)).slice(0,10);
  const winsHtml=wins.length?wins.map(w=>{
    const c=cliById(w.clienteId);
    const tag=w.k==='ativado'?'<span class="chip good">✓ Ativado</span>':`<span class="chip warn">★ ${w.indicacoes} indic.</span>`;
    return `<div class="spot"><div class="av">${esc((c?.nome||'?')[0])}</div><div class="info"><div class="n">${esc(c?.nome||'Cliente')}</div><div class="m">${fmtDL(w.data)}</div></div>${tag}</div>`;
  }).join(''):emptyMini('As ativações e indicações desta SDR aparecem aqui');

  return kpis+`<div class="grid2">
    <div class="panel"><div class="panel-head"><h3>Contatos por tipo</h3><span class="hint">${esc(sdr)}</span></div><div class="panel-body">${byType}</div></div>
    <div class="panel"><div class="panel-head"><h3>Conquistas</h3><span class="hint">ativações &amp; indicações</span></div><div class="panel-body">${winsHtml}</div></div>
  </div>`;
}

/* ============================================================
   TRABALHO DO DIA
   ============================================================ */
function renderAcoes(){
  // Aniversariantes próximos 7 dias
  const today=new Date();today.setHours(0,0,0,0);
  const aniv=db.clientes.filter(c=>c.nasc).map(c=>{
    const n=parseD(c.nasc);let next=new Date(today.getFullYear(),n.getMonth(),n.getDate());
    if(next<today)next=new Date(today.getFullYear()+1,n.getMonth(),n.getDate());
    return {c,dd:Math.floor((next-today)/864e5),date:next};
  }).filter(x=>x.dd<=7).sort((a,b)=>a.dd-b.dd);
  document.getElementById('aniv').innerHTML=aniv.length?aniv.map(x=>{
    const when=x.dd===0?'Hoje!':x.dd===1?'Amanhã':`em ${x.dd} dias`;
    const msg=`Olá ${x.c.nome.split(' ')[0]}! A equipe da Oliveira & Benedet passa para desejar um feliz aniversário 🎉`;
    return `<div class="spot"><div class="av bd">🎂</div><div class="info"><div class="n">${esc(x.c.nome)}</div><div class="m">${x.date.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})} · <b style="color:var(--gold-2)">${when}</b></div></div><div class="wa">${x.c.tel?`<a class="wabtn" href="${waLink(x.c.tel,msg)}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div></div>`;
  }).join(''):emptyMini('Nenhum aniversário nos próximos 7 dias');

  // Fila de reativação: clientes sem contato há mais tempo (ou nunca)
  const fila=db.clientes.map(c=>({c,last:lastContact(c.id),dd:daysAgo(lastContact(c.id))}))
    .sort((a,b)=>b.dd-a.dd).slice(0,12);
  document.getElementById('reativar').innerHTML=fila.length?fila.map(x=>{
    const txt=x.last?`Último contato ${fmtDL(x.last)} · ${x.dd}d`:'Nunca contatado';
    const msg=`Olá ${x.c.nome.split(' ')[0]}! Aqui é da Oliveira & Benedet. Tudo bem? Passando para saber como você está e se podemos ajudar em algo.`;
    return `<div class="spot"><div class="av">${esc(x.c.nome[0])}</div><div class="info"><div class="n">${esc(x.c.nome)}</div><div class="m">${txt}</div></div><div class="wa">${x.c.tel?`<a class="wabtn alt" href="${waLink(x.c.tel,msg)}" target="_blank" rel="noopener">Abordar</a>`:''}</div></div>`;
  }).join(''):emptyMini('Cadastre clientes para montar a fila');

  // Quentes: interesse demonstrado mas sem ativação registrada depois
  const quentesIds=new Set();
  const quentes=[];
  db.interacoes.filter(i=>i.interesse).sort((a,b)=>b.data.localeCompare(a.data)).forEach(i=>{
    if(quentesIds.has(i.clienteId))return;
    const posteriores=interByCli(i.clienteId).filter(x=>x.data>=i.data&&x.resultado==='ativado');
    if(posteriores.length)return;
    quentesIds.add(i.clienteId);quentes.push(i);
  });
  document.getElementById('quentes').innerHTML=quentes.length?quentes.slice(0,15).map(i=>{
    const c=cliById(i.clienteId);
    return `<div class="spot"><div class="av">${esc((c?.nome||'?')[0])}</div><div class="info"><div class="n">${esc(c?.nome||'Cliente')}</div><div class="m">Interesse em <b>${esc(i.servico||'serviço')}</b> · ${fmtDL(i.data)} · ${esc(i.sdr||'')}</div></div><button class="rowbtn" onclick="openInter('${escJsSQ(i.id)}')">Atualizar</button>${c?.tel?`<a class="wabtn" style="margin-left:8px" href="${waLink(c.tel,'Olá '+(c.nome.split(' ')[0])+'! Retomando nossa conversa sobre '+(i.servico||'os serviços')+'.')}" target="_blank" rel="noopener">WhatsApp</a>`:''}</div>`;
  }).join(''):emptyMini('Quando um cliente demonstrar interesse, ele aparece aqui para acompanhamento');
}

/* ============================================================
   INTERAÇÕES (tabela)
   ============================================================ */
function renderInter(){
  // popular filtros (SDR e Tipo) a partir do config, preservando a seleção
  const fs=document.getElementById('interFilterSdr');
  const fsVal=fs.value;
  fs.innerHTML='<option value="">Todos os SDR</option>'+db.config.sdrs.map(s=>`<option>${esc(s)}</option>`).join('');
  fs.value=fsVal;
  const ftSel=document.getElementById('interFilterTipo');
  const ftVal=ftSel.value;
  ftSel.innerHTML='<option value="">Todos os tipos</option>'+tipos().map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
  ftSel.value=ftVal;
  const q=(document.getElementById('interSearch').value||'').toLowerCase();
  const ft=ftSel.value;
  const fsdr=fs.value;
  let rows=db.interacoes.slice().sort((a,b)=>b.data.localeCompare(a.data));
  rows=rows.filter(i=>{
    if(ft&&i.tipo!==ft)return false;
    if(fsdr&&i.sdr!==fsdr)return false;
    if(q){const c=cliById(i.clienteId);const hay=`${c?.nome||''} ${i.sdr||''} ${i.obs||''}`.toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
  const tb=document.getElementById('interBody');
  if(!rows.length){tb.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="ic">📋</div><h3>Nenhuma interação registrada</h3><p>Cada ligação, mensagem ou retorno do time vira um registro aqui. É a base de todas as métricas.</p><button class="btn primary" onclick="openInter()">Registrar primeiro contato</button></div></td></tr>`;return;}
  tb.innerHTML=rows.map(i=>{
    const c=cliById(i.clienteId);
    const res=i.resultado==='ativado'?'<span class="chip good">✓ Ativado</span>':i.resultado==='acompanhar'?'<span class="chip warn">↻ Acompanhar</span>':(i.conexao?'<span class="chip ghost">Sem retorno</span>':'<span class="chip bad">Não atendeu</span>');
    const sinais=[];
    if(i.feliz)sinais.push('<span class="chip good">😊 Feliz</span>');
    if(i.interesse)sinais.push(`<span class="chip warn">Interesse${i.servico?': '+esc(i.servico):''}</span>`);
    if(i.indicaria)sinais.push('<span class="chip good">Indicaria</span>');
    if(i.indicacoes>0)sinais.push(`<span class="chip warn">★ ${i.indicacoes} indic.</span>`);
    return `<tr>
      <td>${fmtD(i.data)}</td>
      <td><div class="cli-name">${esc(c?.nome||'—')}</div>${i.obs?`<div class="cli-sub">${esc(i.obs.slice(0,46))}${i.obs.length>46?'…':''}</div>`:''}</td>
      <td>${tipoChip(i.tipo)}</td>
      <td>${esc(i.sdr||'—')}</td>
      <td>${res}</td>
      <td><div style="display:flex;gap:5px;flex-wrap:wrap">${sinais.join('')||'<span style="color:var(--muted)">—</span>'}</div></td>
      <td style="white-space:nowrap"><button class="rowbtn" onclick="openInter('${escJsSQ(i.id)}')">Editar</button> <button class="rowbtn danger" onclick="delInter('${escJsSQ(i.id)}')">×</button></td>
    </tr>`;
  }).join('');
}

/* ============================================================
   CLIENTES (tabela)
   ============================================================ */
function renderCli(){
  const q=(document.getElementById('cliSearch').value||'').toLowerCase();
  const f=document.getElementById('cliFilter').value;
  let rows=db.clientes.slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  rows=rows.filter(c=>{
    const inter=interByCli(c.id);
    if(f==='proc'&&!c.proc)return false;
    if(f==='noproc'&&c.proc)return false;
    if(f==='sem'&&inter.length)return false;
    if(f==='promotor'&&!inter.some(i=>i.indicaria))return false;
    if(f==='indicado'&&!c.indicadoPor)return false;
    if(q){if(!(`${c.nome} ${c.tel||''}`.toLowerCase().includes(q)))return false;}
    return true;
  });
  const tb=document.getElementById('cliBody');
  if(!rows.length){tb.innerHTML=`<tr><td colspan="6"><div class="empty"><div class="ic">👥</div><h3>Nenhum cliente na carteira</h3><p>Cadastre os clientes do escritório para começar a registrar contatos e medir o relacionamento.</p><button class="btn primary" onclick="openCli()">Cadastrar cliente</button></div></td></tr>`;return;}
  tb.innerHTML=rows.map(c=>{
    const inter=interByCli(c.id);
    const last=inter.length?inter[0].data:null;
    const dd=daysAgo(last);
    const ativado=inter.some(i=>i.resultado==='ativado');
    const promotor=inter.some(i=>i.indicaria);
    const indics=inter.reduce((s,i)=>s+(i.indicacoes||0),0);
    const refNome=c.indicadoPor?((cliById(c.indicadoPor)||{}).nome||''):'';
    let sit='<span class="chip ghost">Novo</span>';
    if(ativado)sit='<span class="chip good">✓ Ativado</span>';
    else if(promotor)sit='<span class="chip warn">★ Promotor</span>';
    else if(c.indicadoPor)sit='<span class="chip aniversario">★ Indicado</span>';
    else if(inter.length)sit='<span class="chip minerar">Em relacionamento</span>';
    const lastTxt=last?`${fmtD(last)} <span style="color:var(--muted)">· ${dd}d</span>`:'<span style="color:var(--muted)">nunca</span>';
    const msg=`Olá ${c.nome.split(' ')[0]}! Aqui é da Oliveira & Benedet.`;
    return `<tr>
      <td><div class="cli-name">${esc(c.nome)}</div><div class="cli-sub">${esc(c.tel||'sem telefone')}${refNome?` · indicado por ${esc(refNome)}`:''}${indics?` · gerou ${indics} indicação(ões)`:''}</div></td>
      <td>${c.proc?`<span class="chip good">Sim</span> <span class="cli-sub">${esc(c.area||'')}</span>`:'<span class="chip ghost">Não</span>'}</td>
      <td>${lastTxt}</td>
      <td>${inter.length}</td>
      <td>${sit}</td>
      <td style="white-space:nowrap">
        ${c.tel?`<a class="rowbtn" href="${waLink(c.tel,msg)}" target="_blank" rel="noopener">Wpp</a> `:''}
        <button class="rowbtn" onclick="openInter();setTimeout(()=>{document.getElementById('iCliente').value='${escJsSQ(c.id)}'},30)">+Contato</button>
        <button class="rowbtn" onclick="openCli('${escJsSQ(c.id)}')">Editar</button>
        <button class="rowbtn danger" onclick="delCli('${escJsSQ(c.id)}')">×</button>
      </td>
    </tr>`;
  }).join('');
}

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */
function renderCfg(){
  drawTags('sdrs','sdrTags');drawTags('servicos','servTags');drawTags('areas','areaTags');drawTags('origens','origTags');
  drawTipos();
}
function drawTags(key,el){
  const node=document.getElementById(el);if(!node)return;
  node.innerHTML=(db.config[key]||[]).map((t,k)=>
    `<span class="tagchip">${esc(t)}<button onclick="rmTag('${key}',${k})" title="Remover">×</button></span>`
  ).join('')||`<span style="color:var(--muted);font-size:13px">Nenhum cadastrado</span>`;
}
function addTag(key,inputId){
  const inp=document.getElementById(inputId);const v=inp.value.trim();
  if(!v)return;if((db.config[key]||[]).includes(v)){toast('Já existe');return;}
  (db.config[key]=db.config[key]||[]).push(v);inp.value='';save();renderCfg();afterConfigChange();
}
function rmTag(key,idx){db.config[key].splice(idx,1);save();renderCfg();afterConfigChange();}

/* ---- Tipos de contato (editor com cor) ---- */
function drawTipos(){
  const el=document.getElementById('tipoList');if(!el)return;
  const usos={};db.interacoes.forEach(i=>{usos[i.tipo]=(usos[i.tipo]||0)+1;});
  el.innerHTML=tipos().map((t,k)=>{
    const c=TIPO_COLORS[t.color||'neutral']||TIPO_COLORS.neutral;
    const n=usos[t.id]||0;
    const opts=['gold','blue','green','purple','amber','rose','neutral'].map(col=>`<option value="${col}"${t.color===col?' selected':''}>${({gold:'Dourado',blue:'Azul',green:'Verde',purple:'Roxo',amber:'Âmbar',rose:'Rosé',neutral:'Neutro'})[col]}</option>`).join('');
    return `<div class="ind-row" style="grid-template-columns:14px 1fr 130px auto;align-items:center">
      <span style="width:12px;height:12px;border-radius:50%;background:${c[1]};display:inline-block"></span>
      <input value="${esc(t.label)}" onchange="renameTipo('${t.id}',this.value)" placeholder="Nome do tipo">
      <select class="rowbtn" style="padding:8px 10px" onchange="recolorTipo('${t.id}',this.value)">${opts}</select>
      <button class="ind-rm" title="Remover" onclick="rmTipo('${t.id}')">×</button>
      ${n?`<div style="grid-column:2/-1;font-size:11px;color:var(--t3);margin-top:-3px">${n} contato(s) usam este tipo</div>`:''}
    </div>`;
  }).join('')||`<div class="ind-empty">Nenhum tipo cadastrado.</div>`;
}
function addTipo(){
  const inp=document.getElementById('tipoNome');const v=inp.value.trim();if(!v)return;
  const cor=document.getElementById('tipoCor').value;
  if(tipos().some(t=>t.label.toLowerCase()===v.toLowerCase())){toast('Já existe um tipo com esse nome');return;}
  db.config.tipos.push({id:uid(),label:v,color:cor});inp.value='';
  save();renderCfg();afterConfigChange();toast('Tipo adicionado');
}
function renameTipo(id,val){const t=tipoOf(id);if(!t)return;val=val.trim();if(!val)return;t.label=val;save();afterConfigChange();}
function recolorTipo(id,col){const t=tipoOf(id);if(!t)return;t.color=col;save();drawTipos();afterConfigChange();}
function rmTipo(id){
  const n=db.interacoes.filter(i=>i.tipo===id).length;
  if(n&&!confirm(`${n} contato(s) usam este tipo. Eles continuarão registrados, mas sem cor/rótulo definidos. Remover mesmo assim?`))return;
  db.config.tipos=db.config.tipos.filter(t=>t.id!==id);
  save();renderCfg();afterConfigChange();toast('Tipo removido');
}
/* re-render dependent views when option lists change */
function afterConfigChange(){
  if(document.getElementById('view-dash').classList.contains('active'))renderDash();
  if(document.getElementById('view-inter').classList.contains('active'))renderInter();
  if(document.getElementById('view-sdr').classList.contains('active'))renderSdr();
}

/* ============================================================
   EXPORT / IMPORT / SAMPLE
   ============================================================ */
function exportJSON(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`OB_relacionamento_${todayISO()}.json`;a.click();toast('Backup baixado');
}
async function importJSON(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async()=>{
    try{
      const p=JSON.parse(r.result);
      if(!Array.isArray(p.clientes)||!Array.isArray(p.interacoes))throw 0;
      const next={...structuredClone(DEF),...p,config:{...DEF.config,...(p.config||{})}};
      const total=next.clientes.length+next.interacoes.length+1;
      if(!currentUser){toast('Faça login antes de restaurar o backup');return;}
      if(!confirm(`O backup contém ${next.clientes.length} cliente(s), ${next.interacoes.length} interação(ões) e 1 configuração. Enviar ${total} registro(s) para o Firestore?`))return;
      db=next;
      renderAll();
      await persistDb();
      toast(`Backup efetivado · ${total} registro(s) enviados`);
    }catch(e){console.error(e);toast('Arquivo inválido ou falha ao enviar o backup');}
  };
  r.readAsText(f);ev.target.value='';
}
function exportCSV(){
  const head=['Cliente','Telefone','Teve processo','Area','Nascimento','Ultimo contato','Total contatos','Ativado','Promotor','Indicacoes'];
  const lines=[head.join(';')];
  db.clientes.forEach(c=>{
    const it=interByCli(c.id);
    lines.push([
      c.nome,c.tel||'',c.proc?'Sim':'Nao',c.area||'',c.nasc||'',lastContact(c.id)||'',it.length,
      it.some(i=>i.resultado==='ativado')?'Sim':'Nao',
      it.some(i=>i.indicaria)?'Sim':'Nao',
      it.reduce((s,i)=>s+(i.indicacoes||0),0)
    ].map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';'));
  });
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`OB_carteira_${todayISO()}.csv`;a.click();toast('CSV exportado');
}
function wipeAll(){if(!confirm('Apagar TODOS os dados (clientes, interações e configurações)? Esta ação não pode ser desfeita.'))return;db=structuredClone(DEF);save();renderDash();renderCli();renderInter();renderCfg();renderAcoes();toast('Tudo apagado');}

function loadSample(){
  if(db.clientes.length&&!confirm('Isso adiciona clientes de exemplo aos dados atuais. Continuar?'))return;
  const sdrs=db.config.sdrs;const servs=db.config.servicos;const areas=db.config.areas;
  const nomes=['Maria Aparecida Silva','João Batista Souza','Rosa Mendes','Antônio Carlos Lima','Ivete Gonçalves','Pedro Henrique Alves','Cleusa Martins','Sebastião Ferreira','Marlene Costa','Geraldo Pereira'];
  const tel=()=>'(48) 9 '+(8000+Math.floor(Math.random()*1999))+'-'+(1000+Math.floor(Math.random()*8999));
  const rd=(a)=>a[Math.floor(Math.random()*a.length)];
  const dISO=(daysBack)=>{const d=new Date();d.setDate(d.getDate()-daysBack);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const newCli=[];
  nomes.forEach((n,k)=>{
    const proc=Math.random()>.4;
    const bd=new Date();bd.setFullYear(bd.getFullYear()-(40+k));bd.setDate(bd.getDate()+(k<3?k+1:30+k));
    const c={id:uid(),nome:n,tel:tel(),proc,area:proc?rd(areas):'',nasc:`${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,'0')}-${String(bd.getDate()).padStart(2,'0')}`,origem:rd(['Indicação','Cliente antigo','Tráfego pago','Balcão']),obs:'',criadoEm:dISO(60)};
    newCli.push(c);db.clientes.push(c);
  });
  newCli.forEach((c,k)=>{
    const nInter=1+Math.floor(Math.random()*3);
    for(let j=0;j<nInter;j++){
      const conexao=Math.random()>.25;
      const interesse=conexao&&Math.random()>.5;
      const ativado=interesse&&Math.random()>.5;
      const indicaria=conexao&&Math.random()>.6;
      db.interacoes.push({
        id:uid(),clienteId:c.id,data:dISO(Math.floor(Math.random()*55)),
        sdr:rd(sdrs),tipo:rd(['minerar','ativar','informacao','aniversario','inbound']),
        conexao,feliz:conexao&&Math.random()>.3,
        satisfeito:conexao?(Math.random()>.3?'1':(Math.random()>.5?'0':'na')):null,
        interesse,servico:interesse?rd(servs):'',
        indicaria,indicacoes:indicaria&&Math.random()>.5?1:0,
        resultado:ativado?'ativado':(conexao&&Math.random()>.5?'acompanhar':'nenhum'),
        obs:''
      });
    }
  });
  save();toast('Dados de exemplo carregados');renderDash();renderCli();renderInter();renderCfg();renderAcoes();
}

/* ============================================================
   IMPORTAR CLIENTES (CSV / XLSX) — sem dependências externas
   ============================================================ */
let impRows=[];
const FIELD_HINTS={
  nome:['nome','cliente','razao','razão','contratante'],
  tel:['telefone','tel','fone','celular','whatsapp','zap','contato','cel'],
  proc:['processo','atendimento','é cliente','e cliente','ja teve','já teve','possui processo','tem processo'],
  area:['area','área','assunto','materia','matéria','nucleo','núcleo','setor'],
  nasc:['nascimento','aniversario','aniversário','data nasc','dt nasc','nasc','data de nascimento'],
  origem:['origem','como chegou','fonte','canal','captacao','captação'],
  obs:['obs','observacao','observação','observacoes','observações','nota','notas','detalhe']
};
const IMP_FIELDS=[['nome','Nome do cliente *'],['tel','Telefone / WhatsApp'],['proc','Teve processo/atendimento'],['area','Área do processo'],['nasc','Data de nascimento'],['origem','Origem'],['obs','Observações']];

function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function pad2(n){return String(n).padStart(2,'0');}
function decodeXML(s){return String(s||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&amp;/g,'&');}
function colIdx(ref){const m=ref.match(/^[A-Z]+/);let n=0;for(const ch of m[0])n=n*26+(ch.charCodeAt(0)-64);return n-1;}
function truthy(v){return ['sim','s','1','true','x','yes','y','verdadeiro','✓'].includes(norm(v));}
function keyOf(nome,tel){return norm(nome)+'|'+telDigits(tel);}

function normDate(v){
  v=String(v||'').trim();if(!v)return '';
  let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m)return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m=v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){let d=+m[1],mo=+m[2],y=m[3];if(y.length===2)y=(+y>30?'19':'20')+y;y=+y;
    if(mo>12&&d<=12){const t=d;d=mo;mo=t;} // tolera mm/dd
    if(d>=1&&d<=31&&mo>=1&&mo<=12)return `${y}-${pad2(mo)}-${pad2(d)}`;return '';}
  if(/^\d+(\.\d+)?$/.test(v)){const n=parseFloat(v);if(n>15000&&n<60000){const ms=Date.UTC(1899,11,30)+Math.round(n)*864e5;const d=new Date(ms);return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;}}
  return '';
}

function parseCSV(text){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  const firstLine=(text.split(/\r?\n/).find(l=>l.trim().length)||'');
  const delim=firstLine.split(';').length>firstLine.split(',').length?';':(firstLine.split('\t').length>firstLine.split(',').length?'\t':',');
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else{if(ch==='"')q=true;else if(ch===delim){row.push(cur);cur='';}
      else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur='';}
      else if(ch==='\r'){}else cur+=ch;}
  }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  return rows.filter(r=>r.some(c=>String(c).trim().length));
}

async function parseXLSX(buf){
  const bytes=new Uint8Array(buf),dv=new DataView(buf);
  let eocd=-1;for(let i=bytes.length-22;i>=0;i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error('zip inválido');
  const cdOff=dv.getUint32(eocd+16,true),cdCnt=dv.getUint16(eocd+10,true);
  const entries={};let p=cdOff;
  for(let k=0;k<cdCnt;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),compSize=dv.getUint32(p+20,true);
    const nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true);
    const localOff=dv.getUint32(p+42,true);
    const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+nameLen));
    const lNameLen=dv.getUint16(localOff+26,true),lExtraLen=dv.getUint16(localOff+28,true);
    const dataStart=localOff+30+lNameLen+lExtraLen;
    entries[name]={method,comp:bytes.subarray(dataStart,dataStart+compSize)};
    p+=46+nameLen+extraLen+commentLen;
  }
  async function read(name){const e=entries[name];if(!e)return null;
    if(e.method===0)return new TextDecoder().decode(e.comp);
    if(typeof DecompressionStream==='undefined')throw new Error('nodecomp');
    const ds=new DecompressionStream('deflate-raw');
    const ab=await new Response(new Blob([e.comp]).stream().pipeThrough(ds)).arrayBuffer();
    return new TextDecoder().decode(new Uint8Array(ab));
  }
  const ssXml=await read('xl/sharedStrings.xml');const shared=[];
  if(ssXml){let m;const re=/<si>([\s\S]*?)<\/si>/g;
    while((m=re.exec(ssXml))){const txt=(m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join('');shared.push(decodeXML(txt));}}
  const sheetName=Object.keys(entries).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a,b)=>(+a.match(/sheet(\d+)/)[1])-(+b.match(/sheet(\d+)/)[1]))[0];
  if(!sheetName)throw new Error('sem planilha');
  const sx=await read(sheetName);const rows=[];let rm;const rowRe=/<row[^>]*>([\s\S]*?)<\/row>/g;
  while((rm=rowRe.exec(sx))){const cells=[];let cm;const cellRe=/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    while((cm=cellRe.exec(rm[1]))){const attrs=cm[1],inner=cm[2]||'';
      const ref=(attrs.match(/r="([A-Z]+)\d+"/)||[])[1];
      const t=(attrs.match(/t="([^"]+)"/)||[])[1];let val='';
      if(t==='s'){const vi=(inner.match(/<v>([\s\S]*?)<\/v>/)||[])[1];val=shared[+vi]||'';}
      else if(t==='inlineStr'){val=decodeXML((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1]||'');}
      else{val=decodeXML((inner.match(/<v>([\s\S]*?)<\/v>/)||[])[1]||'');}
      const ci=ref?colIdx(ref):cells.length;cells[ci]=val;
    }
    for(let i=0;i<cells.length;i++)if(cells[i]===undefined)cells[i]='';
    rows.push(cells);
  }
  return rows.filter(r=>r.some(c=>String(c).trim().length));
}

function openImport(){
  impRows=[];
  document.getElementById('impStep1').style.display='block';
  document.getElementById('impStep2').style.display='none';
  document.getElementById('impBackBtn').style.display='none';
  document.getElementById('impDoBtn').style.display='none';
  document.getElementById('impHeader').checked=true;
  document.getElementById('impDedupe').checked=true;
  document.getElementById('importModal').classList.add('show');
}
function impBack(){
  document.getElementById('impStep1').style.display='block';
  document.getElementById('impStep2').style.display='none';
  document.getElementById('impBackBtn').style.display='none';
  document.getElementById('impDoBtn').style.display='none';
}

async function handleImportFile(ev){
  const f=ev.target.files[0];if(!f)return;
  const ext=f.name.toLowerCase().split('.').pop();
  try{
    if(ext==='csv'){impRows=parseCSV(await f.text());}
    else if(ext==='xlsx'){impRows=await parseXLSX(await f.arrayBuffer());}
    else if(ext==='xls'){toast('Formato .xls antigo não é lido aqui — abra no Excel e salve como .xlsx ou .csv');ev.target.value='';return;}
    else{toast('Use um arquivo .csv ou .xlsx');ev.target.value='';return;}
  }catch(e){
    console.error(e);
    toast(String(e.message).includes('nodecomp')?'Este navegador não lê .xlsx — exporte a planilha como CSV':'Não consegui ler o arquivo. Tente salvá-lo como CSV.');
    ev.target.value='';return;
  }
  ev.target.value='';
  if(!impRows.length){toast('O arquivo está vazio.');return;}
  document.getElementById('impStep1').style.display='none';
  document.getElementById('impStep2').style.display='block';
  document.getElementById('impBackBtn').style.display='inline-flex';
  document.getElementById('impDoBtn').style.display='inline-flex';
  showMapping();
}

function guessCol(field,labels,useHeader){
  if(!useHeader)return field==='nome'?0:-1;
  const hints=FIELD_HINTS[field];
  for(let i=0;i<labels.length;i++){const h=norm(labels[i]);if(h&&hints.some(x=>h.includes(norm(x))))return i;}
  return -1;
}
function showMapping(){
  const useHeader=document.getElementById('impHeader').checked;
  const colCount=Math.max(...impRows.map(r=>r.length));
  const headerRow=useHeader?impRows[0]:null;
  const labels=[];for(let i=0;i<colCount;i++)labels.push(useHeader?(((headerRow[i]||'').trim())||`Coluna ${i+1}`):`Coluna ${i+1}`);
  const opts='<option value="-1">— ignorar —</option>'+labels.map((l,i)=>`<option value="${i}">${esc(l)}</option>`).join('');
  document.getElementById('impMapping').innerHTML=IMP_FIELDS.map(([f,lab])=>
    `<div class="mrow"><label>${lab}</label><select data-f="${f}">${opts}</select></div>`).join('');
  IMP_FIELDS.forEach(([f])=>{const sel=document.querySelector(`#impMapping select[data-f="${f}"]`);sel.value=String(guessCol(f,labels,useHeader));sel.onchange=updatePreview;});
  updatePreview();
}

function buildImportRecords(){
  const useHeader=document.getElementById('impHeader').checked;
  const dataRows=useHeader?impRows.slice(1):impRows.slice();
  const map={};document.querySelectorAll('#impMapping select').forEach(s=>map[s.dataset.f]=+s.value);
  const dedupe=document.getElementById('impDedupe').checked;
  const existing=new Set(db.clientes.map(c=>keyOf(c.nome,c.tel)));
  const seen=new Set();const recs=[];let semNome=0,dups=0;
  dataRows.forEach(r=>{
    const get=f=>map[f]>=0?String(r[map[f]]??'').trim():'';
    const nome=get('nome');if(!nome){semNome++;return;}
    const tel=get('tel');const k=keyOf(nome,tel);
    if((dedupe&&existing.has(k))||seen.has(k)){dups++;return;}
    seen.add(k);
    const area=get('area');const proc=map.proc>=0?truthy(get('proc')):!!area;
    recs.push({id:uid(),nome,tel,proc,area:proc?area:'',nasc:normDate(get('nasc')),origem:get('origem'),obs:get('obs'),criadoEm:todayISO()});
  });
  return {recs,semNome,dups,noNomeCol:map.nome<0};
}

function updatePreview(){
  const {recs,semNome,dups,noNomeCol}=buildImportRecords();
  const el=document.getElementById('impPreview');
  if(noNomeCol){el.innerHTML='⚠️ <span class="warn">Selecione qual coluna contém o <b>nome do cliente</b> para continuar.</span>';return;}
  const parts=[`<b>${recs.length}</b> cliente(s) serão importados.`];
  if(dups)parts.push(`${dups} ignorado(s) por já existirem na carteira.`);
  if(semNome)parts.push(`${semNome} linha(s) sem nome foram descartadas.`);
  el.innerHTML=parts.join('<br>');
}

function doImport(){
  const {recs,noNomeCol}=buildImportRecords();
  if(noNomeCol){toast('Selecione a coluna do nome do cliente');return;}
  if(!recs.length){toast('Nenhum cliente novo para importar');return;}
  db.clientes=[...recs,...db.clientes];
  save();closeModal('importModal');
  toast(`${recs.length} cliente(s) importados`);
  renderCli();renderDash();renderAcoes();
}

function downloadTemplate(){
  const head=['Nome','Telefone','Teve processo','Área','Nascimento','Origem','Observações'];
  const ex=['Maria Aparecida Silva','(48) 9 9999-1234','Sim','Previdenciário','1965-03-12','Indicação','Cliente antiga'];
  const csv='\ufeff'+[head.join(';'),ex.map(x=>`"${x}"`).join(';')].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='modelo_clientes_OB.csv';a.click();toast('Modelo baixado');
}

/* ============================================================
   INIT
   ============================================================ */
renderDash();
createFirebaseUI();
initFirebase();