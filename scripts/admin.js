const ADMIN_SECURITY_DOC='security';
const ADMIN_USERS_COLLECTION='admin_users';
const PANEL_LABELS={dashboard:'Dashboard',relacionamento:'Relacionamento',admin:'Administração'};
let adminAuth=null;
let adminDb=null;
let adminUser=null;
let users=[];

const byId=id=>document.getElementById(id);
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
    return `<article class="user-card"><div><strong>${escapeHtml(user.displayName||user.email||user.uid)}</strong><small>${escapeHtml(user.email||'')} · ${escapeHtml(user.uid)} · ${user.active===false?'inativo':'ativo'}</small></div><div class="user-access">${panels}<button class="admin-link" data-edit-user="${escapeAttr(user.uid)}" type="button">Editar</button></div></article>`;
  }).join('');
  list.querySelectorAll('[data-edit-user]').forEach(button=>button.addEventListener('click',()=>openEditor(button.dataset.editUser)));
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function escapeAttr(value){return escapeHtml(value).replace(/`/g,'&#96;');}
function openEditor(uid=''){
  const user=users.find(item=>item.uid===uid)||{uid:'',email:'',displayName:'',active:true,panels:{dashboard:true,relacionamento:false,admin:false}};
  byId('user-editor').hidden=false;
  byId('editor-title').textContent=uid?'Editar usuário':'Novo usuário';
  byId('user-uid').value=user.uid;byId('user-uid').readOnly=!!uid;
  byId('user-email').value=user.email||'';byId('user-name').value=user.displayName||'';byId('user-active').checked=user.active!==false;
  byId('access-dashboard').checked=!!user.panels?.dashboard;byId('access-relacionamento').checked=!!user.panels?.relacionamento;byId('access-admin').checked=!!user.panels?.admin;
  byId('user-uid').focus();
}
function closeEditor(){byId('user-editor').hidden=true;byId('user-form').reset();byId('user-uid').readOnly=false;}
async function loadUsers(){
  const snapshot=await adminDb.collection(ADMIN_USERS_COLLECTION).orderBy('email').get();
  users=snapshot.docs.map(doc=>({uid:doc.id,...doc.data()}));renderUsers();
}
async function saveUser(event){
  event.preventDefault();
  const uid=byId('user-uid').value.trim();
  if(!uid){setStatus('Informe o UID do usuário.','error');return;}
  const data={email:byId('user-email').value.trim(),displayName:byId('user-name').value.trim(),active:byId('user-active').checked,panels:{dashboard:byId('access-dashboard').checked,relacionamento:byId('access-relacionamento').checked,admin:byId('access-admin').checked},updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  try{await adminDb.collection(ADMIN_USERS_COLLECTION).doc(uid).set(data,{merge:true});closeEditor();await loadUsers();setStatus('Acesso salvo.','ok');}
  catch(error){console.error(error);setStatus('Não foi possível salvar este acesso.','error');}
}
function startAdmin(){
  const app=firebase.apps.length?firebase.app():firebase.initializeApp(window.OB_FIREBASE_CONFIG);
  adminAuth=firebase.auth(app);adminDb=firebase.firestore(app);
  byId('admin-auth-form').addEventListener('submit',async event=>{event.preventDefault();setAuthError('');try{await adminAuth.signInWithEmailAndPassword(byId('admin-auth-email').value.trim(),byId('admin-auth-password').value);}catch(error){setAuthError(authMessage(error));}});
  byId('admin-auth-forgot').addEventListener('click',async()=>{try{await adminAuth.sendPasswordResetEmail(byId('admin-auth-email').value.trim());setAuthError('Enviamos um link de recuperação para seu email.');}catch(error){setAuthError(authMessage(error));}});
  byId('admin-logout').addEventListener('click',()=>adminAuth.signOut());
  byId('new-user').addEventListener('click',()=>openEditor());byId('cancel-user').addEventListener('click',closeEditor);byId('user-form').addEventListener('submit',saveUser);
  adminAuth.onAuthStateChanged(async user=>{
    adminUser=user||null;byId('admin-user').textContent=user?.email||'';byId('admin-logout').hidden=!user;
    if(!user){setAuthOpen(true);return;}
    try{
      const security=await adminDb.collection('meta').doc(ADMIN_SECURITY_DOC).get();
      const adminUids=security.data()?.adminUids||[];
      if(!adminUids.includes(user.uid)){setAuthOpen(false);setStatus('Esta conta não possui permissão de proprietário.','error');byId('new-user').disabled=true;return;}
      setAuthOpen(false);await loadUsers();setStatus('Acesso de proprietário confirmado.');
    }catch(error){setAuthOpen(false);setStatus('Configure o UID do proprietário em meta/security.adminUids antes de usar esta página.','error');}
  });
}
if(typeof firebase==='undefined'||!window.OB_FIREBASE_CONFIG){setAuthOpen(true);setAuthError('Firebase não está configurado.');}else{startAdmin();}
