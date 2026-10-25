# Kurio · Marketplace de NFTs

Protótipo de marketplace com React 19, TypeScript e Vite. As chamadas HTTP usam Axios e o contrato REST em `/api`. A variável `VITE_ENABLE_MOCKS=true` ativa o service worker do MSW, inclusive no build de demonstração; não é necessário um backend de produção.

## Executar o projeto

```sh
yarn install
yarn dev
yarn build
yarn preview
yarn typecheck
yarn lint
yarn test:e2e
```

Os testes E2E do Playwright usam Chromium nos viewports de 390, 768 e 1440 px. `yarn test:e2e` gera o build com mocks e executa a suíte; `yarn test:e2e:update-snapshots` atualiza as referências de regressão visual. Os relatórios HTML ficam em `playwright-report/`; traces e mídias de falhas ficam em `test-results/`.

Não há contas reais nem transações em blockchain. O checkout é uma demonstração simulada.

## Auditorias Lighthouse

O Lighthouse é uma dependência de desenvolvimento. Execute:

```sh
yarn audit:lighthouse
```

O comando gera o build otimizado e inicia o Vite Preview com MSW. Audita a página inicial e o detalhe de `cosmic-001`, em perfis mobile e desktop, com três execuções para cada combinação. Cada execução salva relatórios HTML e JSON; o resumo registra medianas de desempenho, acessibilidade, boas práticas e SEO, além de LCP, CLS e TBT. As metas são desempenho ≥ 90, acessibilidade ≥ 95, boas práticas ≥ 95 e SEO ≥ 90.

Os arquivos ficam em `lighthouse-reports/<data-e-hora-UTC>/`: `summary.md`, `summary.json` e os relatórios individuais. O resumo registra versões do Lighthouse, Chrome e Node, ambiente, configuração e condições de execução. Os parâmetros estão em `lighthouse.config.mjs` (versão da configuração `1.0.0`).

