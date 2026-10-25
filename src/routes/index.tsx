import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Search, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { cartQueryKey, sessionToken, type PublicUser } from "../lib/session";
import type { NFT, NFTListResponse } from "../types/nft";
import { FavoriteButton } from "../components/FavoriteButton";

async function getNFTs(search: string, category: string, sort: string, page: number, network: string, maxPrice: number) {
  const { data } = await api.get<NFTListResponse>("/nfts", {
    params: { search, category, sort, page, network, maxPrice, pageSize: 9 },
  });
  return data;
}

const categories = [
  ["Art", "Arte digital", "33"],
  ["Photography", "Fotografia", "12"],
  ["Music", "Música", "65"],
  ["3D Art", "Arte 3D", "39"],
  ["Collectibles", "Colecionáveis", "23"],
  ["Generative", "Generativa", "17"],
  ["Gaming", "Jogos", "19"],
  ["Subscriptions", "Assinaturas", "13"],
  ["Utility", "Utilidade", "18"],
];

function Header({ onSearch }: { onSearch: () => void }) {
  const session = useQuery({ queryKey: ['session'], queryFn: async () => (await api.get<{ user: PublicUser }>('/auth/session')).data.user, enabled: Boolean(sessionToken()), retry: false });
  const cart = useQuery({ queryKey: cartQueryKey(), queryFn: async () => (await api.get<{ items: unknown[] }>('/cart')).data, staleTime: 15000 });
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">KURIO</Link>
        <nav aria-label="Navegação principal">
          <a className="current" href="#inicio">Início</a>
          <a href="#catalogo">Mercado</a>
          <a href="#diario">Criadores</a>
          <a href="#promocoes">Aprenda</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button" aria-label="Buscar NFTs" onClick={onSearch}><Search size={17} /></button>
          <Link className="cart-icon" to="/cart" aria-label={`Carrinho, ${cart.data?.items.length ?? 0} itens`}><ShoppingCart size={18} />{Boolean(cart.data?.items.length) && <span className="cart-count">{cart.data?.items.length}</span>}</Link>
          <Link className="wallet-button" to={session.data ? '/account' : '/login'}>{session.data ? 'Minha conta' : <><span className="login-icon">↗</span> Entrar</>}</Link>
        </div>
      </div>
    </header>
  );
}

function NFTCard({ nft }: { nft: NFT }) {
  return (
    <article className="nft-card">
      <Link
        to="/nft/$nftId"
        params={{ nftId: nft.id }}
        className="nft-image-link"
        aria-label={`Ver detalhes de ${nft.name}`}
      >
        <img src={nft.image} alt={nft.name} loading="lazy" />
      </Link>
      <FavoriteButton nftId={nft.id} label={nft.name} className="card-heart" />
      <div className="nft-card-content">
        <span className="card-collection">{nft.collection}</span>
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="card-name">
          {nft.name}
        </Link>
        <div className="nft-card-footer">
          <span>
            PREÇO ATUAL<strong>{nft.priceEth} ETH {nft.salePriceEth && <del>{nft.salePriceEth} ETH</del>}</strong>
          </span>
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="card-arrow"
            aria-label={`Explorar ${nft.name}`}
          >
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}

const journal = [
  {
    image: "/nft-art/ivory-baron.jpg",
    date: "12 DE SETEMBRO  ·  6 MIN",
    title: "Como funciona a propriedade de NFTs",
    text: "Aprenda a colecionar, negociar e verificar ativos digitais.",
  },
  {
    image: "/nft-art/emerald-ape.jpg",
    date: "13 DE SETEMBRO  ·  2 MIN",
    title: "10 artistas digitais para acompanhar",
    text: "Conheça criadores que moldam a cultura digital.",
  },
  {
    image: "/nft-art/sage-nomad.jpg",
    date: "15 DE SETEMBRO  ·  3 MIN",
    title: "Raridade, atributos e procedência",
    text: "Entenda raridade, procedência, direitos autorais e utilidade.",
  },
  {
    image: "/nft-art/golden-beat.jpg",
    date: "15 DE SETEMBRO  ·  2 MIN",
    title: "Como proteger sua carteira",
    text: "Proteja sua carteira, seus ativos e sua identidade.",
  },
];

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-benefits">
        <article>
          <span className="benefit-icon">W</span>
          <h3>Segurança da carteira</h3>
          <p>
            Proteja sua carteira e colecione arte digital verificada com
            confiança.
          </p>
        </article>
        <article>
          <span className="benefit-icon">C</span>
          <h3>Criadores em destaque</h3>
          <p>
            Conheça artistas, estúdios e comunidades que moldam a cultura
            digital na rede.
          </p>
        </article>
        <article>
          <span className="benefit-icon">D</span>
          <h3>Alertas de lançamentos</h3>
          <p>
            Receba calendários de cunhagem, novidades de listas de acesso e
            análises do mercado.
          </p>
        </article>
        <article className="newsletter" id="newsletter">
          <h3>Antecipe-se ao próximo lançamento</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.alert("Inscrição registrada!");
            }}
          >
            <input
              type="email"
              required
              placeholder="digite seu e-mail..."
              aria-label="Seu e-mail"
            />
            <button type="submit">Enviar</button>
          </form>
          <p>
            Receba lançamentos selecionados, histórias de criadores e novidades
            do mercado.
          </p>
        </article>
      </div>
      <div className="footer-strip">
        <strong>KURIO</strong>
        <span>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </span>
        <a href="mailto:contato@email.com">contato@email.com</a>
        <span>+55 11 4002 8922</span>
      </div>
      <div className="footer-links">
        <div>
          <h3>Meu perfil</h3>
          <a href="#catalogo">Meu perfil</a>
          <a href="#catalogo">Minha coleção</a>
          <a href="#catalogo">Lista de interesse</a>
          <a href="#catalogo">Denunciar item</a>
        </div>
        <div>
          <h3>Central de ajuda</h3>
          <a href="#newsletter">Central de ajuda</a>
          <a href="#catalogo">Como comprar NFTs</a>
          <a href="#newsletter">Carteira e segurança</a>
          <a href="#newsletter">Política do mercado</a>
        </div>
        <div>
          <h3>Coleções</h3>
          <a href="#catalogo">Arte digital</a>
          <a href="#catalogo">Fotografia</a>
          <a href="#catalogo">Música</a>
          <a href="#catalogo">Arte 3D</a>
          <a href="#catalogo">Utilidade</a>
        </div>
        <div>
          <h3>Redes sociais</h3>
          <div className="socials">
            <a href="#diario" aria-label="Facebook">
              f
            </a>
            <a href="#diario" aria-label="Instagram">
              ◎
            </a>
            <a href="#diario" aria-label="Twitter">
              ♥
            </a>
            <a href="#diario" aria-label="LinkedIn">
              in
            </a>
            <a href="#diario" aria-label="YouTube">▶</a>
          </div>
          <h3 className="wallets-heading">Carteiras compatíveis</h3>
          <span className="wallet-tags">
            METAMASK · WALLETCONNECT · COINBASE
          </span>
        </div>
      </div>
      <div className="copyright">
        © 2026 Kurio. Propriedade digital para todos.
      </div>
    </footer>
  );
}

