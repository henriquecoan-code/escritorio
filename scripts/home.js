(function(){
  const overlay=document.getElementById('home-auth-overlay');
  const form=document.getElementById('home-auth-form');
  const emailInput=document.getElementById('home-auth-email');
  const passwordInput=document.getElementById('home-auth-password');
  const errorEl=document.getElementById('home-auth-error');
  const forgotBtn=document.getElementById('home-auth-forgot');
  const userEl=document.getElementById('home-auth-user');
  const logoutBtn=document.getElementById('home-auth-logout');
  if(!overlay||!form)return;
  if(new URLSearchParams(window.location.search).get('view')==='dashboard'){
    overlay.classList.remove('open');
    return;
  }

  function showError(message){errorEl.textContent=message||'';}
  function setLocked(locked){
    overlay.classList.toggle('open',locked);
    document.body.classList.toggle('home-locked',locked);
  }
  function authError(error){
    if(error?.code==='auth/invalid-credential')return 'Email ou senha incorretos.';
    if(error?.code==='auth/invalid-email')return 'Informe um email válido.';
    return 'Não foi possível concluir o acesso. Tente novamente.';
  }

  if(typeof firebase==='undefined'||!window.OB_FIREBASE_CONFIG){
    setLocked(true);
    showError('Firebase não está configurado.');
    return;
  }

  try{
    const app=firebase.apps.length?firebase.app():firebase.initializeApp(window.OB_FIREBASE_CONFIG);
    const auth=firebase.auth(app);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      showError('');
      const email=emailInput.value.trim();
      const password=passwordInput.value;
      if(!email||!password){showError('Informe email e senha.');return;}
      form.querySelector('button[type="submit"]').disabled=true;
      try{await auth.signInWithEmailAndPassword(email,password);}
      catch(error){showError(authError(error));}
      finally{form.querySelector('button[type="submit"]').disabled=false;}
    });
    forgotBtn.addEventListener('click',async()=>{
      const email=emailInput.value.trim();
      if(!email){showError('Informe seu email para recuperar a senha.');return;}
      try{await auth.sendPasswordResetEmail(email);showError('Enviamos um link de recuperação para seu email.');}
      catch(error){showError(authError(error));}
    });
    logoutBtn.addEventListener('click',()=>auth.signOut());
    auth.onAuthStateChanged(async user=>{
      const signedIn=!!user;
      setLocked(!signedIn);
      userEl.textContent=signedIn?(user.email||'Usuário autenticado'):'';
      logoutBtn.hidden=!signedIn;
      const adminLink=document.getElementById('home-admin-link');
      if(!signedIn){adminLink?.setAttribute('hidden','');return;}
      try{
        const db=firebase.firestore(app);
        const security=await db.collection('meta').doc('security').get();
        if((security.data()?.adminUids||[]).includes(user.uid))adminLink?.removeAttribute('hidden');
      }catch(error){adminLink?.setAttribute('hidden','');}
      showError('');
    });
  }catch(error){
    console.error('Falha ao inicializar autenticação do painel:',error);
    setLocked(true);
    showError('Falha ao inicializar o acesso.');
  }
})();
