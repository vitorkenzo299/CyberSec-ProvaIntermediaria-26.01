# Relatório — Conceito B

## 1. Objetivo

O objetivo do plugin é mostrar sinais simples de rastreamento em uma página.
Ele observa conexões com outros domínios, cookies, armazenamento do navegador,
uso de canvas e parâmetros usados em links de rastreamento.

## 2. Como os testes foram feitos

Os testes foram feitos no Firefox com o plugin carregado. Depois de abrir cada
página, o popup do plugin foi aberto para conferir o resultado.

Os arquivos HAR foram salvos pelo painel de rede do Firefox. Eles mostram as
requisições feitas durante o carregamento dos sites.

## 3. Resultados dos indicadores do plugin

### 3.1 Canvas

Foi criada uma página de teste que desenha uma imagem em um canvas e depois lê
o resultado. O plugin mostrou três acessos:

- `getContext`;
- `getImageData`;
- `toDataURL`.

Isso mostra que o plugin consegue perceber quando uma página usa o canvas para
obter informações do navegador.

Evidência: `evidencias/b/canvas-cookie-sync.png`.

### 3.2 Possível cookie-sync

A página de teste fez uma requisição para `example.com` com os parâmetros
`uid`, `sync` e `partner_id`. O plugin mostrou a requisição e identificou esses
parâmetros.

Esse resultado é apresentado como possível cookie-sync porque a extensão não
pode afirmar sozinha a intenção do site. Ela apenas mostra o sinal encontrado.

Evidência: `evidencias/b/canvas-cookie-sync.png`.

### 3.3 Parâmetros de rastreamento

Foi testada uma navegação com os parâmetros `utm_source`, `utm_medium` e
`fbclid`. O plugin marcou a página como possível bounce tracking e mostrou os
parâmetros no popup.

Nesse teste direto não houve redirecionamento. Por isso, o resultado mostrou
`0 redirect(s)`. Isso confirma a leitura dos parâmetros, mas não confirma ainda
um caso completo de bounce tracking.

Evidência: `evidencias/b/query-parameters.png`.

### 3.4 Bounce tracking

No teste oficial, o navegador passou por `bad.third-party.site` antes de
chegar a `www.publisher-company.site`. A extensão mostrou:

- 1 redirecionamento;
- a rota `bad.third-party.site -> www.publisher-company.site`;
- os parâmetros `bounceUIDlocalStorage`, `bounceUIDcookie` e `isNew`.

Isso indica que um domínio intermediário recebeu identificadores e os passou
para o destino final.

Evidência: `evidencias/ddg/bounce-tracking.png`.

### 3.5 Tracker blocking

No teste de bloqueio, a página tentou fazer 22 requisições para
`bad.third-party.site`. O plugin mostrou 22 requisições bloqueadas. A página
também marcou os testes impedidos com os indicadores de falha.

O domínio usado no teste aparece na lista de bloqueio do popup.

Evidência: `evidencias/ddg/tracker-blocking.png`.

### 3.6 Storage partitioning

O teste do DDG consultou 21 mecanismos de armazenamento. `localStorage`,
`sessionStorage`, `IndexedDB` e Cache API passaram. Os testes de cookies
falharam, mostrando que os cookies ainda foram compartilhados entre as
origens. O WebSQL apareceu como não suportado pelo navegador.

No mesmo teste, a extensão registrou 3 requisições de terceiros, 10 cookies e
acessos a localStorage, sessionStorage e IndexedDB.

Evidência: `evidencias/ddg/storage-partitioning.png`.

## 4. Sites reais analisados

Os três sites escolhidos foram:

| Site | Endereço | Arquivo HAR | Entradas |
| --- | --- | --- | ---: |
| ITA | http://www.ita.br/ | `evidencias/sites/ita/ita.har` | 46 |
| Termo | https://term.ooo/ | `evidencias/sites/termo/termo.har` | 7 |
| Python | https://www.python.org/ | `evidencias/sites/python/python.har` | 31 |

Também foram salvas capturas do popup nos três sites:

