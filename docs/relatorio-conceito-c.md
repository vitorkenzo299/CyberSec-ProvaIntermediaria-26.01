# Relatório — Conceito C

## Metodologia

Cada página deve ser carregada com o Privacy Inspector já ativo. Depois do
carregamento, o popup deve ser aberto e capturado junto com a página analisada.
Os resultados abaixo devem ser preenchidos somente após a execução real dos
testes.

## DuckDuckGo Privacy Test Pages

| Teste | Página | Resultado esperado | Resultado do plugin | Divergência e evidência |
| --- | --- | --- | --- | --- |
| Tracker Reporting | https://privacy-test-pages.site/tracker-reporting/1major-via-script.html | Uma requisição de rastreador é carregada via script. | 1 requisição de terceiro, `doubleclick.net`; 0 cookies; nenhum item de armazenamento. | `evidencias/ddg/tracker-reporting.png` |
| Storage Blocking | https://privacy-test-pages.site/privacy-protections/storage-blocking/ | A página tenta armazenar e recuperar um valor usando mecanismos de armazenamento. | Página reportou 23 mecanismos testados e 1 falha; plugin registrou 26 requisições de terceiros, 7 cookies persistentes de primeira parte e acessos a `localStorage`, `sessionStorage` e `IndexedDB`. | `evidencias/ddg/storage-blocking.png` |
| Fingerprinting | https://privacy-test-pages.site/privacy-protections/fingerprinting/ | A página coleta propriedades do navegador usadas para fingerprinting. | Página coletou 124 datapoints, com 14 falhas; plugin registrou o carregamento da página e acessos de armazenamento. | `evidencias/ddg/fingerprinting-canvas.png` |
| Fingerprinting/canvas | https://privacy-test-pages.site/privacy-protections/fingerprinting/ | A seção Canvas visual check verifica o comportamento de renderização do canvas. | A seção Canvas visual check foi executada/visualizada; o plugin não apresenta um indicador específico de canvas nesta versão. | `evidencias/ddg/fingerprinting-canvas.png` |

## Sites reais escolhidos

| Site | URL | HAR entregue | Validação do arquivo |
| --- | --- | --- | --- |
| Wikipedia | https://www.wikipedia.org/ | `evidencias/sites/wikipedia/wikipedia.har` | HAR válido, 12 entradas |
| UOL | https://www.uol.com.br/ | `evidencias/sites/uol/uol.har` | HAR válido, 246 entradas |
| Globo | https://www.globo.com/ | `evidencias/sites/globo/globo.har` | HAR válido, 127 entradas |

## Critério de comparação

### Observação sobre o Tracker Reporting

O plugin observou a requisição para `doubleclick.net`, coerente com o teste que
carrega um rastreador por script. O popup também registra uma consulta aos
mecanismos de armazenamento, mas não encontrou itens criados pela página. Isso
é diferente de detectar uma gravação: a extensão consulta as APIs para medir o
estado atual.

### Observação sobre o Storage Blocking

O teste DDG reportou 23 mecanismos de armazenamento, com 1 falha. O plugin
observou 26 requisições de terceiros, 7 cookies persistentes de primeira parte e
acessos aos três mecanismos HTML5, mas mostrou 0 itens enumerados. A diferença
ocorre porque o coletor atual observa a página principal e não enumera todos os
mecanismos/origens auxiliares usados pelo teste DDG.

### Observação sobre Fingerprinting/canvas

O teste exibiu 124 datapoints coletados e 14 falhas, além da verificação visual
de canvas. O plugin registrou a página e seus sinais gerais, mas não classificou
o uso de canvas como um indicador separado. Essa limitação é registrada como
resultado observado, sem afirmar que o canvas foi detectado.

## Conclusão do Conceito C

O plugin foi carregado no Firefox e apresentou os indicadores básicos de
conexões de terceiros, cookies e armazenamento HTML5. Os três testes mínimos do
DuckDuckGo foram executados e documentados em `evidencias/ddg/`. Os três sites
reais possuem arquivos HAR válidos em `evidencias/sites/`.

As comparações detalhadas com Blacklight e uBlock Origin, a diferenciação
avançada de cookies, canvas e bounce tracking ficam registradas como próxima
etapa do Conceito B.

