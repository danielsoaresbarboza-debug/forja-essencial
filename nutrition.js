(function(root){
 'use strict';
 const macros=['protein_g','carbs_g','fat_g'];
 function parse(text){
  const raw=String(text||'')
   .replace(/\[span_\d+\]\((?:start|end)_span\)/gi,'')
   .replace(/\[cite(?:_start|_end)?[^\]]*\]/gi,'')
   .replace(/\\?\[\d+(?:\s*,\s*\d+)*\\?\]/g,'')
   .trim();
  const plain=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[*_`#]/g,'');
  const num='(-?\\d[\\d.,]*\\d|-?\\d)';
  // Gemini and similar assistants often prefix an estimated total with "~",
  // "≈", "aprox." or "cerca de" (e.g. "Total: ~295 kcal") — this is skipped
  // (not captured) right before the number so those lines still match.
  const approx='(?:[~≈]|cerca de|aprox\\.?)?\\s*';
  function numeric(raw){
   if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw))return Number(raw.replace(/\./g,'').replace(',','.'));
   if(/^\d{1,3}(?:,\d{3})+\.\d+$/.test(raw))return Number(raw.replace(/,/g,''));
   return Number(raw.replace(',','.'));
  }
  const labels={protein_g:'proteinas?(?:\\s+(?:total|totais))?',carbs_g:'(?:carboidratos?|carbos?)(?:\\s+(?:total|totais))?',fat_g:'(?:gorduras?|lipidios?)(?:\\s+(?:total|totais))?'};
  function values(expressions){
   const found=[];
   for(const re of expressions)for(const m of plain.matchAll(re)){const value=numeric(m[1]);if(Number.isFinite(value)&&value>=0)found.push(value);}
   return [...new Set(found)];
  }
  function extractKcal(){
   const explicit=values([
    new RegExp('\\b(?:calorias?(?:\\s+(?:total|totais))?|valor\\s+energetico|energia(?:\\s+total)?)\\s*(?:[:=|–-]\\s*)?'+approx+num+'\\s*(?:kcal|cal)?\\b','gi'),
    new RegExp('(?:^|\\n)\\s*(?:[-•]\\s*)?total(?:\\s+(?:da refeicao|estimado|geral))?\\s*(?:[:=|–-]\\s*)?'+approx+num+'\\s*kcal\\b','gi')
   ]);
   if(explicit.length===1)return explicit[0];
   const loose=values([new RegExp(approx+num+'\\s*kcal\\b','gi')]);
   return loose.length===1?loose[0]:null;
  }
  // Linha de total ("Total: 335 kcal | P: 38g | C: 35,4g | G: 4g"). Quando o texto tem
  // itens um a um, cada item também tem P/C/G — então os macros do TOTAL precisam ser
  // lidos só dessa linha, senão há valores demais e o app desiste de todos.
  const totalLine=(()=>{
   const lines=plain.split(/\n/).map(l=>l.trim()).filter(Boolean);
   for(let i=lines.length-1;i>=0;i--){if(/^[-•>\s]*(?:total|soma)\b/i.test(lines[i]))return lines[i];}
   return null;
  })();
  function macroFromTotalLine(key){
   if(!totalLine)return null;
   const short={protein_g:'(?:p|prot|proteinas?)',carbs_g:'(?:c|carb|carbo|carbos|carboidratos?)',fat_g:'(?:g|gord|gorduras?|lipidios?)'}[key];
   const m=new RegExp('(?:^|[\\s|;,(])'+short+'\\s*[:=]?\\s*'+approx+num+'\\s*g\\b','i').exec(totalLine);
   if(!m)return null;
   const v=numeric(m[1]);return Number.isFinite(v)&&v>=0?v:null;
  }
  function extractMacro(key){
   const fromTotal=macroFromTotalLine(key);if(fromTotal!==null)return fromTotal;
   const label=labels[key],short={protein_g:'P',carbs_g:'C',fat_g:'G'}[key];
   const explicit=values([
    new RegExp('\\b'+label+'[ \\t]*(?:[:=|–-][ \\t]*)?'+approx+num+'[ \\t]*g\\b','gi'),
    new RegExp(approx+num+'[ \\t]*g[ \\t]*(?:de[ \\t]+)?'+label+'\\b','gi'),
    new RegExp('(?:^|[\\n;|])[ \\t]*'+short+'[ \\t]*[:=][ \\t]*'+approx+num+'[ \\t]*g?\\b','gi')
   ]);
   return explicit.length===1?explicit[0]:null;
  }
  // Itens: "- Whey (1 scoop / 30g): 120 kcal | P: 24g | C: 3g | G: 1g"  ->  um por linha.
  function parseItems(){
   const out=[];const seen=new Set();
   raw.split(/\n/).forEach(line=>{
    const L=line.replace(/[*_`#]/g,'').trim();
    if(!L||/^[-•>\s]*(?:total|soma)\b/i.test(L))return;
    const m=/^[-•>\s]*(.+?)\s*:\s*(?:[~≈]|cerca de|aprox\.?)?\s*(\d[\d.,]*)\s*kcal\b(.*)$/i.exec(L);
    if(!m)return;
    const kcal=numeric(m[2]);if(!Number.isFinite(kcal)||kcal<0)return;
    let name=m[1].trim(),qty='';
    const q=/^(.*?)\s*\(([^)]*)\)\s*$/.exec(name);
    if(q){name=q[1].trim();qty=q[2].trim();}
    if(!name||name.length>80)return;
    const rest=m[3].normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const grab=(re)=>{const r=re.exec(rest);if(!r)return null;const v=numeric(r[1]);return Number.isFinite(v)?v:null;};
    const item={name,qty,kcal,
     protein_g:grab(new RegExp('(?:^|[\\s|;,])(?:p|prot\\w*)\\s*[:=]?\\s*'+approx+num+'\\s*g\\b','i')),
     carbs_g:grab(new RegExp('(?:^|[\\s|;,])(?:c|carb\\w*)\\s*[:=]?\\s*'+approx+num+'\\s*g\\b','i')),
     fat_g:grab(new RegExp('(?:^|[\\s|;,])(?:g|gord\\w*|lip\\w*)\\s*[:=]?\\s*'+approx+num+'\\s*g\\b','i'))};
    const key=(name+'|'+qty).toLowerCase();if(seen.has(key))return;seen.add(key);
    out.push(item);
   });
   return out;
  }
  const value={items:parseItems(),note:'Valores informados ou estimados fora do aplicativo; conferidos pelo usuário.'};
  value.kcal=extractKcal();for(const key of macros)value[key]=extractMacro(key);
  const named=raw.match(/(?:^|\n)\s*(?:Alimentos\/produto|Alimentos|Produto|Descri[cç][aã]o)\s*:\s*(.+)/i);
  const quantity=raw.match(/(?:^|\n)\s*Quantidade considerada\s*:\s*(.+)/i);
  value.description=(named?named[1]+(quantity?' · '+quantity[1]:''):(value.items.length?value.items.map(i=>i.name).join(', '):raw.split(/\n|[—]/)[0])).trim().slice(0,500);
  return value;
 }
 function validate(value){
  if(value.kcal===null||value.kcal===''||value.kcal===undefined||!Number.isFinite(Number(value.kcal))||Number(value.kcal)<0)throw Error('Preencha as calorias com um número igual ou maior que zero.');
  if(!String(value.description||'').trim())throw Error('Preencha a descrição da refeição.');
  for(const key of macros){if(value[key]===null||value[key]===undefined||value[key]===''){value[key]=null;continue;}if(!Number.isFinite(Number(value[key]))||Number(value[key])<0)throw Error('Use nutrientes positivos ou deixe em branco quando não souber.');}
  return value;
 }
 root.ForjaNutrition={parse,validate};
})(globalThis);
