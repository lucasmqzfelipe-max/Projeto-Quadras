import { useMemo, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock3,
  DoorClosed,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect } from "react";

const sportOptions = ["Todos", "Futebol", "Basquete", "Vôlei", "Tênis"];
const statusOptions = [
  { value: "all", label: "Todas", icon: Activity },
  { value: "open", label: "Abertas", icon: CircleCheck },
  { value: "playing", label: "Jogando agora", icon: Users },
  { value: "closed", label: "Fechadas", icon: CircleX },
] as const;

type CourtStatus = "open" | "closed" | "playing";
type StatusFilter = (typeof statusOptions)[number]["value"];

type CourtForm = {
  name: string;
  city: string;
  region: string;
  address: string;
  sportType: string;
  description: string;
  status: CourtStatus;
};

const initialCourtForm: CourtForm = {
  name: "",
  city: "",
  region: "",
  address: "",
  sportType: "Futebol",
  description: "",
  status: "open",
};

const statusCopy: Record<CourtStatus, { label: string; helper: string; className: string; icon: typeof CircleCheck }> = {
  open: { label: "Aberta", helper: "Disponível para jogar", className: "status-open", icon: CircleCheck },
  playing: { label: "Jogando agora", helper: "Tem gente na quadra", className: "status-playing", icon: Users },
  closed: { label: "Fechada", helper: "Indisponível no momento", className: "status-closed", icon: CircleX },
};

function formatLastUpdate(date: Date | string | null) {
  if (!date) return "Sem atualização";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Sem atualização";
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(" de ", " ");
}

