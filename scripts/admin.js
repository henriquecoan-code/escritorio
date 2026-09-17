const ADMIN_SECURITY_DOC='security';
const ADMIN_USERS_COLLECTION='admin_users';
const PANEL_LABELS={dashboard:'Dashboard',financeiro:'Financeiro',relacionamento:'Relacionamento',admin:'Administração'};
let adminAuth=null;
let adminDb=null;
let adminUser=null;
let secondaryAuthApp=null;
let users=[];

const byId=id=>document.getElementById(id);
async function loadBrandLogo(){
  try{
    const response=await fetch('scripts/dashboard.js');
    if(!response.ok)return;
    const match=(await response.text()).match(/const LOGO_B64\s*=\s*'([^']+)'/);
    if(match)byId('admin-logo').src=match[1];
  }catch(error){console.warn('Não foi possível carregar o logo.',error);}
}
function setStatus(message,type=''){const el=byId('admin-status');el.textContent=message;el.className=`admin-status ${type}`;}
function authMessage(error){
  if(error?.code==='auth/invalid-credential')return 'Email ou senha incorretos.';
  if(error?.code==='auth/invalid-email')return 'Informe um email válido.';
  return 'Não foi possível concluir o acesso.';
}
function setAuthError(message){byId('admin-auth-error').textContent=message||'';}
function setAuthOpen(open){byId('admin-auth-overlay').classList.toggle('open',open);document.body.style.overflow=open?'hidden':'';}
function renderUsers(){
  const list=byId('user-list');
  if(!users.length){list.innerHTML='<div class="user-card"><div><strong>Nenhum acesso configurado</strong><small>Use Novo usuário para cadastrar o primeiro perfil.</small></div></div>';return;}
  list.innerHTML=users.map(user=>{
    const panels=Object.entries(PANEL_LABELS).map(([key,label])=>`<span class="access-chip ${user.panels?.[key]?'on':''}">${label}</span>`).join('');
    const email=user.email||user.id;
    return `<article class="user-card"><div><strong>${escapeHtml(user.displayName||email)}</strong><small>${escapeHtml(email)} · ${user.active===false?'inativo':'ativo'}</small></div><div class="user-access">${panels}<button class="admin-link" data-edit-user="${escapeAttr(email)}" type="button">Editar</button></div></article>`;
  }).join('');
  list.querySelectorAll('[data-edit-user]').forEach(button=>button.addEventListener('click',()=>openEditor(button.dataset.editUser)));
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function escapeAttr(value){return escapeHtml(value).replace(/`/g,'&#96;');}
function openEditor(email=''){
  const user=users.find(item=>item.id===email||item.email===email)||{id:'',email:'',displayName:'',active:true,panels:{dashboard:true,financeiro:false,relacionamento:false,admin:false}};
  byId('user-editor').hidden=false;
  byId('editor-title').textContent=email?'Editar usuário':'Novo usuário';
  byId('user-email').value=user.email||email;byId('user-email').readOnly=!!email;
  byId('user-password').value='';
  byId('user-password').required=!email;
  byId('user-password').placeholder=email?'Nova senha (deixe vazio para manter)':'Senha inicial (mínimo 6 caracteres)';
  byId('delete-user').disabled=!email;
  byId('user-name').value=user.displayName||'';byId('user-active').checked=user.active!==false;
  byId('access-dashboard').checked=!!user.panels?.dashboard;byId('access-financeiro').checked=!!user.panels?.financeiro;byId('access-relacionamento').checked=!!user.panels?.relacionamento;byId('access-admin').checked=!!user.panels?.admin;
  if(email) byId('user-name').focus(); else byId('user-email').focus();
}
function closeEditor(){byId('user-editor').hidden=true;byId('user-form').reset();byId('user-email').readOnly=false;}
async function deleteUser(){
  const email=byId('user-email').value.trim().toLowerCase();
  if(!email||byId('user-email').readOnly===false)return;
  if(!confirm(`Excluir o acesso de ${email}? O usuário não poderá mais acessar os painéis permitidos.`))return;
  try{
    await adminDb.collection(ADMIN_USERS_COLLECTION).doc(email).delete();
    closeEditor();
    await loadUsers();
    setStatus('Acesso do usuário excluído. A conta de autenticação permanece no Firebase e pode ser removida pelo Console ou por uma função administrativa.','ok');
  }catch(error){
    console.error(error);
    setStatus('Não foi possível excluir o acesso deste usuário.','error');
  }
}
async function createAuthUser(email,password){
  if(!secondaryAuthApp){
    secondaryAuthApp=firebase.initializeApp(window.OB_FIREBASE_CONFIG,'admin-user-provisioning');
  }
  const secondaryAuth=firebase.auth(secondaryAuthApp);
  try{
    await secondaryAuth.createUserWithEmailAndPassword(email,password);
  }finally{
    await secondaryAuth.signOut().catch(()=>{});
  }
}
async function loadUsers(){
  const snapshot=await adminDb.collection(ADMIN_USERS_COLLECTION).get();
  users=snapshot.docs.map(doc=>({id:doc.id,email:doc.data().email||doc.id,...doc.data()}));
  users.sort((a,b)=>(a.email||'').localeCompare(b.email||''));
  renderUsers();
}
async function saveUser(event){
  event.preventDefault();
  const email=byId('user-email').value.trim().toLowerCase();
  if(!email){setStatus('Informe o email do usuário.','error');return;}
  const password=byId('user-password').value;
  const isNew=!byId('user-email').readOnly;
  if(isNew&&password.length<6){setStatus('Informe uma senha inicial com pelo menos 6 caracteres.','error');return;}
  const data={email:email,displayName:byId('user-name').value.trim(),active:byId('user-active').checked,panels:{dashboard:byId('access-dashboard').checked,financeiro:byId('access-financeiro').checked,relacionamento:byId('access-relacionamento').checked,admin:byId('access-admin').checked},updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  try{
    if(isNew)await createAuthUser(email,password);
    await adminDb.collection(ADMIN_USERS_COLLECTION).doc(email).set(data,{merge:true});
    closeEditor();await loadUsers();setStatus(isNew?'Usuário criado. Ele já pode entrar com o email e a senha informados.':'Acesso salvo.','ok');
  }catch(error){
    console.error(error);
    const message=error?.code==='auth/email-already-in-use'?'Este email já possui uma conta no Firebase Authentication. Use outro email ou edite o acesso existente.':error?.code==='auth/weak-password'?'A senha precisa ter pelo menos 6 caracteres.':'Não foi possível criar o usuário e salvar este acesso.';
    setStatus(message,'error');
  }
}
function startAdmin(){
  const app=firebase.apps.length?firebase.app():firebase.initializeApp(window.OB_FIREBASE_CONFIG);
  adminAuth=firebase.auth(app);adminDb=firebase.firestore(app);
  byId('admin-auth-form').addEventListener('submit',async event=>{event.preventDefault();setAuthError('');try{await adminAuth.signInWithEmailAndPassword(byId('admin-auth-email').value.trim(),byId('admin-auth-password').value);}catch(error){setAuthError(authMessage(error));}});
  byId('admin-auth-forgot').addEventListener('click',async()=>{try{await adminAuth.sendPasswordResetEmail(byId('admin-auth-email').value.trim());setAuthError('Enviamos um link de recuperação para seu email.');}catch(error){setAuthError(authMessage(error));}});
  byId('admin-logout').addEventListener('click',()=>adminAuth.signOut());
  byId('new-user').addEventListener('click',()=>openEditor());byId('delete-user').addEventListener('click',deleteUser);byId('cancel-user').addEventListener('click',closeEditor);byId('user-form').addEventListener('submit',saveUser);
  adminAuth.onAuthStateChanged(async user=>{
    adminUser=user||null;byId('admin-user').textContent=user?.email||'';byId('admin-logout').hidden=!user;
    if(!user){
      users=[];
      renderUsers();
      closeEditor();
      setAuthOpen(true);
      return;
    }
    try{
      const security=await adminDb.collection('meta').doc(ADMIN_SECURITY_DOC).get();
      const securityData=security.data()||{};
      const adminUids=Array.isArray(securityData.adminUids)?securityData.adminUids:[];
      let adminEmails=[];
      if(Array.isArray(securityData.adminEmails)){
        adminEmails=securityData.adminEmails.map(e=>String(e).toLowerCase().trim());
      }else if(typeof securityData.adminEmails==='string'){
        adminEmails=[securityData.adminEmails.toLowerCase().trim()];
      }
      const currentUserEmail=(user.email||'').toLowerCase().trim();
      const isOwner=adminUids.includes(user.uid)||(currentUserEmail&&adminEmails.includes(currentUserEmail));
      if(!isOwner){
        users=[];
        renderUsers();
        closeEditor();
        setAuthOpen(false);
        setStatus(`A conta logada (${currentUserEmail}) não possui permissão de proprietário. Verifique se o e-mail está em meta/security -> adminEmails.`,'error');
        byId('new-user').disabled=true;
        return;
      }
      byId('new-user').disabled=false;
      setAuthOpen(false);
      try{
        await loadUsers();
        setStatus('Acesso de proprietário confirmado.');
      }catch(err){
        console.error('Erro ao carregar usuários:',err);
        setStatus('Acesso confirmado, mas ocorreu um erro ao listar usuários: '+(err.message||err),'error');
      }
    }catch(error){
      console.error('Erro ao verificar permissão:',error);
      setAuthOpen(false);
      setStatus('Não foi possível verificar as permissões no Firestore: '+(error.message||error),'error');
    }
  });
}
loadBrandLogo();
if(typeof firebase==='undefined'||!window.OB_FIREBASE_CONFIG){setAuthOpen(true);setAuthError('Firebase não está configurado.');}else{startAdmin();}
