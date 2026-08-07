# Regras dos Cards de Tempo

Este documento descreve as regras atuais de calculo dos cards da secao **Tempo Medio no Comercial** do dashboard.

## Escopo

As regras abaixo se aplicam aos cards renderizados no bloco `tempo` em `scripts/dashboard.js`:

- Cards principais (4):
  - Chegada -> Assinatura
  - Chegada -> Docs Solic.
  - Chegada -> Docs Rec.
  - Chegada -> Entrega
- Cards de detalhamento (4):
  - Assinatura -> Solic. Docs
  - Solic. -> Docs Rec.
  - Docs Rec. -> Entrega
  - Envio -> Assinatura

## Regra 1: universo de dados (periodo)

1. O dashboard primeiro aplica o filtro de periodo ativo:
   - Se estiver em acumulado, usa todos os registros.
   - Se estiver em um mes, usa apenas registros daquele mes.
2. Esse conjunto filtrado eh chamado de `src`.

## Regra 2: base comum dos cards

1. A base comum atualmente eh **todo o conjunto `src`** (todos os registros do periodo).
2. Nao existe restricao de somente concluidos/encerrados para entrar na base.
3. O texto exibido no widget segue esse total:
   - `Base comum: X registros no periodo`.

## Regra 3: fallback progressivo de datas por etapa

Para evitar perder registros quando uma data especifica estiver vazia, o calculo usa fallback progressivo no fluxo:

Fluxo de campos considerado:

1. `dtChegada`
2. `dtContato`
3. `dtEnvioContrato`
4. `dtAssinatura`
5. `dtDocs`
6. `dtDocsRec`
7. `dtEntrega`

Comportamento:

1. Para um campo inicial (`startField`), o sistema tenta a propria data.
2. Se nao existir, procura a proxima data preenchida no fluxo (para frente).
3. Para o campo final (`endField`), aplica a mesma regra.
4. Se nao houver data inicial apos fallback, o registro nao entra no calculo daquela metrica.
5. Se houver inicio, mas nao houver fim:
   - Se o registro estiver em andamento, usa a data de hoje (fuso de Brasilia).
   - Se nao estiver em andamento, o registro nao entra naquela metrica.

## Regra 4: formula de dias por registro

Para cada registro valido na metrica:

`dias = round((dataFinal - dataInicial) / 86400000)`

- O valor minimo eh limitado a `0` quando aplicavel.
- Valores invalidos ou nulos sao descartados.

## Regra 5: formula da media do card

Para cada card:

1. Calcula `dias` para cada registro da base comum usando os campos da metrica.
2. Filtra apenas valores validos (`!= null` e `>= 0`).
3. Calcula media arredondada:

`media = round(soma(dias) / quantidade)`

4. Exibe em dias (`Xd`).
5. Exibe cobertura como `usados/base` (ex.: `218/397 reg.`).

## Regra 6: metas e cores

Cada metrica possui uma meta de referencia (`ref`) em dias.

### Cards principais

- Chegada -> Assinatura: meta <= 10d
- Chegada -> Docs Solic.: meta <= 14d
- Chegada -> Docs Rec.: meta <= 21d
- Chegada -> Entrega: meta <= 30d

### Cards de detalhamento

- Assinatura -> Solic. Docs: meta <= 7d
- Solic. -> Docs Rec.: meta <= 14d
- Docs Rec. -> Entrega: meta <= 7d
- Envio -> Assinatura: meta <= 7d

Cor do valor:

1. Verde: media <= 70% da meta.
2. Ambar: media <= meta.
3. Vermelho: media > meta.
4. Cinza: sem dados validos.

## Regra 7: card Pastas Concluidas (detalhamento)

Esse card nao calcula media de dias.

Ele mostra:

1. Quantidade de concluidas no periodo (`concluidos`).
2. Total de registros no periodo (`src.length`).
3. Taxa percentual: `round(concluidos / total * 100)`.

## Campos usados por metrica

### Principais

- Chegada -> Assinatura: `dtChegada` ate `dtAssinatura`
- Chegada -> Docs Solic.: `dtChegada` ate `dtDocs`
- Chegada -> Docs Rec.: `dtChegada` ate `dtDocsRec`
- Chegada -> Entrega: `dtChegada` ate `dtEntrega`

### Detalhamento

- Assinatura -> Solic. Docs: `dtAssinatura` ate `dtDocs`
- Solic. -> Docs Rec.: `dtDocs` ate `dtDocsRec`
- Docs Rec. -> Entrega: `dtDocsRec` ate `dtEntrega`
- Envio -> Assinatura: `dtEnvioContrato` ate `dtAssinatura`

## Observacoes praticas

1. Dois cards podem ter o mesmo `base`, mas `usados` diferentes, porque cada metrica exige pares de datas distintos.
2. O fallback progressivo reduz perda de amostra quando faltam datas intermediarias.
3. Como existe fallback, o resultado privilegia cobertura operacional do funil, nao somente casos com preenchimento perfeito em todas as etapas.

## Modo de auditoria (novo)

1. O bloco de Tempo possui um botao `Modo auditoria: on/off`.
2. Com auditoria ativa, todos os cards do bloco de Tempo ficam clicaveis:
   - 4 cards principais
   - 4 cards de detalhamento
   - card Pastas Concluidas
3. Ao clicar em um card de metrica, abre um modal com:
   - base no periodo
   - usados no calculo
   - contagem de fallback no inicio e no fim
   - contagem de casos medidos ate hoje
   - tabela de registros com dias, campo inicial/final efetivamente usado e etapa
4. Ao clicar em Pastas Concluidas, o modal mostra a listagem do periodo com flag de concluida (sim/nao), etapa e status.
