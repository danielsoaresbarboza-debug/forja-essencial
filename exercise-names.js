/* Camada de exibição em português dos exercícios.
   O nome em inglês continua sendo o identificador interno (histórico, fotos e
   grupo muscular são guardados por ele) — então NADA do que já foi registrado
   se perde. Aqui só se decide como o nome APARECE, e como a BUSCA acha o
   exercício digitando em português ou em inglês.
   Também descobre o grupo muscular de um exercício pelas bibliotecas, pra
   parar de chutar "Peito" quando o exercício não tem categoria salva. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaExerciseNames=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  // Grupo da biblioteca (PT) -> categoria interna do app (as mesmas 9 do diagrama do corpo).
  const MUSCLE_MAP={
    'Quadríceps':'Perna','Quadril (adutor)':'Perna','Quadril (abdutor)':'Perna','Posterior de coxa':'Perna','Adutores':'Perna','Abdutores':'Perna','Posterior':'Perna','Perna':'Perna',
    'Ombro':'Ombro','Ombros':'Ombro','Abdômen':'Abdômen','Peito':'Peito','Tríceps':'Tríceps','Bíceps':'Bíceps','Antebraço':'Bíceps','Antebraços':'Bíceps',
    'Costas (dorsal)':'Costas','Costas (meio)':'Costas','Costas':'Costas','Lombar':'Costas','Trapézio':'Costas','Pescoço':'Costas',
    'Glúteo':'Glúteo','Glúteos':'Glúteo','Panturrilha':'Panturrilha','Panturrilhas':'Panturrilha'
  };

  let ptIndex=null,reverseIndex=null,infoIndex=null;
  function build(){
    if(ptIndex)return;
    ptIndex=new Map();reverseIndex=new Map();infoIndex=new Map();
    const pt=root.ForjaExerciseNamesPt||{};
    Object.keys(pt).forEach(en=>{ptIndex.set(norm(en),pt[en]);reverseIndex.set(norm(pt[en]),en);});
    (root.ForjaFreeExerciseLibrary||[]).forEach(r=>{
      const k=norm(r[1]);
      if(!infoIndex.has(k))infoIndex.set(k,{en:r[1],muscle:MUSCLE_MAP[r[3]]||null,equip:r[4]||''});
    });
    (root.ForjaGymCatalog||[]).forEach(r=>{
      const k=norm(r[0]);
      const cur=infoIndex.get(k);
      if(!cur)infoIndex.set(k,{en:r[0],muscle:MUSCLE_MAP[r[2]]||null,equip:r[3]||''});
      else if(!cur.muscle)cur.muscle=MUSCLE_MAP[r[2]]||null;
    });
  }
  // Nome em português pra mostrar. Se não houver tradução (ex.: exercício que a
  // própria pessoa criou, já em português), devolve o nome como está.
  function display(name){
    build();
    const n=String(name||'');
    return ptIndex.get(norm(n))||n;
  }
  // Se o nome dado for um nome em PT da biblioteca, devolve o original em inglês.
  function toEnglish(name){
    build();
    return reverseIndex.get(norm(name))||name;
  }
  // Texto pesquisável: PT + EN juntos (acha "crucifixo" ou "fly").
  function haystack(name){
    build();
    return norm(name)+' '+norm(display(name));
  }
  function info(name){
    build();
    return infoIndex.get(norm(toEnglish(name)))||infoIndex.get(norm(name))||null;
  }
  function muscleFor(name){const i=info(name);return i?i.muscle:null;}
  function equipFor(name){const i=info(name);return i?i.equip:'';}
  // Nome bonito a partir de um slug (usado pra fotos antigas que só guardaram a chave).
  function prettyFromSlug(slug){
    return String(slug||'').split('-').filter(Boolean).map((w,i)=>i>0&&['de','da','do','das','dos','e','com','na','no','em'].includes(w)?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
  }
  return{display,toEnglish,haystack,info,muscleFor,equipFor,prettyFromSlug,norm,MUSCLE_MAP};
});