- ITA: `evidencias/sites/ita/plugin.png`;
- Termo: `evidencias/sites/termo/plugin.png`;
- Python: `evidencias/sites/python/plugin.png`.

Os três arquivos foram validados como HAR e possuem as requisições dos sites.

## 5. Testes adicionais do DuckDuckGo Privacy Test Pages

Estas são as páginas que precisam ser executadas para completar a comparação do
Conceito B:

| Teste | Página | Evidência | Situação |
| --- | --- | --- | --- |
| Tracker Blocking / Request Blocking | https://privacy-test-pages.site/privacy-protections/request-blocking/ | `evidencias/ddg/tracker-blocking.png` | Executado: 22 requisições bloqueadas. |
| Storage partitioning | https://privacy-test-pages.site/privacy-protections/storage-partitioning/ | `evidencias/ddg/storage-partitioning.png` | Executado: 21 mecanismos testados. |
| Query Parameters | https://privacy-test-pages.site/privacy-protections/query-parameters/ | `evidencias/b/query-parameters.png` | Executado parcialmente com teste local equivalente. |
| Bounce tracking | https://privacy-test-pages.site/privacy-protections/bounce-tracking/ | `evidencias/ddg/bounce-tracking.png` | Executado: 1 redirecionamento identificado. |

O plugin também foi preparado para observar páginas dentro de frames. Além
disso, ele conta requisições que terminaram com erro. Uma falha não é tratada
automaticamente como bloqueio, porque também pode ser causada por uma queda de
rede ou por um endereço indisponível.

## 6. Comparação com Blacklight e uBlock Origin

A coluna do Privacy Inspector foi preenchida com as capturas feitas no
Firefox. As colunas do Blacklight e do uBlock também foram preenchidas usando
os mesmos endereços dos três sites.

| Site | Privacy Inspector | Blacklight | uBlock Origin |
| --- | --- | --- | --- |
| ITA | 5 requisições de terceiros: Google Analytics e Google Tag Manager; 5 cookies próprios. | 1 ad tracker; 0 cookies de terceiros. | 0 bloqueios nesta página; 1 bloqueio desde a instalação. |
| Termo | 2 requisições de terceiros: Google Analytics e Google Tag Manager; 2 cookies próprios. | 1 ad tracker; 0 cookies de terceiros. | 0 bloqueios nesta página; 1 bloqueio desde a instalação. |
| Python | 8 requisições de terceiros; 2 falhas; sem cookies observados. | 0 ad trackers; 0 cookies de terceiros. | 2 bloqueios nesta página; 2 bloqueios desde a instalação. |

Prints do Blacklight:

- ITA: `evidencias/sites/ita/blacklight.png`;
- Termo: `evidencias/sites/termo/blacklight.png`;
- Python: `evidencias/sites/python/blacklight.png`.

Print do uBlock já salvo:

- ITA: `evidencias/sites/ita/ublock.png`;
- Termo: `evidencias/sites/termo/ublock.png`;
- Python: `evidencias/sites/python/ublock.png`.

Os prints dos dois programas foram salvos para cada site. Assim a comparação
fica baseada nos mesmos testes.

Essas ferramentas podem mostrar resultados diferentes porque usam listas e
métodos de observação diferentes. O plugin observa as requisições e APIs da
página no Firefox. O Blacklight faz uma análise própria. O uBlock Origin usa
suas listas de bloqueio.

A principal diferença observada foi que o Privacy Inspector contou serviços
externos usados pelas páginas, enquanto o Blacklight classificou apenas parte
deles como rastreadores de anúncios. O uBlock bloqueou algumas requisições do
Python, mas não bloqueou requisições na página do ITA ou do Termo no momento
do teste. Isso mostra que cada ferramenta mede uma coisa diferente.

## 7. Conclusão

A extensão já mostra canvas, possível cookie-sync, bounce tracking, bloqueio de
requisições e armazenamento. Os testes DDG adicionais também foram executados
e registrados.

A comparação dos três sites com Blacklight e uBlock Origin também foi registrada,
com os respectivos prints e arquivos HAR. Com isso, a parte documental do
Conceito B está pronta para conferência e teste final.
