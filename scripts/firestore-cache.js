// Cache local do Firestore (IndexedDB): reabrir a página em até 30 min cobra só os documentos alterados.
window.OBFirestoreCache={
  enable(db){
    db.enablePersistence({synchronizeTabs:true}).catch(error=>{
      // Sem IndexedDB ou aba antiga com outra versão: segue sem cache, como antes.
      console.warn('Cache local do Firestore indisponível:',error.code||error);
    });
  },
  // Usado no botão Sair: apaga os dados do navegador e recarrega a página com um Firestore novo.
  async clearAndReload(db){
    try{
      await db.terminate();
      await db.clearPersistence();
    }catch(error){
      console.warn('Não foi possível limpar o cache local do Firestore:',error.code||error);
    }
    window.location.reload();
  }
};
