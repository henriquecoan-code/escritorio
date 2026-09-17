(function(){
  function enhancePassword(input){
    if(input.dataset.passwordEyeReady==='true')return;
    input.dataset.passwordEyeReady='true';
    const wrapper=document.createElement('span');
    wrapper.className='password-field';
    input.parentNode.insertBefore(wrapper,input);
    wrapper.appendChild(input);

    const button=document.createElement('button');
    button.type='button';
    button.className='password-eye';
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="eye-shape" d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle><path class="eye-slash" d="M4 4l16 16"></path></svg>';
    button.setAttribute('aria-label','Mostrar senha');
    button.title='Mostrar senha';
    button.addEventListener('click',()=>{
      const visible=input.type==='text';
      input.type=visible?'password':'text';
      button.classList.toggle('is-visible',!visible);
      button.setAttribute('aria-label',visible?'Mostrar senha':'Ocultar senha');
      button.title=visible?'Mostrar senha':'Ocultar senha';
    });
    wrapper.appendChild(button);
  }

  function enhanceAll(root=document){
    root.querySelectorAll('input[type="password"]').forEach(enhancePassword);
  }

  enhanceAll();
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
    if(node.nodeType===Node.ELEMENT_NODE)enhanceAll(node);
  }))).observe(document.body,{childList:true,subtree:true});
})();
