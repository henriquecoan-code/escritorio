// Cache local do Firestore (IndexedDB): reabrir a página em até 30 min cobra só os documentos alterados.
// O cache só é ligado com sessão ativa (marca do auth-hint.js) e é apagado ao sair, em todas as abas abertas.
(function(){
  var DIRTY_KEY='ob-cache-dirty';   // limpeza anterior não concluiu
  var HINT_KEY='ob-auth-hint';      // gravada por scripts/auth-hint.js enquanto há sessão
  var hadUser=false, clearing=false, enabled=false;

  function lsGet(key){try{return localStorage.getItem(key);}catch(e){return null;}}
  function lsSet(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(e){}}
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

  window.OBFirestoreCache={
    enable:function(db){
      // Ficou cache de uma sessão anterior: apaga agora e segue sem cache nesta abertura.
      if(lsGet(DIRTY_KEY)){
        db.clearPersistence()
          .then(function(){lsSet(DIRTY_KEY,null);})
          .catch(function(error){console.warn('Cache local do Firestore ainda não pôde ser apagado:',error.code||error);});
        return;
      }
      // Deslogado: não abre o cache, para não travar a limpeza feita por outra aba.
      if(lsGet(HINT_KEY)!=='1')return;
      this.ligar(db);
    },
    ligar:function(db){
      if(enabled||clearing||lsGet(DIRTY_KEY))return;
      enabled=true;
      db.enablePersistence({synchronizeTabs:true}).catch(function(error){
        // Sem IndexedDB ou aba antiga com outra versão: segue sem cache, como antes.
        console.warn('Cache local do Firestore indisponível:',error.code||error);
      });
    },
    // Login feito nesta página (primeira visita ou depois de sair): liga o cache.
    // Chamar no onAuthStateChanged antes de iniciar as leituras protegidas.
    login:function(db){this.ligar(db);},
    // Chamar em onAuthStateChanged, depois de OBAuthHint.update: se a sessão desta aba acabou
    // (pelo botão Sair aqui ou em outra aba), fecha o Firestore e apaga o cache.
    watch:function(db,user){
      if(user){hadUser=true;return;}
      if(hadUser)this.clearAndReload(db);
    },
    // Também usado pelos botões Sair.
    clearAndReload:async function(db){
      if(clearing)return;
      clearing=true;
      lsSet(DIRTY_KEY,'1');
      try{await db.terminate();}catch(e){}
      // As outras abas fecham o Firestore delas ao perceber o logout; tenta por até ~3 s.
      for(var attempt=1;attempt<=10;attempt++){
        try{
          await db.clearPersistence();
          lsSet(DIRTY_KEY,null);
          break;
        }catch(error){
          if(attempt===10)console.warn('Cache local do Firestore será apagado na próxima abertura:',error.code||error);
          else await wait(300);
        }
      }
      window.location.reload();
    }
  };
})();
