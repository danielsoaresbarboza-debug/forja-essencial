(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaChangelog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const CURRENT_VERSION='3.3.0';

const HISTORY=[
  {v:'3.3.0',date:'2026-10-27',items:['Treino: apagar qualquer série (toque no ✓ da série e depois em 🗑), com Desfazer','Treino: "Excluir exercício" tira o exercício e as séries do treino de hoje, com Desfazer','Visual novo em todos os menus antigos: Corrida, Natação, CrossFit, Exercícios, Recompensas, Relatórios, Progresso, Corpo, Cardápio, Importar e Mais','Títulos das seções em letra normal, textos de apoio maiores, botões e campos no mesmo padrão; correções de contraste no tema claro','Garmin removido; o balanço da semana passa a comparar o que você comeu com a meta do dia']},
  {v:'3.2.0',date:'2026-10-23',items:['Meta: peso, ritmo por semana, prazo em semanas ou data e atividade por dia ajustáveis com − e + ou digitando','Cartão "Hoje para a meta": quanto ainda comer, quanto falta gastar em atividade e quando se pesar','Gráficos previsto × realizado: peso (mostra quando a meta mudou) e calorias por dia (dentro, acima e dias sem registro)','Todas as metas (comida, proteína, água e, no Treino, treinos, carboidrato e gordura) ficam só na aba Meta','Essencial: Atividade com Musculação, Natação, Spinning e "Dia no relógio" para lançar à noite o total de calorias perdidas (só registro, não muda a meta)']},
  {v:'3.1.0',date:'2026-10-23',items:['Nova tela Meta de peso: quanto quer pesar, no seu ritmo ou até uma data','Mostra quando você chega, quanto comer e quanto gastar por dia, com etapas mês a mês','Compara seu peso real com o plano e calcula o ritmo das últimas 4 semanas','A meta de comida do dia passa a seguir o plano e as atividades lançadas']},
  {v:'3.0.1',date:'2026-10-23',items:['Liga o "Entrar com Google" (planilha e backup no seu Drive) e atualiza os arquivos guardados no celular']},
  {v:'3.0.0',date:'2026-10-23',items:[
    'Academia nova: o topo mostra "Hoje: Treino X", o próximo da sua sequência, com o resumo da última vez e um botão só para começar. Os outros treinos ficam em "Trocar"',
    'Tipos de exercício: kg × repetições, só repetições (com peso extra opcional), tempo (cronômetro para prancha e isometria) e cardio. O app escolhe sozinho e você troca no seletor do topo da janela',
    'Janela do exercício em tabela: cada série já vem com os valores da última vez; um toque no ✓ conclui. Sugestão de carga, repetições ou tempo quando você bate a meta em todas as séries',
    'Descanso em tela cheia com anel, próxima série, −15/+15/Pular, tela acesa e vibração no fim; dá para minimizar numa barrinha',
    'Tela "Treino concluído" antes da avaliação de esforço (agora opcional, numa linha), com recordes e o próximo treino',
    'Início com três anéis (treino, água e calorias), atalhos fixos e o cartão Suplementos: creatina marca o dia e o whey já lança as calorias e a proteína',
    'Água: garrafa e três botões grandes, Desfazer em cada copo e azul como cor da água. Meta, goles, lembretes e zerar ficam em "Ajustar"',
    'Comida por refeição, com "+ Adicionar": recentes primeiro (um toque lança) e Buscar, Código de barras, Foto ou Colar texto. "Faltam X kcal" no lugar do saldo negativo. O dia fecha sozinho à meia-noite',
    'Peso já vem com o último valor e mostra a tendência; turno em botões. Minhas metas em Mais (treinos, calorias, macros e água num lugar só)',
    'Dentro de cada seção a grade de abas vira uma linha "⌂ Academia · Trocar". Blocos num estilo só e sem "Próximo bloco"',
    'Fotos de exercício com imagem reserva quando não há internet; aviso de série aparece embaixo, sem cobrir o ✕',
    'Tutorial guiado das telas novas: abre sozinho na primeira vez, fica em Mais e o botão ? no topo de cada seção explica só aquela tela',
    'Planilha Google sem script: em Mais, toque em "Entrar com Google". O app cria a planilha no seu Drive, sincroniza sozinho e faz um backup por semana. Num celular novo, entre com a mesma conta e tudo volta',
    'Nova variante Forja Essencial (Comida, Água, Atividade, Peso e Meus dados), com meta de calorias que muda conforme a atividade lançada'
  ]},
  {v:'2.9.2',date:'2026-10-22',items:[
    'Correção: backups antigos (arquivos "forja-treino-backup-….json" das versões anteriores) agora são aceitos ao importar. Antes o app respondia "Formato de backup inválido" porque esses arquivos não trazem o campo de versão. Restaura treinos, fotos e dicas dos exercícios, grupos musculares, peso, medidas e fotos de progresso'
  ]},
  {v:'2.9.1',date:'2026-10-21',items:[
    'Pop-up do exercício: no treino, cada exercício vira uma linha (foto, nome, séries feitas). Ao tocar, abre uma janela com carga, repetições, "Repetir última série" e Finalizar. Ao finalizar o exercício, a janela fecha e ele ganha ✓. O botão voltar do celular também fecha a janela',
    'Toast "Desfazer" ao registrar cada série',
    'Mini gráfico da carga das últimas sessões dentro do pop-up do exercício',
    'Barra do treino fixa no topo com o tempo e o contador de séries e exercícios',
    'Tela "Treino concluído!" ao finalizar: minutos, séries, kg levantados, kcal estimadas, recordes e exercícios feitos',
    'Novo bloco "Evolução dos treinos": barras com rolagem para o lado (calorias, duração ou volume por treino)',
    'Botão "Próximo bloco ▸" no fim de cada bloco: fecha o atual e abre o seguinte',
    'Escolher exercício: busca agora fica no topo'
  ]},
  {v:'2.9.0',date:'2026-10-21',items:[
    'Voltou a diagramação antiga do Início (botões das abas em grade no topo): a barra de abas embaixo e o menu em quadrados/flor foram removidos',
    'Início com mais recursos visuais: cartão-resumo com saudação, data, anel dos treinos da semana e botão "Treinar"; botões das abas e cartões com efeito vidro; setinha dos blocos fechados pulsando',
    'Números do dia agora deslizam para o lado, em 2 linhas, em vez de uma lista longa; o cartão da água fica alto, com a garrafa'
  ]},
  {v:'2.8.3',date:'2026-10-21',items:[
    'Carga do exercício: botões −5, −2,5, +2,5 e +5 maiores, e novas setas ‹ › ao lado do peso que mudam 0,1 kg a cada toque'
  ]},
  {v:'2.8.2',date:'2026-10-21',items:[
    'Menu do Início em quadrados de vidro, na paleta do Forja: cartão grande com o anel dos treinos da semana e 6 atalhos (Corrida, Natação, CrossFit, Água, Cardápio, Progresso) com ícones de linha em vermelho'
  ]},
  {v:'2.8.1',date:'2026-10-21',items:[
    'Menu do Início redesenhado: 6 pétalas grandes e coloridas (Corrida, Natação, CrossFit, Água, Cardápio, Progresso) com ícones de linha, brilho e centro em vidro com o anel dos treinos',
    'Biblioteca, Prêmios, Relatórios e Importar agora ficam em "Outras seções", no topo de Mais'
  ]},
  {v:'2.8.0',date:'2026-10-21',items:[
    'Nova navegação: barra fixa embaixo, em vidro, com Início, Academia, Dieta, Corpo e Mais. Os botões grandes do topo saíram e sobra bem mais tela para o conteúdo',
    'Início com menu em flor: cada pétala leva a uma seção (Corrida, Natação, CrossFit, Água, Cardápio, Biblioteca, Progresso, Prêmios, Relatórios, Importar). No centro, o anel dos treinos da semana. Seções escondidas em Mais → abas visíveis somem da flor',
    'Efeito vidro nos cartões e a setinha dos blocos fechados agora pulsa de leve, indicando que dá para abrir'
  ]},
  {v:'2.7.1',date:'2026-10-21',items:[
    'Academia menos "redonda": pílula só nos botões principais (Iniciar, Registrar, Finalizar); o resto em quadrados de cantos suaves, com formas variadas',
    'Descanso virou um chip pequeno ("⏱ Descanso 60s"): toque nele para abrir uma janelinha com −15s, +15s e iniciar agora',
    '"Mais opções" do exercício agora abre como janela deslizante embaixo da tela (dica, foto, vídeo, histórico, progressão), com botão ✕ para fechar',
    'Botões e repetições um pouco maiores para tocar com mais facilidade'
  ]},
  {v:'2.7.0',date:'2026-10-21',items:[
    'Academia com visual novo, mais arredondado e sem espaços vazios: cartões de meta semanal (anel), séries, quilos levantados e calorias estimadas do treino; botão "Iniciar treino" em pílula; descanso numa barra compacta',
    'Card do exercício redesenhado: miniatura redonda ao lado do nome, dica de uma linha, carga numa pílula, repetições em bolinhas (deslize para ver mais), séries feitas em etiquetas e botão "↻ Repetir última série"',
    'Calorias estimadas do treino (MET × seu peso × tempo): usa o último peso registrado em Corpo (75 kg se não houver). É uma estimativa, pode variar uns 20–30%',
    'Escolher exercício com filtros, busca e lista também arredondados'
  ]},
  {v:'2.6.0',date:'2026-10-20',items:[
    'Todos os exercícios agora aparecem em português (900+ nomes traduzidos). Você pode buscar em português ou em inglês — "crucifixo", "remada", "fly" e "row" acham o mesmo exercício. O histórico, as cargas e as fotos que você já tinha continuam intactos',
    'Filtros claros por grupo muscular em todo lugar: Peito, Costas, Ombro, Bíceps, Tríceps, Abdômen, Perna, Glúteo, Panturrilha e Cardio (saíram os filtros confusos Superior/Inferior/Push/Pull/Pernas). Exercício sem categoria salva agora é classificado pela biblioteca, em vez de cair sempre em "Peito"',
    'Fotos de exercício aparecem inteiras (sem cortar o topo) em todo o app, e dá pra tocar na foto do treino pra ver ampliada',
    'Segurar o dedo num exercício não abre mais o menu do navegador ("salvar imagem / abrir link") — só a janela grande com a foto, nome em português e inglês',
    'Card do exercício no treino redesenhado: foto no topo, nome e músculo, carga numa linha só, repetições e pronto. Dica, vídeo, histórico, análise de progressão e modo de peso ficam em "Mais opções" (fechado por padrão). O X branco virou uma lixeira discreta',
    'Mapa muscular (o bonequinho) agora fica recolhido numa linha só; toque pra abrir/fechar, e o app lembra sua escolha',
    'Fotos que você tirou dos exercícios voltam a aparecer na lista "Meus exercícios", mesmo que o exercício ainda não tenha sido registrado em treino; botão 📷 pra tirar ou trocar a foto direto no card do treino e na biblioteca',
    'Instalar pelo Chrome: o app agora tem manifesto e ícones de verdade (antes eram embutidos e o Chrome não aceitava instalar). Em Mais → "Instalar o app" aparece o botão (ou o passo-a-passo). Depois de instalado, ele se atualiza sozinho quando você abre com internet',
    'Dieta: o app agora lê proteína, carboidrato e gordura (não só kcal) do texto do Gemini, usando a linha "Total". Um toque em "Lançar no dia de hoje" já soma no dia, sem escolher refeição',
    'Botões rápidos automáticos: cada item que você lança vindo do Gemini (ex.: whey) vira um botão; toque nele pra lançar de novo na hora. Dá pra apagar os que não quiser',
    'Planilha Google como servidor (Mais → Planilha Google): cole o script na sua planilha, conecte com endereço e senha, e os dados sincronizam sozinhos entre celulares e tablets. Se dois aparelhos mudarem ao mesmo tempo, as listas são unidas sem perder nada',
    'Blocos abrir/fechar (as faixas coloridas) em todas as abas, não só em Mais: só o principal fica aberto; histórico, calendário, meta e mapa ficam recolhidos, e o app lembra o que você abriu. Durante o treino os exercícios continuam abertos',
  ]},
  {v:'2.5.2',date:'2026-10-04',items:[
    'Correção importante: o cache do modo offline (v2.4.0) estava preso num nome fixo e nunca era renovado sozinho — isso fez o app voltar a mostrar, pra quem já tinha aberto antes, o erro antigo de "Total: ~295 kcal" mesmo depois de eu já ter corrigido. Agora o cache é amarrado à versão do app: toda atualização futura limpa o cache antigo automaticamente, sem depender de eu lembrar disso',
  ]},
  {v:'2.5.1',date:'2026-10-04',items:[
    'Foto da refeição: agora dá pra escrever (ou ditar por voz, 🎤) uma observação antes de analisar — tipo "é um salgado de frango" — pra completar o que a foto sozinha não mostra, igual ao fluxo que já funcionava direto no Gemini',
    'A foto só é enviada pro Gemini depois que você aperta "Analisar", não mais assim que escolhe — dá tempo de escrever/ditar a observação primeiro',
    'Resultado da foto agora mostra os itens identificados um a um (com kcal de cada), não só o total',
  ]},
  {v:'2.5.0',date:'2026-10-04',items:[
    'Dieta bem mais simples: a aba agora destaca só "Lançamento Rápido" (foto, texto do Gemini ou print do Zepp) — sem escolher tipo de refeição nem separar por item',
    'Foto da refeição analisada dentro do próprio app (usa sua chave grátis do Gemini, configurada uma vez em Mais → Integrações) — não precisa mais abrir o Gemini à parte',
    'Correção: o gráfico/anéis de "quanto já comi hoje" não atualizava sozinho depois de lançar — agora atualiza na hora, sem precisar trocar de aba',
    'O lançamento manual antigo (tipo de refeição, código de barras, tabela de alimentos, cadastro de produto) continua disponível, só que escondido em "Avançado" — a maioria nunca vai precisar abrir',
    'Correção: colar texto do Gemini com "Total: ~295 kcal" (com til/aproximado) não era reconhecido e dava erro — agora "~", "≈", "aprox." e "cerca de" antes do número são aceitos',
  ]},
  {v:'2.4.0',date:'2026-10-03',items:[
    'Água: botões instantâneos de +50/−50ml e atalhos de 200/300/500/700ml (sem precisar confirmar), além de arrastar o dedo na garrafinha pra ajustar (na aba Água e no mini-resumo da Início)',
    'Sugestão automática do próximo treino: aponta o grupo muscular mais esquecido (ou nunca treinado), com aviso se bate com o que foi treinado ontem',
    'Favoritos na Biblioteca de Exercícios (estrela em qualquer exercício, filtro "⭐ Favoritos" dedicado)',
    'Lembretes de água reais em segundo plano (Periodic Background Sync) em aparelhos/navegadores compatíveis, com explicação honesta de quando só funciona com o app aberto',
    'Gráfico de peso com linha de tendência (regressão linear) e frase em português dizendo se está ganhando ou perdendo peso e a que ritmo',
    'Backup automático diário pra Google Drive (drive.file), além do botão de sincronizar agora — requer configurar seu próprio Client ID do Google uma única vez',
    'Aviso de platô sempre visível no card do exercício (sem precisar abrir "Ver análise de progressão"), com sugestão de deload quando aplicável',
    'Modo offline: o app guarda em cache todos os arquivos na primeira abertura com internet e continua abrindo e funcionando sem sinal depois disso (aviso de status em Mais → Sobre o app)',
  ]},
  {v:'2.3.0',date:'2026-09-23',items:[
    'Peso corporal ou "sem peso" por exercício (puxa seu último peso registrado automaticamente, ou esconde a carga pra exercícios só de repetição)',
    'Ajuste fino de repetições (−1/+1) além dos botões rápidos, pra fechar em números intermediários',
    'Este changelog',
  ]},
  {v:'2.2.0',date:'2026-09-22',items:[
    'Fusão completa do módulo de Academia do Claude dentro do app nativo Android',
    'Sessão de treino com cronômetro, séries com aquecimento e RIR, cronômetro de descanso configurável',
    'Diagrama muscular do corpo (frente/costas) destacando grupos trabalhados na sessão',
    'Ciência de progressão: detecção de platô (regressão linear), sugestão de deload, dica de progressão dupla (peso vs reps)',
    'Gráficos de linha de 1RM e Volume Load por exercício (estilo do gráfico de peso)',
    'Calculadora de anilhas, meta semanal de treinos com compensação de semana perdida',
    'Sistema de recompensas: fichas que nunca resetam, bônus de "dia perfeito", cartela semanal, loja de recompensas configurável',
    'Calendário com academia/cardio/foto/água/déficit, cores diferentes, emoji maior em dia de meta batida',
    'Importação por foto do relógio (Zepp, 3 formatos de tela) e da balança de bioimpedância (OKOK) restauradas',
    'Compatibilidade total com o backup já existente — nenhum dado perdido na migração',
  ]},
  {v:'2.0.0',date:'2026-09-17',items:[
    'Versão nativa Android (Capacitor), construída pelo Amauri a partir do artifact do Claude',
    'Armazenamento em IndexedDB no aparelho (mais confiável que a versão web)',
    'OCR (Tesseract + português) embutido no app, funciona offline',
    'CrossFit (WODs e resultados), integração com Strava, Health Connect',
    'Câmera e notificações funcionando de verdade (sem as travas de rodar dentro do Claude)',
  ]},
  {v:'1.14.0',date:'2026-09-13',items:[
    'Reorganização em 9 abas: Início, Treino, Corpo, Progresso, Exercícios, Mais, Importar, Dieta, Cardápio',
    'Correção de bug de fuso horário que fazia treino tardio ser registrado no dia seguinte',
    'Trava de segurança: não dá pra registrar exercício sem apertar "Iniciar Treino"',
    'Edição de dias anteriores (séries de treino e refeições) direto no histórico',
  ]},
  {v:'1.13.0',date:'2026-09-12',items:[
    'Calendário gamificado: dias de academia, cardio (corrida/pedal), foto de evolução, meta de água e déficit calórico, cada um com cor/ícone próprio',
    'Cores diferentes quando academia e cardio acontecem no mesmo dia',
    'Cardio conta pro streak de dias seguidos, não só musculação',
  ]},
  {v:'1.12.0',date:'2026-09-04',items:[
    'Ciência de progressão: Volume Load por exercício, detecção de platô, sugestão de deload, dupla forma de progressão (peso ou reps)',
    'Gráficos de barras por sessão (depois trocados por gráfico de linha na v2.2)',
  ]},
  {v:'1.11.0',date:'2026-09-04',items:[
    'Cardápio semanal (café/jantar/ceia, sem arroz, ovo como proteína principal) com 3 opções alternáveis por refeição',
    'Lista de compras gerada automaticamente, com checkbox de itens já comprados',
    'Meta de déficit calórico ligada à calculadora de calorias, com streak e marcação no calendário',
  ]},
  {v:'1.10.0',date:'2026-09-03',items:[
    'Aba de Dieta com estimativa de calorias por IA a partir de descrição em texto',
    'Anéis circulares de calorias e macros, estilo Zepp',
    'Importação do resumo diário de comida do Zepp por OCR',
  ]},
  {v:'1.9.0',date:'2026-09-12',items:[
    'Importação da balança de bioimpedância (OKOK) por foto: peso, % gordura, massa muscular, água, gordura visceral, metabolismo e mais',
  ]},
  {v:'1.8.0',date:'2026-09-12',items:[
    'Leitura por OCR de 3 formatos diferentes de tela do relógio Zepp (sessão única, lista "Training Balance", lista "Tudo")',
    'Pré-processamento de imagem (contraste) e OCR em português pra melhorar a precisão',
  ]},
  {v:'1.7.0',date:'2026-08-31',items:[
    'Calculadora de calorias (TMB por Mifflin-St Jeor ou Katch-McArdle quando há % de gordura)',
  ]},
  {v:'1.6.0',date:'2026-08-31',items:[
    'Fotos de evolução física por ângulo (frente/lado/costas), com comparador visual antes/depois',
    'Lembrete semanal de foto, opção de ocultar a galeria',
  ]},
  {v:'1.5.0',date:'2026-08-28',items:[
    'Rastreamento de água com garrafa animada e meta diária',
    'Peso corporal e medidas corporais',
  ]},
  {v:'1.4.0',date:'2026-08-27',items:[
    'Calculadora de anilhas (visual, por lado da barra)',
    'Meta semanal de treinos, com compensação quando a semana anterior ficou devendo',
  ]},
  {v:'1.3.0',date:'2026-08-25',items:[
    'Diagrama muscular do corpo, destacando grupos trabalhados na sessão',
    'Cálculo de 1RM estimado (fórmula de Epley) e recordes pessoais',
  ]},
  {v:'1.2.0',date:'2026-08-22',items:[
    'RIR (repetições em reserva) por série, modo aquecimento',
    'Biblioteca de exercícios com fotos e dicas de execução',
  ]},
  {v:'1.1.0',date:'2026-08-20',items:[
    'Sessão de treino com início/fim e cronômetro',
    'Cronômetro de descanso configurável entre séries',
  ]},
  {v:'1.0.0',date:'2026-08-18',items:[
    'Primeira versão: registro de exercício, peso e repetições, histórico por dia',
  ]},
];

function render(){
  const el = root.document.getElementById('changelog-list');
  if(!el) return;
  const verEl = root.document.getElementById('changelog-current-version');
  if(verEl) verEl.textContent = CURRENT_VERSION;
  el.innerHTML = HISTORY.map(entry => `
    <div class="changelog-entry">
      <div class="changelog-head"><span class="changelog-version">v${entry.v}</span><span class="changelog-date">${entry.date.split('-').reverse().join('/')}</span></div>
      <ul class="changelog-items">${entry.items.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>
  `).join('');
}

return { CURRENT_VERSION, HISTORY, render };
});
