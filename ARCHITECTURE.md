# Arquitetura e cobertura do desafio

## Responsabilidades implementadas

- React e TypeScript implementam a interface. TanStack Router controla as rotas declaradas; TanStack Query gerencia o estado remoto do catálogo, dos detalhes e do carrinho.
- `src/lib/api.ts` configura o transporte Axios (`/api`, timeout de 8 segundos).
- TanStack Router controla a navegação e os parâmetros tipados de busca do catálogo. Busca, categoria, ordenação, rede, limite de preço e página são serializados na URL; mudar filtros reinicia a página em 1.
- MSW intercepta no navegador as chamadas REST do catálogo, carrinho, pedidos e conta. Os dados-base ficam em `src/mocks/fixtures`; os handlers simulam estoque e mutações do carrinho.
- O cliente usa `socket.io-client`; `@mswjs/socket.io-binding` simula o transporte WebSocket. `nft.updated` atualiza catálogo, detalhe e carrinho somente quando a versão recebida é mais nova. Na reconexão, as consultas ativas são invalidadas. A criação simulada de pedido emite `order.updated` apenas aos clientes inscritos pelo proprietário.
- O MSW começa após a primeira renderização; o interceptor Axios aguarda a inicialização antes de enviar as consultas, evitando chamadas sem mock e permitindo que a imagem principal apareça primeiro. `?scenario=slow` e `?scenario=variable-latency` ativam atrasos de rede determinísticos/configuráveis.
- O MSW também fornece cadastro, login, sessão e logout. As senhas dos usuários simulados são persistidas como digests SHA-256; o navegador armazena o token e recupera o perfil público pela API de sessão.
- Perfil e senha usam endpoints protegidos e persistência simulada. O cadastro de avatar aceita URL e valida nome/e-mail; a troca de senha valida a senha atual e nunca persiste senha em texto puro.
- Carteiras ficam isoladas por usuário, com cadastro, validação de endereço, seleção de principal, edição de nome/rede e remoção. O checkout só aceita endereço cadastrado para a rede selecionada e exige conexão simulada.
- Favoritos são persistidos por usuário nos mocks REST. A interface os atualiza de forma otimista e restaura o estado anterior se a mutação falhar.
- Cupons são validados pela API; `KURIO10` aplica 10%, `EXPIRED10` representa expiração e códigos inválidos retornam 422. O carrinho persiste o cupom e recalcula o snapshot de subtotal, desconto, taxa e total.
- Os carrinhos simulados são separados por usuário. Há um carrinho de visitante que é migrado para a primeira conta autenticada que o consulta. Pedidos e consultas de recibo são limitados ao proprietário; a rota verifica o pedido na API antes de confirmar a compra.
- As tentativas de pedido reutilizam uma chave de idempotência guardada na sessão do navegador. Pedidos simulados registram os itens e valores no momento da criação, reduzem o estoque e removem do carrinho as quantidades compradas.
- O checkout e os endpoints de perfil, carteira, favorito e pedido exigem sessão. Se a pessoa chegar ao checkout sem login, o destino original é carregado no retorno do login/cadastro.
- Pedidos suportam estados pendente, confirmado e recusado. O cenário `?scenario=pending` preserva o carrinho até a retomada; `?scenario=declined` mantém os itens para tentar de novo; `?scenario=timeout` grava a compra e simula perda da resposta para testar recuperação pela mesma chave idempotente. O endpoint de retomada revalida preço e disponibilidade antes de confirmar.
- Padrões do TanStack Query: cache fresco por 15 segundos, coleta de lixo após cinco minutos, uma repetição e atualização ao recuperar o foco. As mutações bem-sucedidas invalidam consultas do carrinho.

## Contratos REST atuais

Consulte a tabela de contratos e as instruções de execução no `README.md`. Respostas usam HTTP 401 para sessão ausente/expirada, 404 para recursos desconhecidos, 409 para conflito de estoque/duplicidade, 410 para cupom expirado e 422 para validações inválidas. A criação de pedido exige uma chave de idempotência e dados de cotação; a consulta só retorna dados ao proprietário.

## Auditorias Lighthouse

O Lighthouse é dependência de desenvolvimento. `yarn audit:lighthouse` cria o build otimizado, inicia o Vite Preview com MSW e executa três auditorias para cada combinação de página e perfil: início e detalhe de NFT em mobile e desktop. A configuração versionada está em `lighthouse.config.mjs` (`1.0.0`).

Cada execução gera relatório HTML e JSON. `summary.md` e `summary.json` consolidam as medianas das categorias de desempenho, acessibilidade, boas práticas e SEO e também registram LCP, CLS e TBT. O resumo inclui versões do Node, Lighthouse e Chrome, ambiente e parâmetros de emulação/throttling. Arquivos gerados ficam em `lighthouse-reports/`.

As metas configuradas seguem o enunciado: desempenho ≥ 90, acessibilidade ≥ 95, boas práticas ≥ 95 e SEO ≥ 90. O resumo aponta as auditorias de performance com pontuação mais baixa para orientar a análise de resultados abaixo dessas metas. Consulte as medições geradas para explicar e corrigir causas específicas do ambiente avaliado.

## Limitações e decisões

O projeto é uma demonstração local: os endpoints e pagamentos usam MSW, sem implantação pública, blockchain ou gateway de pagamento real. Os fluxos novos possuem cenários de favoritos, perfil/carteira, cupons, checkout privado, pagamentos pendente/recusado e recuperação após timeout; ainda precisam ser comparados com a matriz completa de aceitação e com os frames de todas as telas. A integração MSW de Socket.IO transporta eventos no ambiente de simulação e não substitui um servidor Socket.IO de produção.

A identidade visual existente e as imagens locais de NFTs foram mantidas. Carrinho e checkout se adaptam a telas estreitas; a folha de estilos compartilhada oferece foco visível e tratamento de movimento reduzido. Não há arquivo Figma no repositório para uma comparação medida de todas as telas.

A configuração shadcn/ui e o componente Button no padrão shadcn, os testes Playwright e as referências visuais para desktop/tablet/mobile fazem parte do projeto. Não interprete o checkout simulado como uma transação real em blockchain.
