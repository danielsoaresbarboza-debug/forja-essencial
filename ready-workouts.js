/* Treinos prontos por objetivo — modelos de programação baseados em estrutura clássica
   (full body / push-pull-legs / HIIT / força pra corrida / funcional misto), usando nomes
   de exercício que já existem na biblioteca (wger + free-exercise-db) pra aparecer com foto.
   Cada "dia" vira um Grupo de Treino separado que o usuário pode editar, renomear ou apagar
   como qualquer outro grupo criado manualmente. */
(function(root){
  'use strict';
  const READY_WORKOUTS=[
    {
      id:'emagrecimento',
      icon:'🔥',
      name:'Emagrecimento',
      subtitle:'Full body em circuito, 3x/semana',
      description:'Treino de corpo todo com poucos exercícios por grupo muscular e descanso curto entre séries, pra manter a frequência cardíaca alta e queimar mais caloria por sessão. Ideal pra quem tem pouco tempo e quer treinar o corpo inteiro 3x por semana.',
      days:[
        {label:'Emagrecimento A',exercises:['Goblet Squat','Dumbbell Bench Press','Bent Over Barbell Row','Mountain Climbers','Plank']},
        {label:'Emagrecimento B',exercises:['Dumbbell Lunges','Seated Dumbbell Press','Lat Pulldown','Russian Twist','Burpee']},
        {label:'Emagrecimento C',exercises:['Leg Press','Push Up','Seated Cable Rows','Cable Crunch','Jumping Jacks']}
      ]
    },
    {
      id:'hipertrofia',
      icon:'💪',
      name:'Ganhar Massa Muscular',
      subtitle:'Push / Pull / Legs, foco em sobrecarga progressiva',
      description:'Divisão clássica de 3 dias (empurrar / puxar / pernas) com exercícios compostos pesados seguidos de isoladores, pra maximizar volume por grupo muscular. Funciona melhor treinando 4 a 6x por semana (cada dia 1 a 2x na semana).',
      days:[
        {label:'Hipertrofia - Push',exercises:['Barbell Bench Press - Medium Grip','Standing Military Press','Barbell Incline Bench Press - Medium Grip','Side Lateral Raise','Triceps Pushdown','EZ-Bar Skullcrusher']},
        {label:'Hipertrofia - Pull',exercises:['Pullups','Bent Over Barbell Row','Seated Cable Rows','Face Pull','Barbell Curl','Alternate Hammer Curl']},
        {label:'Hipertrofia - Legs',exercises:['Barbell Squat','Romanian Deadlift','Leg Press','Leg Extensions','Lying Leg Curls','Standing Calf Raises']}
      ]
    },
    {
      id:'cardio',
      icon:'🫀',
      name:'Cardio / HIIT',
      subtitle:'Intervalado de alta intensidade, 20-25 min',
      description:'Circuito intervalado (alternando esforço alto e descanso curto) pra melhorar capacidade cardiorrespiratória e queimar caloria em pouco tempo. Pode ser feito com pouco ou nenhum equipamento.',
      days:[
        {label:'Cardio / HIIT',exercises:['Burpee','Mountain Climbers','Jumping Jacks','Box Jump','Russian Twist','Plank']}
      ]
    },
    {
      id:'corrida',
      icon:'🏃',
      name:'Melhorar na Corrida',
      subtitle:'Força de posterior, glúteo e core pra corredores',
      description:'Treino de força complementar focado nos grupos que mais sustentam a corrida (posterior de coxa, glúteo, panturrilha e core) e um pouco de pliometria pra potência de passada. Não substitui o treino de corrida em si — é pra fazer 2x/semana além dele.',
      days:[
        {label:'Força p/ Corrida',exercises:['Romanian Deadlift','Barbell Hip Thrust','Bulgarian Split Squat','Standing Calf Raises','Plank','Box Jump']}
      ]
    },
    {
      id:'funcional-misto',
      icon:'🤸',
      name:'Funcional Misto (CrossFit + Musculação)',
      subtitle:'Movimentos funcionais combinados com levantamento tradicional',
      description:'Mistura movimentos de CrossFit (explosivos, multiarticulares) com exercícios de academia tradicional, pra ganhar força e condicionamento ao mesmo tempo. Bom pra quem gosta de variedade e não quer só musculação pura.',
      days:[
        {label:'Funcional Misto',exercises:['Barbell Squat','Clean','Pullups','Burpee','Kettlebell Thruster','Box Jump','Farmer\'s Walk']}
      ]
    },
    {
      id:'full-body-iniciante',
      icon:'🌱',
      name:'Full Body Iniciante',
      subtitle:'Base simples pra quem tá começando agora',
      description:'Um único treino de corpo inteiro com movimentos básicos, pra aprender a técnica e construir uma base antes de avançar pra divisões mais específicas. Recomendado 2 a 3x por semana com descanso entre os dias.',
      days:[
        {label:'Full Body Iniciante',exercises:['Bodyweight Squat','Push Up','Seated Cable Rows','Seated Dumbbell Press','Plank','Dumbbell Bicep Curl']}
      ]
    }
  ];
  root.ForjaReadyWorkouts=READY_WORKOUTS;
})(typeof globalThis!=='undefined'?globalThis:this);
