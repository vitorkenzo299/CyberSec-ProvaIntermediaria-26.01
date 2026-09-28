# CyberSec-ProvaIntermediaria-26.01

Extensão Firefox para inspeção de indicadores de privacidade.

## Testes locais

- `test-pages/basic.html`: carregamento do popup e identificação da página;
- `test-pages/storage.html`: `localStorage`, `sessionStorage` e `IndexedDB`;
- `test-pages/third-party.html`: requisições para domínio de terceiro.
- `test-pages/b-indicators.html`: leitura de canvas e parâmetros de uma requisição de terceiro.
- `test-pages/query-bounce.html`: parâmetros de rastreamento em uma navegação.

As páginas devem ser abertas depois de recarregar a extensão em
`about:debugging`.
