# Relatorio - Conceito A

## 1. O que foi acrescentado

O Conceito A aproveita tudo que ja foi feito no B e acrescenta tres partes:

- deteccao de sinais de hijacking e hook;
- uma nota de privacidade de 0 a 100;
- um relatorio por pagina com a nota e os detalhes usados no calculo.

A lista de bloqueio continua personalizada. O usuario pode adicionar um dominio
no popup e a extensao salva essa escolha.

## 2. Deteccao de hijacking e hook

O plugin observa os seguintes sinais:

- WebSocket ou EventSource para um dominio de terceiro;
- requisicoes fetch ou XMLHttpRequest repetidas para o mesmo endereco em pouco tempo;
- troca dos objetos globais fetch, WebSocket, EventSource ou XMLHttpRequest depois
  que a pagina foi carregada.

A pagina `test-pages/a-hijacking.html` foi criada para gerar esses tres casos.
Ela faz requisicoes repetidas, tenta abrir um WebSocket e altera o objeto global
`fetch` depois de alguns segundos.

Tambem foi executada a pagina js-leaks do DDG. O plugin leu as mudancas
mostradas pela pagina e registrou o resultado no relatorio.

## 3. Metodologia da nota

A nota comeca em 100. Os descontos sao sempre limitados para evitar que um
unico tipo de sinal domine todo o resultado.

| Criterio | Desconto | Motivo |
| --- | ---: | --- |
| Cada dominio de terceiro | 5 pontos, ate 15 | Um dominio externo pode receber dados da pagina. |
| Cada grupo de 5 requisicoes de terceiros | 5 pontos, ate 20 | Muitas conexoes externas aumentam a exposicao. |
| Cada cookie de terceiro | 5 pontos, ate 20 | O cookie pode acompanhar o usuario entre paginas. |
| Leitura de canvas | 10 pontos | O desenho lido pode ajudar a diferenciar o navegador. |
| Possivel cookie-sync | 15 pontos | Parametros de identificacao foram enviados a outro dominio. |
| Possivel bounce tracking | 15 pontos | Houve passagem por uma pagina intermediaria com identificadores. |
| Possivel hijacking ou hook | 20 pontos | A pagina abriu canal persistente, fez polling repetido ou alterou objeto global. |

A nota final fica entre 0 e 100. O uso simples de localStorage, sessionStorage
ou IndexedDB nao recebe desconto sozinho, porque armazenar dados nao prova que
houve rastreamento. Requisicoes bloqueadas tambem nao recebem desconto.

## 4. Aplicacao nos tres sites

Os sites usados foram os mesmos do Conceito B:

| Site | Requisicoes externas observadas | Cookies de terceiros | Nota observada |
| --- | ---: | ---: | ---: |
| ITA | 5 | 0 | 90 |
| Termo | 2 | 0 | 80 |
| Python | 8 | 0 | 80 |

Essas sao as notas mostradas pelo popup depois dos testes finais. Os prints
correspondentes estao em:

- ITA: `evidencias/sites/ita/a-score.png`;
- Termo: `evidencias/sites/termo/a-score.png`;
- Python: `evidencias/sites/python/a-score.png`.

No ITA, a nota foi 90 porque foram observados dominios e requisicoes externas.
No Termo e no Python, a nota foi 80 pelos dominios e requisicoes externas
observados. Nao foram descontados cookies de terceiros nesses tres testes.

## 5. Comparacao com o Blacklight

O Privacy Inspector conta requisicoes e APIs observadas no Firefox. O Blacklight
faz uma classificacao propria, principalmente de rastreadores de anuncios.
Por isso, os resultados podem divergir sem que um deles esteja necessariamente
errado.

No ITA e no Termo, o plugin contou conexoes com Google Analytics e Google Tag
Manager, enquanto o Blacklight apontou um rastreador de anuncios. No Python, o
plugin contou oito conexoes externas, mas o Blacklight apontou zero rastreadores
de anuncios. A explicacao e que uma conexao externa ou um servico de erro nao
e automaticamente classificado como rastreador de anuncios.

## 6. Evidencias registradas

- `evidencias/sites/ita/a-score.png`: popup com nota 90/100 no ITA;
- `evidencias/sites/termo/a-score.png`: popup com nota 80/100 no Termo;
- `evidencias/sites/python/a-score.png`: popup com nota 80/100 no Python;
- `evidencias/a/hijacking-local.png`: teste local com alteracao do objeto global
  `fetch`, resultando em nota 70/100 e indicacao de possivel hijacking/hook;
- `evidencias/a/js-leaks.png`: pagina js-leaks do DDG com 96 propriedades
  adicionadas, 17 removidas e 45 alteradas, resultando em nota 80/100.

As evidencias mostram tanto o funcionamento do detector de hijacking/hook quanto
o funcionamento da nota de privacidade em tres sites reais. Com isso, o
requisito do Conceito A fica documentado para a entrega.