function getInitials(name?: string | null) {
  if (!name) return "QJ";
  return name.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function StatusBadge({ status }: { status: CourtStatus }) {
  const config = statusCopy[status];
  const Icon = config.icon;
  return (
    <Badge className={`status-badge ${config.className}`}>
      <Icon className="size-3.5" />
      {config.label}
    </Badge>
  );
}

function CourtCard({
  court,
  onUpdate,
}: {
  court: {
    id: number;
    name: string;
    city: string;
    region: string;
    address: string;
    sportType: string;
    description: string | null;
    status: CourtStatus;
    lastStatusUpdate: Date;
  };
  onUpdate: () => void;
}) {
  const config = statusCopy[court.status];
  return (
    <article className="court-card group">
      <div className="court-card-topline">
        <span className="court-type">{court.sportType}</span>
        <StatusBadge status={court.status} />
      </div>
      <div className="court-card-heading">
        <div className="court-avatar"><Building2 className="size-5" /></div>
        <div className="min-w-0">
          <h3>{court.name}</h3>
          <p><MapPin className="size-3.5" /> {court.city}, {court.region}</p>
        </div>
        <ArrowUpRight className="court-arrow size-4" />
      </div>
      <div className="court-card-address">
        <Navigation className="size-4 shrink-0" />
        <span>{court.address}</span>
      </div>
      <div className="court-card-footer">
        <span className="last-update"><Clock3 className="size-3.5" /> Atualizado {formatLastUpdate(court.lastStatusUpdate)}</span>
        <Button variant="ghost" size="sm" className="update-button" onClick={onUpdate}>
          <RefreshCw className="size-3.5" />
          Atualizar
        </Button>
      </div>
      {court.description && <p className="court-description">{court.description}</p>}
      <div className={`court-state-line ${config.className}`}><span /> {config.helper}</div>
    </article>
  );
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [locationQuery, setLocationQuery] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [selectedSport, setSelectedSport] = useState("Todos");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<{ id: number; name: string; status: CourtStatus } | null>(null);
  const [newCourt, setNewCourt] = useState<CourtForm>(initialCourtForm);
  const [statusNote, setStatusNote] = useState("");
  const [newStatus, setNewStatus] = useState<CourtStatus>("open");
  const [mapError, setMapError] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const queryInput = useMemo(() => ({
    city: appliedLocation || undefined,
    region: appliedLocation || undefined,
    status: selectedStatus === "all" ? undefined : selectedStatus,
    sportType: selectedSport === "Todos" ? undefined : selectedSport,
  }), [appliedLocation, selectedSport, selectedStatus]);
  const courtsQuery = trpc.courts.list.useQuery(queryInput, { staleTime: 20_000 });
  const utils = trpc.useUtils();
  const createCourt = trpc.courts.create.useMutation({
    onSuccess: async () => {
      await utils.courts.list.invalidate();
      setIsCreateOpen(false);
      setNewCourt(initialCourtForm);
      toast.success("Quadra cadastrada", { description: "A comunidade já pode encontrá-la na busca." });
    },
    onError: error => toast.error(error.message),
  });
  const updateCourtStatus = trpc.courts.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.courts.list.invalidate();
      setIsStatusOpen(false);
      setSelectedCourt(null);
      setStatusNote("");
      toast.success("Status atualizado", { description: "Obrigado por manter a quadra em dia." });
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (selectedCourt) setNewStatus(selectedCourt.status);
  }, [selectedCourt]);

  const courts = courtsQuery.data ?? [];
  const mapMarkers = useMemo(() => courts.flatMap(court => {
    const latitude = Number(court.latitude);
    const longitude = Number(court.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ id: court.id, name: court.name, position: { lat: latitude, lng: latitude }, status: court.status }];
  }), [courts]);
  const visibleCount = courts.length - 1;

  const handleSearch = () => {
    setAppliedLocation(locationQuery.trim());
  };

  const requireAuth = (action: () => void) => {
    if (!isAuthenticated) {
      toast("Entre para colaborar", { description: "O login libera o cadastro e as atualizações de status." });
      startLogin();
      return;
    }
    action();
  };

  const handleCreateCourt = () => {
    requireAuth(() => setIsCreateOpen(true));
  };

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGeocoding(true);
    const coordinates = await new Promise<{ latitude: number; longitude: number } | null>(resolve => {
      if (!window.google?.maps) {
        resolve(null);
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: `${newCourt.address}, ${newCourt.city}, ${newCourt.region}, Brasil` }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const location = results[0].geometry.location;
          resolve({ latitude: location.lat(), longitude: location.lng() });
        } else {
          resolve(null);
        }
      });
    });
    setIsGeocoding(false);
    if (!coordinates) {
      toast.error("Não foi possível localizar esse endereço", { description: "Verifique o endereço e tente novamente quando o mapa estiver disponível." });
      return;
    }
    createCourt.mutate({
      ...newCourt,
      description: newCourt.description || undefined,
      ...coordinates,
    });
  };

  const handleStatusSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourt) return;
    updateCourtStatus.mutate({ courtId: selectedCourt.id, status: newStatus, note: statusNote || undefined });
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Quadras em Jogo, início">
          <span className="brand-mark"><CircleDot className="size-5" /></span>
          <span>quadras<span>em jogo</span></span>
        </a>
        <nav className={`desktop-nav ${isMenuOpen ? "mobile-open" : ""}`}>
          <a className="nav-link active" href="#explorar">Explorar</a>
          <a className="nav-link" href="#comunidade">Comunidade</a>
          <a className="nav-link" href="#como-funciona">Como funciona</a>
        </nav>
        <div className="header-actions">
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-avatar">{getInitials(user?.name)}</span>
              <span className="user-name">{user?.name?.split(" ")[0] ?? "Jogador"}</span>
              <Button variant="ghost" size="icon" className="logout-button" onClick={() => logout()} aria-label="Sair"><LogOut className="size-4" /></Button>
            </div>
          ) : (
            <Button variant="ghost" className="login-button" disabled={authLoading} onClick={() => startLogin()}>
              <LogIn className="size-4" /> Entrar
            </Button>
          )}
          <Button className="header-cta" onClick={handleCreateCourt}><Plus className="size-4" /> Adicionar quadra</Button>
          <Button variant="ghost" size="icon" className="mobile-menu-button" onClick={() => setIsMenuOpen(prev => !prev)} aria-label="Abrir menu">
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles className="size-4" /> Feito por quem vive o jogo</div>
            <h1>Jogue mais.<br /><em>Espere menos.</em></h1>
            <p className="hero-intro">Encontre quadras, descubra quem está jogando e ajude a manter a sua cidade em movimento.</p>
            <div className="hero-search-card">
              <div className="search-input-wrap">
                <Search className="size-5" />
                <Input value={locationQuery} onChange={event => setLocationQuery(event.target.value)} onKeyDown={event => event.key === "Enter" && handleSearch()} placeholder="Digite sua cidade ou região" aria-label="Cidade ou região" />
                {locationQuery && <button className="clear-search" onClick={() => { setLocationQuery(""); setAppliedLocation(""); }} aria-label="Limpar busca"><X className="size-4" /></button>}
              </div>
              <Button className="search-button" onClick={handleSearch}><span>Buscar quadras</span><ArrowUpRight className="size-4" /></Button>
            </div>
            <div className="hero-meta"><span><ShieldCheck className="size-4" /> Dados colaborativos</span><span><Clock3 className="size-4" /> Atualização em tempo real</span></div>
          </div>
          <div className="hero-art" aria-label="Mapa de quadras por localização">
            <div className="art-label art-label-top"><span className="pulse-dot" /> 12 pessoas jogando agora</div>
            <div className="map-orb orb-one" /><div className="map-orb orb-two" /><div className="map-orb orb-three" />
            <div className="map-grid" />
            <div className="hero-map-card">
              <MapView key={`map-${appliedLocation}-${selectedStatus}-${selectedSport}-${mapMarkers.map(marker => marker.id).join("-")}`} initialCenter={mapMarkers[0]?.position ?? { lat: -23.5505, lng: -46.6333 }} initialZoom={12} markers={mapMarkers} onMapReady={() => setMapError(false)} onMapError={() => setMapError(true)} className="hero-map" />
              <div className="map-fallback-label">{mapError ? <><CircleX className="size-4" /> Mapa indisponível agora</> : <><MapPin className="size-4" /> {mapMarkers.length ? `${mapMarkers.length} quadra${mapMarkers.length === 1 ? "" : "s"} no mapa` : "Explore por perto"}</>}</div>
            </div>
            <div className="art-label art-label-bottom"><span className="map-stat-icon"><Navigation className="size-4" /></span><span><strong>+24</strong><small>quadras mapeadas</small></span></div>
          </div>
        </section>

        <section className="explore-section" id="explorar">
          <div className="section-heading">
            <div><div className="section-kicker">Mapa colaborativo</div><h2>Quadras perto de você</h2><p>Informação da comunidade para você chegar e jogar.</p></div>
            <div className="heading-count"><span className="live-indicator" /> {visibleCount} {visibleCount === 1 ? "quadra encontrada" : "quadras encontradas"}</div>
          </div>
          <div className="explore-layout">
            <aside className="filters-panel">
              <div className="filter-heading"><div><SlidersHorizontal className="size-4" /> Filtros</div><button onClick={() => { setSelectedStatus("all"); setSelectedSport("Todos"); setLocationQuery(""); setAppliedLocation(""); }}>Limpar</button></div>
              <label className="filter-label">Localização</label>
              <div className="filter-location"><MapPin className="size-4" /><span>{appliedLocation || "Todas as regiões"}</span><ChevronDown className="size-4 ml-auto" /></div>
              <label className="filter-label">Modalidade</label>
              <div className="filter-options sport-options">{sportOptions.map(sport => <button key={sport} className={selectedSport === sport ? "selected" : ""} onClick={() => setSelectedSport(sport)}>{sport}{selectedSport === sport && <Check className="size-3.5" />}</button>)}</div>
              <label className="filter-label">Disponibilidade</label>
              <div className="filter-options status-options">{statusOptions.map(option => { const Icon = option.icon; return <button key={option.value} className={selectedStatus === option.value ? "selected" : ""} onClick={() => setSelectedStatus(option.value)}><Icon className="size-4" />{option.label}{selectedStatus === option.value && <Check className="size-3.5 ml-auto" />}</button>; })}</div>
              <div className="filter-tip"><div className="tip-icon"><Sparkles className="size-4" /></div><div><strong>Ajude a comunidade</strong><p>Viu algo diferente? Atualize o status da quadra.</p></div></div>
            </aside>
            <div className="results-column">
              <div className="results-toolbar"><div className="toolbar-search"><Search className="size-4" /><Input value={locationQuery} onChange={event => setLocationQuery(event.target.value)} onKeyDown={event => event.key === "Enter" && handleSearch()} placeholder="Buscar por nome ou bairro" /></div><button className="sort-button">Mais recentes <ChevronDown className="size-4" /></button></div>
              {courtsQuery.isLoading ? (
                <div className="loading-grid">{[1, 2, 3].map(item => <div className="skeleton-card" key={item}><div /><span /><span /><span /></div>)}</div>
              ) : courtsQuery.isError ? (
                <div className="empty-state"><CircleX className="size-8" /><h3>Não foi possível carregar as quadras</h3><p>Confira sua conexão e tente novamente.</p><Button variant="outline" onClick={() => courtsQuery.refetch()}>Tentar novamente</Button></div>
              ) : courts.length > 0 ? (
                <div className="courts-grid">{courts.map(court => <CourtCard key={court.id} court={court} onUpdate={() => requireAuth(() => { setSelectedCourt({ id: court.id, name: court.name, status: court.status }); setIsStatusOpen(true); })} />)}</div>
              ) : (
                <div className="empty-state"><div className="empty-icon"><MapPin className="size-7" /></div><h3>O mapa ainda está esperando por você</h3><p>Nenhuma quadra apareceu com estes filtros. Cadastre a primeira da sua região e ajude outros jogadores.</p><Button className="empty-cta" onClick={handleCreateCourt}><Plus className="size-4" /> Cadastrar primeira quadra</Button></div>
              )}
            </div>
          </div>
        </section>

        <section className="community-strip" id="comunidade">
          <div className="community-visual"><div className="community-orbit orbit-a" /><div className="community-orbit orbit-b" /><span className="community-symbol"><Users className="size-6" /></span></div>
          <div><div className="section-kicker">Uma rede em movimento</div><h2>Informação boa é informação compartilhada.</h2><p>Cada atualização ajuda alguém a atravessar a cidade para jogar melhor.</p></div>
          <div className="community-action"><span><CircleCheck className="size-4" /> Colabore com um clique</span><Button variant="outline" onClick={handleCreateCourt}>Começar agora <ArrowUpRight className="size-4" /></Button></div>
        </section>

        <section className="how-section" id="como-funciona"><div className="section-kicker">Como funciona</div><h2>Da busca ao jogo em três passos.</h2><div className="steps-grid"><div className="step"><span>01</span><h3>Encontre</h3><p>Pesquise por cidade, bairro ou modalidade e escolha um lugar perto de você.</p></div><div className="step"><span>02</span><h3>Confira</h3><p>Veja se a quadra está aberta, fechada ou com gente jogando neste momento.</p></div><div className="step"><span>03</span><h3>Colabore</h3><p>Entre com sua conta, cadastre novas quadras e mantenha os status sempre atuais.</p></div></div></section>
      </main>

      <footer className="site-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><CircleDot className="size-4" /></span><span>quadras<span>em jogo</span></span></a><span>Feito para quem não deixa o jogo parar.</span><span>© 2026 Quadras em Jogo</span></footer>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}><DialogContent className="collab-dialog"><DialogHeader><DialogTitle>Adicionar uma quadra</DialogTitle><DialogDescription>Compartilhe um espaço com a comunidade. Você poderá atualizar o status depois.</DialogDescription></DialogHeader><form onSubmit={handleCreateSubmit} className="dialog-form"><div className="form-row"><label>Nome da quadra<Input required value={newCourt.name} onChange={event => setNewCourt(prev => ({ ...prev, name: event.target.value }))} placeholder="Ex.: Quadra do Parque" /></label><label>Modalidade<select value={newCourt.sportType} onChange={event => setNewCourt(prev => ({ ...prev, sportType: event.target.value }))}><option>Futebol</option><option>Basquete</option><option>Vôlei</option><option>Tênis</option><option>Poliesportiva</option></select></label></div><div className="form-row"><label>Cidade<Input required value={newCourt.city} onChange={event => setNewCourt(prev => ({ ...prev, city: event.target.value }))} placeholder="Ex.: São Paulo" /></label><label>Região / estado<Input required value={newCourt.region} onChange={event => setNewCourt(prev => ({ ...prev, region: event.target.value }))} placeholder="Ex.: SP" /></label></div><label>Endereço completo<Input required value={newCourt.address} onChange={event => setNewCourt(prev => ({ ...prev, address: event.target.value }))} placeholder="Rua, número e bairro" /></label><label>Descrição <span className="optional">opcional</span><textarea value={newCourt.description} onChange={event => setNewCourt(prev => ({ ...prev, description: event.target.value }))} placeholder="Algum detalhe que ajude quem vai jogar?" maxLength={1000} /></label><div><span className="form-label">Status atual</span><div className="status-choice-grid">{(["open", "playing", "closed"] as CourtStatus[]).map(status => { const Icon = statusCopy[status].icon; return <button type="button" key={status} className={newCourt.status === status ? `selected ${statusCopy[status].className}` : ""} onClick={() => setNewCourt(prev => ({ ...prev, status }))}><Icon className="size-4" /> {statusCopy[status].label}</button>; })}</div></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button><Button type="submit" className="dialog-submit" disabled={createCourt.isPending || isGeocoding}>{createCourt.isPending || isGeocoding ? <><RefreshCw className="size-4 animate-spin" /> {isGeocoding ? "Localizando..." : "Salvando..."}</> : <><Plus className="size-4" /> Salvar quadra</>}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}><DialogContent className="collab-dialog status-dialog"><DialogHeader><DialogTitle>Atualizar disponibilidade</DialogTitle><DialogDescription>Como está a <strong>{selectedCourt?.name}</strong> agora?</DialogDescription></DialogHeader><form onSubmit={handleStatusSubmit} className="dialog-form"><div className="status-choice-grid status-choice-large">{(["open", "playing", "closed"] as CourtStatus[]).map(status => { const Icon = statusCopy[status].icon; return <button type="button" key={status} className={newStatus === status ? `selected ${statusCopy[status].className}` : ""} onClick={() => setNewStatus(status)}><Icon className="size-5" /><span><strong>{statusCopy[status].label}</strong><small>{statusCopy[status].helper}</small></span></button>; })}</div><label>Observação <span className="optional">opcional</span><textarea value={statusNote} onChange={event => setStatusNote(event.target.value)} placeholder="Ex.: manutenção até as 18h" maxLength={500} /></label><DialogFooter><Button type="button" variant="ghost" onClick={() => setIsStatusOpen(false)}>Cancelar</Button><Button type="submit" className="dialog-submit" disabled={updateCourtStatus.isPending}>{updateCourtStatus.isPending ? <><RefreshCw className="size-4 animate-spin" /> Atualizando...</> : <><Check className="size-4" /> Confirmar status</>}</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
