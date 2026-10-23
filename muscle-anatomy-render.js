/* Desenha o boneco de "Grupos trabalhados hoje" usando os paths anatômicos reais
   (muscle-anatomy-data.js, MIT, veja licenses/musclemap-LICENSE.txt) sobre a foto
   em tons de cinza do corpo (assets/muscle-front.webp / muscle-back.webp), recortada
   pela silhueta. Cada grupo muscular anatômico é mapeado pra uma das 9 zonas que o
   app já usa (chest/back/shoulder/arm_front/arm_back/abs/legs/glute/calf), então o
   destaque continua funcionando com o mesmo código que já tínhamos (classe
   .muscle-zone-img[data-zone] + .highlight/.secondary em gym-ui.js). */
(function(root){
  'use strict';
  const GROUP_ZONE = {
    front: {
      TRAPEZIUS:'shoulder', CHEST:'chest', SHOULDERS_FRONT:'shoulder', SHOULDERS_SIDE:'shoulder',
      BICEPS:'arm_front', TRICEPS:'arm_front', FOREARMS:'forearm',
      OBLIQUES:'abs', CORE:'abs', ABDUCTORS:'legs', QUADS:'legs', ADDUCTORS:'legs', CALVES:'calf'
    },
    back: {
      TRAPEZIUS:'shoulder', SHOULDERS_REAR:'shoulder', SHOULDERS_SIDE:'shoulder',
      TRICEPS:'arm_back', FOREARMS:'forearm',
      RHOMBOIDS:'back', LATS:'back', BACK_LOWER:'back', OBLIQUES:'abs',
      GLUTES:'glute', ABDUCTORS:'legs', ADDUCTORS:'legs', HAMSTRINGS:'legs', CALVES:'calf'
    }
  };
  function buildBodySvg(view){
    const anatomy = root.ForjaMuscleAnatomy;
    if(!anatomy || !anatomy[view]) return '';
    const data = anatomy[view];
    const clipId = 'anatomy-clip-'+view;
    const outline = data.outline.map(part=>'<path d="'+part.d+'"/>').join('');
    const zones = GROUP_ZONE[view]||{};
    const shapes = data.muscles.map(part=>{
      const zone = zones[part.group]||'forearm';
      return '<path class="muscle-zone-img" data-zone="'+zone+'" d="'+part.d+'"/>';
    }).join('');
    return '<svg viewBox="0 0 1024 1536" role="img" aria-label="Corpo de '+(view==='front'?'frente':'costas')+' com os grupos musculares">'
      +'<defs><clipPath id="'+clipId+'">'+outline+'</clipPath></defs>'
      +'<g clip-path="url(#'+clipId+')"><image href="assets/muscle-'+view+'.webp" x="0" y="0" width="1024" height="1536" preserveAspectRatio="xMidYMid slice" style="filter:grayscale(1) brightness(.72) contrast(1.05)"/></g>'
      +shapes+'</svg>';
  }
  function mount(){
    const front = document.getElementById('body-fig-front');
    const back = document.getElementById('body-fig-back');
    if(front) front.innerHTML = buildBodySvg('front') || front.innerHTML;
    if(back) back.innerHTML = buildBodySvg('back') || back.innerHTML;
  }
  root.ForjaMuscleAnatomyRender = {buildBodySvg, mount, GROUP_ZONE};
})(typeof globalThis!=='undefined'?globalThis:this);
