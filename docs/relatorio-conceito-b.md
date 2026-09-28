# Relatório — Conceito B

Este relatório será completado com os resultados executados no Firefox depois
da validação do Conceito C.

## Indicadores adicionais do plugin

| Indicador | Evidência | Resultado observado |
| --- | --- | --- |
| Canvas fingerprint | `evidencias/b/canvas-cookie-sync.png` | O popup registrou `getContext`, `getImageData` e `toDataURL`. |
| Cookie-sync por parâmetros | `evidencias/b/canvas-cookie-sync.png` | O popup identificou `uid`, `sync` e `partner_id` em uma requisição de terceiro. |
| Bounce tracking/query parameters | `evidencias/b/query-parameters.png` | O detector registrou os parâmetros no destino; o teste local teve 0 redirects e o teste DDG de redirecionamento ainda está pendente. |

## Páginas DDG adicionais

| Teste | Página | Evidência | Resultado do plugin |
| --- | --- | --- | --- |
| Tracker Blocking / Request Blocking | https://privacy-test-pages.site/privacy-protections/request-blocking/ | A preencher | A preencher |
| Storage partitioning | https://privacy-test-pages.site/privacy-protections/storage-partitioning/ | A preencher | A preencher |
| Query Parameters | https://privacy-test-pages.site/privacy-protections/query-parameters/ | `evidencias/b/query-parameters.png` | O popup marcou possível bounce tracking e mostrou `utm_source`, `utm_medium` e `fbclid`; foram observados 0 redirects nessa navegação direta. |
| Bounce tracking | https://privacy-test-pages.site/privacy-protections/bounce-tracking/ | A preencher | A preencher |

## Reconciliação nos sites reais

| Site | HAR | Plugin | Blacklight | uBlock Origin | Explicação da divergência |
| --- | --- | --- | --- | --- | --- |
| Wikipedia | `evidencias/sites/wikipedia/wikipedia.har` | A preencher | A preencher | A preencher | A preencher |
| UOL | `evidencias/sites/uol/uol.har` | A preencher | A preencher | A preencher | A preencher |
| Globo | `evidencias/sites/globo/globo.har` | A preencher | A preencher | A preencher | A preencher |

### Observação metodológica

O Privacy Inspector observa o tráfego e as APIs da página no Firefox. O
Blacklight faz uma análise automatizada própria e o uBlock Origin aplica suas
listas de bloqueio. Por isso, uma divergência entre as ferramentas será
explicada pelo tipo de observação, pelo momento do carregamento e pela lista de
domínios/recursos usada por cada ferramenta.
