// Evita o modal de login piscar ao trocar de página: se a última visita estava logada,
// o modal fica escondido até o Firebase confirmar a sessão (ou até 4 s, se ele não responder).
(function(){
  var KEY='ob-auth-hint';
  var root=document.documentElement;
  try{if(localStorage.getItem(KEY)==='1')root.classList.add('auth-pending');}catch(e){}
  var timer=setTimeout(done,4000);
  function done(){clearTimeout(timer);root.classList.remove('auth-pending');}
  window.OBAuthHint={
    // Chamar no fim de onAuthStateChanged, depois de abrir/fechar o modal.
    update:function(user){
      try{if(user)localStorage.setItem(KEY,'1');else localStorage.removeItem(KEY);}catch(e){}
      done();
    }
  };
})();
