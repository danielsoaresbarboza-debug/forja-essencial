/**
 * Forja.Treino — planilha Google como "servidor".
 *
 * COMO USAR (uma vez só, no computador):
 *  1. Crie uma planilha nova em sheets.google.com.
 *  2. Menu Extensões > Apps Script. Apague o que estiver lá e cole ESTE arquivo inteiro.
 *  3. Troque a SENHA aqui embaixo por uma senha sua (qualquer texto, sem espaços).
 *  4. Clique em Implantar > Nova implantação > tipo "App da Web":
 *       - Executar como: Eu
 *       - Quem pode acessar: Qualquer pessoa
 *     Autorize quando o Google pedir (aparece "app não verificado": Avançado > Acessar).
 *  5. Copie o URL do app da Web (termina em /exec) e cole no Forja.Treino em
 *     Mais > Planilha Google, junto com a mesma senha. Toque em "Conectar e testar".
 *
 * A aba "dados" guarda tudo (não edite). As abas "Treinos", "Dieta", "Peso" e "Balança"
 * são cópias legíveis, regeneradas a cada sincronização — pode olhar, filtrar e fazer
 * gráficos numa aba SUA, mas alterações nessas abas não voltam pro app.
 *
 * Se mudar este script depois, use Implantar > Gerenciar implantações > editar > Nova versão
 * (o URL continua o mesmo).
 */

const SENHA = 'TROQUE-ESTA-SENHA';

const ABA_DADOS = 'dados';
const CHUNK = 45000;            // limite de uma célula do Google Sheets é 50.000 caracteres
const VERSAO = 1;
const ESPELHOS = { 'workouts': 'Treinos', 'diet-log': 'Dieta', 'body-log': 'Peso', 'scale-log': 'Balança' };

function doGet() {
  return saida({ ok: true, app: 'Forja.Treino', versao: VERSAO, msg: 'Script no ar. O app conversa por POST.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let travou = false;
  try {
    lock.waitLock(25000);
    travou = true;
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!SENHA || SENHA === 'TROQUE-ESTA-SENHA') {
      return saida({ ok: false, error: 'config', message: 'Troque a SENHA no topo do script antes de publicar.' });
    }
    if (req.token !== SENHA) {
      return saida({ ok: false, error: 'senha', message: 'Senha incorreta.' });
    }
    switch (req.action) {
      case 'ping': return saida({ ok: true, versao: VERSAO, agora: Date.now() });
      case 'meta': return saida(acaoMeta());
      case 'get': return saida(acaoGet(req.keys || []));
      case 'put': return saida(acaoPut(req.items || [], String(req.device || '')));
      default: return saida({ ok: false, error: 'acao', message: 'Ação desconhecida.' });
    }
  } catch (err) {
    return saida({ ok: false, error: 'erro', message: String((err && err.message) || err) });
  } finally {
    if (travou) { try { lock.releaseLock(); } catch (_) {} }
  }
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function abaDados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_DADOS);
  if (!sh) {
    sh = ss.insertSheet(ABA_DADOS);
    sh.getRange(1, 1, 1, 5).setValues([['chave', 'atualizado_em', 'aparelho', 'partes', 'conteudo (não edite esta aba)']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// chave -> { row, ts, partes }
function lerIndice(sh) {
  const idx = {};
  const ultima = sh.getLastRow();
  if (ultima < 2) return idx;
  const v = sh.getRange(2, 1, ultima - 1, 4).getValues();
  for (let i = 0; i < v.length; i++) {
    if (v[i][0] !== '') idx[String(v[i][0])] = { row: i + 2, ts: Number(v[i][1]) || 0, partes: Number(v[i][3]) || 0 };
  }
  return idx;
}

function acaoMeta() {
  const sh = abaDados();
  const idx = lerIndice(sh);
  const keys = {};
  Object.keys(idx).forEach(function (k) { keys[k] = { ts: idx[k].ts, partes: idx[k].partes }; });
  return { ok: true, keys: keys, agora: Date.now() };
}

function acaoGet(chaves) {
  const sh = abaDados();
  const idx = lerIndice(sh);
  const data = {};
  chaves.forEach(function (k) {
    const it = idx[k];
    if (!it) return;
    let valor = '';
    if (it.partes > 0) {
      const partes = sh.getRange(it.row, 5, 1, it.partes).getValues()[0];
      valor = partes.map(function (p) { return String(p).slice(1); }).join(''); // tira o prefixo "J"
    }
    data[k] = { ts: it.ts, value: valor };
  });
  return { ok: true, data: data };
}

function acaoPut(items, aparelho) {
  const sh = abaDados();
  const idx = lerIndice(sh);
  const salvo = {};
  const conflitos = [];
  const agora = Date.now();
  items.forEach(function (item, n) {
    const chave = String(item.key || '');
    if (!chave) return;
    const atual = idx[chave];
    // Outro aparelho gravou depois do que este aparelho conhecia: não sobrescreve, avisa.
    if (atual && item.baseTs !== undefined && atual.ts > Number(item.baseTs)) { conflitos.push(chave); return; }
    const valor = String(item.value == null ? '' : item.value);
    const partes = [];
    for (let i = 0; i < valor.length; i += CHUNK) partes.push('J' + valor.slice(i, i + CHUNK)); // "J" evita a célula virar fórmula/número
    if (!partes.length) partes.push('J');
    const largura = 4 + Math.max(partes.length, atual ? atual.partes : 0);
    if (sh.getMaxColumns() < largura) sh.insertColumnsAfter(sh.getMaxColumns(), largura - sh.getMaxColumns());
    const ts = Math.max(agora + n, atual ? atual.ts + 1 : 0); // sempre maior que a versão anterior
    const linha = [chave, ts, aparelho, partes.length].concat(partes);
    while (linha.length < largura) linha.push('');
    const row = atual ? atual.row : sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, largura).setValues([linha]);
    idx[chave] = { row: row, ts: ts, partes: partes.length };
    salvo[chave] = ts;
    if (ESPELHOS[chave]) espelhar(chave, valor);
  });
  return { ok: true, saved: salvo, conflicts: conflitos };
}

// Cópia legível (só leitura) de listas importantes, numa aba própria.
function espelhar(chave, json) {
  let dados;
  try { dados = JSON.parse(json); } catch (_) { return; }
  if (!Array.isArray(dados)) return;
  const nome = ESPELHOS[chave];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  const linhas = dados.slice(-5000).filter(function (o) { return o && typeof o === 'object'; });
  const cols = [];
  linhas.forEach(function (o) { Object.keys(o).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
  sh.clearContents();
  if (!cols.length) return;
  const corpo = linhas.map(function (o) {
    return cols.map(function (k) {
      const v = o[k];
      if (v === null || v === undefined) return '';
      return (typeof v === 'object') ? JSON.stringify(v) : v;
    });
  });
  const todas = [cols].concat(corpo);
  sh.getRange(1, 1, todas.length, cols.length).setNumberFormat('@').setValues(todas);
  sh.setFrozenRows(1);
}