Para selecionar outro Chrome ou porta/origem do preview, defina antes de executar:

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:LIGHTHOUSE_PORT = '4173'
$env:LIGHTHOUSE_BASE_URL = 'http://127.0.0.1:4173'
yarn audit:lighthouse
```

O Lighthouse precisa do Node.js 22.19 ou mais recente e de uma instalação do Chrome. Os perfis usam emulação de tela e limitação de rede/CPU descritas em `lighthouse.config.mjs`. Cada execução abre um perfil de navegador novo, usa o build de produção com MSW e grava os resultados para permitir comparação posterior.

## Rotas

- `/`: catálogo, busca por texto, filtros e ordenação.
- `/nft/:nftId`: detalhes do NFT e ação para adicioná-lo ao carrinho.
- `/cart`: ajuste de quantidade, remoção e totais em ETH.
- `/checkout`: rota privada; exige sessão, carteira cadastrada e conexão simulada antes do envio.
- `/receipt/:orderId`: confirmação consultada na API simulada e limitada ao proprietário do pedido.
- `/register`, `/login` e `/account`: cadastro, login, restauração de sessão, edição de perfil/avatar, senha, carteiras, favoritos e logout.

Credenciais de demonstração: `demo@kurio.test` / `kurio123` e `alex@kurio.test` / `kurio123`. Cada conta de demonstração recebe uma carteira simulada na primeira consulta, permitindo concluir uma compra sem cadastro manual de carteira. Contas novas continuam podendo cadastrar a própria carteira pelo perfil. O cadastro aplica SHA-256 à senha antes de persistir o usuário simulado. Tokens de sessão e usuários simulados ficam no armazenamento local do navegador; senhas não são persistidas em texto puro. Após uma atualização, o perfil público da sessão é recuperado pela API REST.

O carrinho de visitante e os carrinhos das contas são armazenados separadamente no cenário MSW. Ao entrar ou se cadastrar, o carrinho de visitante é migrado para a conta autenticada no primeiro acesso ao carrinho. O logout limpa o cache privado do TanStack Query. A chave `kurio-order-attempt` é reutilizada ao tentar novamente um pedido após timeout; uma repetição da mesma tentativa retorna o mesmo pedido simulado.

## Contratos REST simulados pelo MSW

| Método | Caminho | Comportamento |
|---|---|---|
| GET | `/api/nfts?search&category&sort&page&pageSize` | Catálogo filtrado e paginado |
| GET | `/api/nfts/:id` | Detalhe do NFT ou resposta 404 |
| POST | `/api/auth/register` | Cria um colecionador simulado e protege a senha antes de persistir |
| POST | `/api/auth/login` | Valida credenciais e retorna token de sessão |
| GET | `/api/auth/session` | Recupera o perfil público da sessão |
| POST | `/api/auth/logout` | Revoga o token da sessão simulada |
| PATCH | `/api/profile` | Atualiza nome, e-mail e URL do avatar; valida duplicidade e formato |
| PATCH | `/api/profile/password` | Valida a senha atual e salva somente o digest SHA-256 da nova senha |
| GET/POST | `/api/wallets` | Lista e cadastra carteiras autenticadas; o primeiro cadastro vira principal |
| PATCH/DELETE | `/api/wallets/:id` | Renomeia, define como principal ou remove uma carteira própria |
| GET | `/api/favorites` | Lista IDs favoritos do colecionador autenticado |
| POST/DELETE | `/api/favorites/:id` | Adiciona ou remove um NFT dos favoritos; a interface atualiza de forma otimista e reverte em falha |
| GET | `/api/cart` | Consulta o carrinho do visitante ou da conta autenticada |
| POST | `/api/cart/items` | Adiciona NFT e quantidade; verifica disponibilidade |
| PATCH | `/api/cart/items/:id` | Altera quantidade; retorna 409 se não houver estoque |
| DELETE | `/api/cart/items/:id` | Remove item do carrinho atual |
| POST | `/api/coupons/validate` | Valida cupom; `KURIO10` aplica 10%, `EXPIRED10` simula expiração e códigos desconhecidos retornam erro |
| POST | `/api/cart/coupon` | Aplica/remove cupom persistido no carrinho e retorna desconto, taxa e total recalculados |
| POST | `/api/orders` | Exige sessão, carteira registrada, cotação atual e `Idempotency-Key`; salva snapshot e só baixa estoque/limpa carrinho após confirmação |
| GET | `/api/orders/:id` | Retorna o pedido salvo somente ao proprietário, inclusive pendentes e recusados |
| POST | `/api/orders/:id/resolve` | Retoma o pagamento pendente como confirmado ou recusado; confirmação revalida preço e estoque |

Os pedidos simulados salvam uma cópia dos itens, quantidades, preços e totais no momento da compra. O recibo só exibe confirmação quando a consulta retorna um pedido do proprietário com estado `confirmed`.

O cadastro, login, sessão, perfil, carteiras, favoritos, cupons e pagamento são simulados pela API MSW. Use `?scenario=pending` para criar um pedido pendente e retomá-lo no recibo, `?scenario=declined` para simular recusa e preservar o carrinho, `?scenario=timeout` para simular timeout após criar a compra e recuperar o mesmo pedido ao reenviar, `?scenario=slow` para respostas lentas ou `?scenario=variable-latency` para latência variável. `?scenario=favorite-failure` simula uma falha temporária ao salvar um favorito e permite observar o rollback otimista. O Socket.IO anuncia alterações de preço/disponibilidade e estados dos pedidos.

TanStack Query usa cache de 15 segundos, coleta de lixo após cinco minutos, uma tentativa de repetição e atualização ao voltar o foco à janela. Mutações invalidam as consultas do carrinho. Consulte [ARCHITECTURE.md](./ARCHITECTURE.md) para limites e decisões de arquitetura.

## Interface e tempo real

Tailwind CSS v4 está habilitado pelo plugin do Vite. A configuração local de shadcn/ui está em `components.json`; `src/components/ui/button.tsx` é um componente Button no padrão shadcn, baseado em class-variance-authority e nos tokens visuais do projeto.

O cliente Socket.IO usa `socket.io-client` e o transporte simulado usa a interceptação WebSocket do MSW com `@mswjs/socket.io-binding`. O evento `nft.updated` carrega ID estável, recurso, versão, preço e disponibilidade; `order.updated` carrega ID estável do pedido, recurso, versão e estado. Use `?scenario=price-change` para disparar uma alteração reproduzível de NFT. Esse transporte é uma simulação e não um servidor Socket.IO de produção.

## Limitações conhecidas

O projeto continua sendo uma demonstração local com MSW, sem backend implantado, gateway real ou blockchain. O recibo usa o snapshot simulado e os links de exploração são referências fictícias. Os cenários cobrem os fluxos implementados; isso não substitui a execução e revisão da matriz completa de aceitação do desafio. Consulte `ARCHITECTURE.md` e os relatórios Lighthouse/Playwright antes de avaliar a entrega.
