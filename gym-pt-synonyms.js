/* Dicionário de termos PT-BR de academia -> termos em inglês, usado para expandir buscas
   na biblioteca de exercícios (que tem nomes majoritariamente em inglês). */
(function(root){
  'use strict';
  const PT_SYNONYMS = {
    'agachamento':['squat'],
    'agachamento livre':['squat','barbell squat'],
    'agachamento hack':['hack squat'],
    'agachamento sumo':['sumo squat'],
    'agachamento búlgaro':['bulgarian split squat'],
    'supino':['bench press','bench'],
    'supino reto':['bench press','barbell bench press'],
    'supino inclinado':['incline bench press'],
    'supino declinado':['decline bench press'],
    'remada':['row'],
    'remada curvada':['bent over row'],
    'remada baixa':['seated row','cable row'],
    'remada alta':['upright row'],
    'remada unilateral':['one arm row','dumbbell row'],
    'rosca':['curl'],
    'rosca direta':['barbell curl'],
    'rosca alternada':['alternate curl','alternating dumbbell curl'],
    'rosca martelo':['hammer curl'],
    'rosca scott':['preacher curl'],
    'rosca concentrada':['concentration curl'],
    'desenvolvimento':['press','shoulder press','military press'],
    'desenvolvimento militar':['military press','overhead press'],
    'desenvolvimento com halteres':['dumbbell shoulder press'],
    'elevação lateral':['lateral raise'],
    'elevacao lateral':['lateral raise'],
    'elevação frontal':['front raise'],
    'elevacao frontal':['front raise'],
    'elevação pélvica':['hip thrust'],
    'elevacao pelvica':['hip thrust'],
    'puxada':['pulldown','pull-down','pull down'],
    'puxada alta':['lat pulldown'],
    'puxada frente':['lat pulldown'],
    'levantamento terra':['deadlift'],
    'levantamento terra romeno':['romanian deadlift'],
    'terra':['deadlift'],
    'stiff':['stiff-legged deadlift','romanian deadlift'],
    'flexão':['push-up','pushup'],
    'flexao':['push-up','pushup'],
    'flexão de braço':['push-up'],
    'barra fixa':['pull-up','pullup','chin-up'],
    'barra':['pull-up','barbell'],
    'panturrilha':['calf raise','calf'],
    'panturrilha sentado':['seated calf raise'],
    'panturrilha em pé':['standing calf raise'],
    'panturrilha em pe':['standing calf raise'],
    'abdominal':['crunch','sit-up','situp'],
    'abdominal infra':['leg raise','reverse crunch'],
    'abdominal supra':['crunch'],
    'afundo':['lunge'],
    'avanço':['lunge'],
    'avanco':['lunge'],
    'cadeira extensora':['leg extension'],
    'extensora':['leg extension'],
    'cadeira flexora':['leg curl'],
    'mesa flexora':['leg curl'],
    'flexora':['leg curl'],
    'leg press':['leg press'],
    'crucifixo':['fly','flye','chest fly'],
    'voador':['fly','flye','pec deck'],
    'peck deck':['pec deck','fly'],
    'mergulho':['dip'],
    'paralelas':['dip'],
    'encolhimento':['shrug'],
    'tríceps testa':['skull crusher','triceps extension','lying triceps extension'],
    'triceps testa':['skull crusher','triceps extension','lying triceps extension'],
    'tríceps pulley':['pushdown','triceps pushdown'],
    'triceps pulley':['pushdown','triceps pushdown'],
    'tríceps corda':['pushdown','rope pushdown'],
    'triceps corda':['pushdown','rope pushdown'],
    'glúteo':['glute','hip thrust'],
    'gluteo':['glute','hip thrust'],
    'coice':['kickback'],
    'coice de glúteo':['glute kickback'],
    'coice de gluteo':['glute kickback'],
    'remo':['row'],
    'esteira':['treadmill'],
    'bicicleta':['bike','cycling'],
    'polichinelo':['jumping jack'],
    'prancha':['plank'],
    'prancha lateral':['side plank'],
    'rotação de tronco':['twist','russian twist'],
    'rotacao de tronco':['twist','russian twist'],
    'salto':['jump'],
    'arranco':['snatch'],
    'bom dia':['good morning'],
    'abdutora':['hip abduction'],
    'adutora':['hip adduction'],
    'cross over':['cable crossover'],
    'crossover':['cable crossover'],
    'facepull':['face pull'],
    'face pull':['face pull'],
    'gironda':['close grip bench press'],
    'pullover':['pullover']
  };
  function normPt(s){
    return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  }
  // Expande uma busca em PT para incluir termos em inglês equivalentes, usando as chaves
  // normalizadas do dicionário (comparação sem acento).
  const NORMALIZED_MAP = (function(){
    const out = {};
    Object.keys(PT_SYNONYMS).forEach(pt=>{ out[normPt(pt)] = PT_SYNONYMS[pt]; });
    return out;
  })();
  function expandTerms(query){
    const q = normPt(query);
    const out = new Set();
    if(q) out.add(q);
    Object.keys(NORMALIZED_MAP).forEach(pt=>{
      if(q && (q.includes(pt) || pt.includes(q))){
        NORMALIZED_MAP[pt].forEach(en=>out.add(normPt(en)));
      }
    });
    return Array.from(out);
  }
  root.ForjaPtSynonyms = { expandTerms, normPt, PT_SYNONYMS };
})(typeof globalThis!=='undefined'?globalThis:this);