export function HomePage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const routeSearch = useSearch({ from: '/' });
  const search = routeSearch.q ?? '';
  const category = routeSearch.category ?? 'all';
  const sort = routeSearch.sort ?? 'newest';
  const page = routeSearch.page ?? 1;
  const network = routeSearch.network ?? 'all';
  const maxPrice = routeSearch.maxPrice ?? 12.3;
  const [priceDraft, setPriceDraft] = useState({ routeValue: maxPrice, value: maxPrice });
  if (priceDraft.routeValue !== maxPrice) {
    setPriceDraft({ routeValue: maxPrice, value: maxPrice });
  }
  const maxPriceDraft = priceDraft.value;
  const navigate = useNavigate({ from: '/' });
  const updateSearch = (patch: Partial<{ q: string; category: string; sort: string; page: number; network: string; maxPrice: number }>, replace = false) => navigate({ search: (previous) => ({ ...previous, ...patch }), replace });
  const query = useQuery({
    queryKey: ["nfts", { search, category, sort, page, network, maxPrice }],
    queryFn: () => getNFTs(search, category, sort, page, network, maxPrice),
  });
  return (
    <>
      <Header onSearch={() => { setSearchOpen(true); window.setTimeout(() => document.querySelector<HTMLInputElement>("#search-nfts")?.focus(), 0) }} />
      <main className="home-main">
        <section className="hero" id="inicio">
          <div className="hero-content">
            <p className="eyebrow">BEM-VINDO À KURIO</p>
            <h1>SEJA DONO DO FUTURO<br />DA ARTE DIGITAL</h1>
            <p className="hero-description">
              Descubra NFTs selecionados de criadores emergentes e consagrados.
              Colecione arte digital rara, apoie artistas e tenha uma parte da
              cultura da internet.
            </p>
            <a className="button" href="#catalogo">
              EXPLORAR
            </a>
            <div className="hero-dots">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="hero-art">
            <img
              src="/nft-art/emerald-ape.jpg"
              alt="Macaco colecionável digital Emerald Ape"
              fetchPriority="high"
              loading="eager"
            />
          </div>
        </section>
        <section className="catalog-section" id="catalogo">
          <h2 className="sr-only">Catálogo de NFTs</h2>
          <div className="catalog-layout">
            <div className="sidebar-column">
              <aside className="filter-sidebar">
              <div className="filter-block">
                <h3>Coleções</h3>
                {categories.map(([value, label, count]) => (
                  <button
                    key={value}
                    className={`category-choice ${category === value ? "selected" : ""}`}
                    onClick={() => updateSearch({ category: category === value ? "all" : value, page: 1 })}
                  >
                    <span>{label}</span>
                    <span>({count})</span>
                  </button>
                ))}
              </div>
              <div className="filter-block price-filter">
                <h3>Faixa de preço</h3>
                <input
                  aria-label="Faixa de preço"
                  type="range"
                  min="0.02"
                  max="12.3"
                  value={maxPriceDraft}
                  onChange={(event) => setPriceDraft({ routeValue: maxPrice, value: Number(event.target.value) })}
                />
                <p>Preço: 0,02 – {maxPriceDraft.toFixed(2)} ETH</p>
                <button className="button button-small" onClick={() => updateSearch({ maxPrice: maxPriceDraft, page: 1 })}>Aplicar</button>
              </div>
              <div className="filter-block">
                <h3>Rede</h3>
                {[
                  ["Ethereum", "119"],
                  ["Polygon", "78"],
                  ["Solana", "86"],
                ].map(([name, count]) => (
                  <button key={name} className={`category-choice ${network === name ? 'selected' : ''}`} onClick={() => updateSearch({ network: network === name ? 'all' : name, page: 1 })}>
                    <span>{name}</span>
                    <span>({count})</span>
                  </button>
                ))}
              </div>
              </aside>
              <article className="featured-promo">
                <span>NFT EM DESTAQUE</span>
                <h3>OFERTA LIMITADA</h3>
                <img
                  src="/nft-art/sage-nomad.jpg"
                  alt="Sage Nomad em destaque"
                />
                <strong>Sage Nomad #009</strong>
                <b>1.69 ETH</b>
              </article>
            </div>
            <div className="catalog-results">
              <div className="catalog-toolbar">
                <div className="catalog-tabs">
                  <button className="active">Todos os NFTs</button>
                  <button onClick={() => updateSearch({ sort: "newest", page: 1 })}>
                    Novos lançamentos
                  </button>
                  <button onClick={() => updateSearch({ sort: "price-desc", page: 1 })}>Em alta</button>
                </div>
                <label className="sort-select">
                  Ordenar por:{" "}
                  <select
                    value={sort}
                    onChange={(e) => updateSearch({ sort: e.target.value, page: 1 })}
                  >
                    <option value="newest">Listados recentemente</option>
                    <option value="price-asc">Menor preço</option>
                    <option value="price-desc">Maior preço</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
              {searchOpen && <label className="search-control">
                <Search size={16} />
                <input
                  id="search-nfts"
                  value={search}
                  onChange={(e) => updateSearch({ q: e.target.value, page: 1 }, true)}
                  placeholder="Buscar por nome, coleção ou artista..."
                />
              </label>}
              {query.isPending ? (
                <div className="nft-grid">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div className="skeleton-card" key={i}>
                      <div className="skeleton-image shimmer" />
                      <div className="skeleton-line shimmer" />
                    </div>
                  ))}
                </div>
              ) : query.isError ? (
                <div className="feedback-panel">
                  <p>Não foi possível carregar o catálogo.</p>
                  <button className="button" onClick={() => query.refetch()}>
                    Tentar novamente
                  </button>
                </div>
              ) : query.data.items.length === 0 ? (
                <div className="feedback-panel">
                  <h3>Nenhum NFT encontrado</h3>
                  <p>Tente mudar a busca ou categoria.</p>
                </div>
              ) : (
                <div className="nft-grid" aria-live="polite">
                  {query.data.items.map((nft) => (
                    <NFTCard key={nft.id} nft={nft} />
                  ))}
                </div>
              )}
              {query.data && <nav className="pagination" aria-label="Paginação do catálogo">{Array.from({ length: Math.ceil(query.data.total / query.data.pageSize) }, (_, index) => index + 1).slice(0, 4).map((pageNumber) => <button key={pageNumber} className={page === pageNumber ? 'current' : ''} aria-current={page === pageNumber ? 'page' : undefined} onClick={() => updateSearch({ page: pageNumber })}>{pageNumber}</button>)}<button disabled={page >= Math.ceil(query.data.total / query.data.pageSize)} aria-label="Próxima página" onClick={() => updateSearch({ page: page + 1 })}>›</button></nav>}
            </div>
          </div>
        </section>
        <section className="promo-section" id="promocoes">
          <div className="promo-card">
            <img src="/nft-art/emerald-ape.jpg" alt="Emerald Ape" />
            <div>
              <h3>
                Lançamentos gênesis
                <br />
                de edição limitada
              </h3>
              <p>
                Colecione edições escassas diretamente dos criadores antes da
                revelação pública.
              </p>
              <a className="button" href="#catalogo">
                Explorar <ArrowRight size={16} />
              </a>
            </div>
          </div>
          <div className="promo-card">
            <img src="/nft-art/ivory-baron.jpg" alt="Ivory Baron" />
            <div>
              <h3>
                Arte digital selecionada
                <br />e muito mais
              </h3>
              <p>
                Explore novos artistas, coleções verificadas e obras digitais
                que definem a cultura.
              </p>
              <a className="button" href="#catalogo">
                Explorar <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>
        <section className="journal-section" id="diario">
          <div className="journal-heading">
            <h2>Diário da Cunhagem</h2>
            <p>
              Histórias, guias e insights para colecionadores sobre o universo
              da propriedade digital.
            </p>
          </div>
          <div className="journal-grid">
            {journal.map((item) => (
              <article className="journal-card" key={item.title}>
                <img src={item.image} alt="" />
                <div className="journal-copy">
                  <span>{item.date}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <a href="#diario">Ler mais →</a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
