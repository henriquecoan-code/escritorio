(function(){
  var btn = document.getElementById('theme-toggle-btn');
  if(!btn) return;

  function applyTheme(light){
    document.documentElement.classList.toggle('light', light);
    btn.innerHTML = light ? '&#9790;' : '&#9728;';
    btn.title = light ? 'Modo escuro' : 'Modo claro';
  }

  var saved = localStorage.getItem('ob-theme');
  applyTheme(saved === 'light');

  btn.addEventListener('click', function(){
    var nowLight = !document.documentElement.classList.contains('light');
    localStorage.setItem('ob-theme', nowLight ? 'light' : 'dark');
    applyTheme(nowLight);
  });
})();
