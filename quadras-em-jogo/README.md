# Quadras em Jogo

Plataforma colaborativa para encontrar quadras esportivas por cidade ou região, consultar a disponibilidade atual e compartilhar atualizações com outros jogadores.

> **Objetivo do produto:** reduzir o tempo entre querer jogar e encontrar uma quadra realmente disponível.

## Visão geral

A aplicação combina uma busca pública de quadras com recursos autenticados de colaboração. Visitantes podem pesquisar por cidade, região, modalidade e disponibilidade. Usuários autenticados podem cadastrar novas quadras, informar o endereço completo e atualizar o status de uma quadra como **aberta**, **fechada** ou **jogando agora**.

O endereço cadastrado é geocodificado antes da gravação. As coordenadas são persistidas junto com a quadra e utilizadas para renderizar marcadores no mapa interativo. Cada alteração de disponibilidade também gera um registro no histórico de status.

## Funcionalidades

| Recurso | Descrição |
|---|---|
| Busca local | Pesquisa por cidade ou região, usando lógica OR para o termo de localização. |
| Filtros | Filtragem por modalidade e disponibilidade. |
| Listagem | Cards com nome, cidade, região, endereço, modalidade, status e última atualização. |
| Mapa | Google Maps com marcadores reais quando as quadras possuem coordenadas válidas. |
| Status | Estados aberta, fechada e jogando agora, com cores e textos explicativos. |
| Autenticação | Login e logout por Manus OAuth. |
| Cadastro colaborativo | Usuários autenticados podem adicionar quadras. |
| Atualização colaborativa | Usuários autenticados podem alterar a disponibilidade e adicionar uma observação. |
| Persistência | Quadras, perfis e histórico de atualizações armazenados em banco MySQL/TiDB. |
| Responsividade | Interface adaptada para desktop e dispositivos móveis. |

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Front-end | React 19, Vite e Tailwind CSS 4 |
| Componentes | shadcn/ui e Radix UI |
| Ícones | lucide-react |
| API | Express 4 e tRPC 11 |
| Banco | MySQL/TiDB com Drizzle ORM |
| Autenticação | Manus OAuth com sessão por cookie seguro |
| Mapas | Google Maps JavaScript API por meio do proxy de mapas configurado no template |
| Testes | Vitest |
| Tipagem | TypeScript |

## Estrutura principal

```text
client/
  index.html                 Metadados, título e fontes da aplicação
  src/
    pages/Home.tsx           Página principal, busca, filtros e diálogos colaborativos
    components/Map.tsx       Carregamento do mapa e marcadores das quadras
    components/ui/           Componentes reutilizáveis de interface
    _core/hooks/useAuth.ts   Estado de autenticação do usuário
    lib/trpc.ts              Cliente tRPC tipado
    index.css                Tokens e identidade visual

drizzle/
  schema.ts                  Tabelas users, courts e status_updates
  migrations/                Migrações SQL geradas pelo Drizzle

server/
  db.ts                      Consultas e mutações de persistência
  routers.ts                 Contratos públicos e protegidos da API
  _core/                     Infraestrutura do template e autenticação

shared/
  const.ts                   Constantes compartilhadas
  types.ts                   Tipos compartilhados

todo.md                      Histórico de tarefas do projeto
visual-check.md              Registro da verificação visual
```

## Requisitos

É necessário ter Node.js compatível com o projeto, pnpm e acesso às variáveis de ambiente fornecidas pelo ambiente Manus. O banco deve ser MySQL ou TiDB compatível com a configuração do Drizzle.

As variáveis sensíveis não devem ser gravadas no código nem commitadas em arquivos `.env`. No ambiente Manus, elas são administradas pelo painel de Secrets.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão com o banco MySQL/TiDB. |
| `JWT_SECRET` | Assinatura das sessões. |
| `VITE_APP_ID` | Identificador da aplicação Manus. |
| `OAUTH_SERVER_URL` | Servidor de autenticação OAuth. |
| `VITE_OAUTH_PORTAL_URL` | Portal de login exibido ao usuário. |
| `BUILT_IN_FORGE_API_URL` | Endpoint de APIs internas no servidor. |
| `BUILT_IN_FORGE_API_KEY` | Credencial de APIs internas no servidor. |
| `VITE_FRONTEND_FORGE_API_URL` | Endpoint usado pelo cliente para recursos do template, incluindo mapas. |
| `VITE_FRONTEND_FORGE_API_KEY` | Credencial pública/proxy usada pelo cliente conforme a configuração do ambiente. |

Os valores reais devem ser inseridos pelo mecanismo de Secrets do projeto. Nunca coloque chaves reais diretamente em `Home.tsx`, `Map.tsx`, `index.html` ou no repositório Git.

## Executando localmente

Instale as dependências e inicialize o servidor de desenvolvimento:

```bash
pnpm install
pnpm dev
```

O servidor de desenvolvimento utiliza a porta definida pela infraestrutura do projeto. Não fixe uma porta adicional em código de aplicação.

## Banco de dados e migrações

O schema está em `drizzle/schema.ts`. As principais tabelas são:

| Tabela | Responsabilidade |
|---|---|
| `users` | Perfis sincronizados pelo Manus OAuth. |
| `courts` | Dados cadastrais, localização, modalidade, status e timestamps das quadras. |
| `status_updates` | Histórico de alterações feitas pelos usuários autenticados. |

Para alterar o schema, siga este fluxo:

```bash
pnpm drizzle-kit generate
```

Revise o SQL gerado em `drizzle/`, aplique a migração pelo fluxo de migração do ambiente e mantenha o schema TypeScript sincronizado com o banco. Evite operações destrutivas e não utilize a base de produção para testes com dados fictícios.

## API tRPC

Os contratos estão em `server/routers.ts`:

| Procedimento | Acesso | Função |
|---|---|---|
| `auth.me` | Público | Retorna o usuário autenticado, quando houver sessão. |
| `auth.logout` | Público | Limpa a sessão atual. |
| `courts.list` | Público | Consulta quadras com filtros de cidade, região, status e modalidade. |
| `courts.statusHistory` | Público | Consulta o histórico de uma quadra. |
| `courts.create` | Protegido | Cadastra uma quadra e exige usuário autenticado. |
| `courts.updateStatus` | Protegido | Atualiza a disponibilidade e registra a alteração. |

As consultas de localização usam cidade ou região. Status e modalidade são combinados como filtros adicionais:

```text
(localização por cidade OU região) E status E modalidade
```

## Autenticação e colaboração

O login é iniciado no cliente por `startLogin()`, sempre dentro de uma ação do usuário. O callback OAuth é processado por `/api/oauth/callback`, que cria a sessão. No servidor, procedimentos que alteram dados utilizam `protectedProcedure` e recebem o usuário autenticado em `ctx.user`.

O fluxo de cadastro funciona assim:

1. O usuário autenticado abre **Adicionar quadra**.
2. Informa nome, modalidade, cidade, região, endereço e status inicial.
3. O endereço é enviado ao geocoder.
4. Se não forem obtidas coordenadas válidas, o salvamento é bloqueado e uma mensagem é exibida.
5. Com latitude e longitude válidas, a quadra é persistida.
6. A listagem é invalidada e o mapa pode renderizar o novo marcador.

## Integração com mapas

`client/src/components/Map.tsx` carrega o Google Maps usando o proxy configurado no template. O componente recebe marcadores no formato:

```ts
{
  id: number;
  name: string;
  position: { lat: number; lng: number };
  status: "open" | "closed" | "playing";
}
```

O `Home.tsx` converte as coordenadas persistidas das quadras em marcadores. O mapa utiliza `LatLngBounds` para ajustar a área visível quando há mais de uma quadra. Os marcadores mudam de cor conforme o status e exibem o nome da quadra ao serem selecionados.

Caso o serviço de mapas não esteja disponível, a interface exibe um fallback e mantém a busca e a listagem utilizáveis. Para um ambiente próprio, habilite as APIs de mapas e geocodificação no Google Cloud, restrinja a chave por domínio e autorize somente as APIs necessárias.

## Testes e validação

Os testes ficam em `server/*.test.ts`. A suíte cobre logout, consulta pública, validação de entrada, criação autenticada, atualização de status e bloqueio de operações sem login.

```bash
pnpm check
pnpm test
pnpm build
```

Antes de abrir uma alteração, valide também o layout em desktop e mobile. O arquivo `visual-check.md` registra a última verificação visual realizada.

## Convenções de desenvolvimento

A aplicação utiliza tRPC como contrato entre cliente e servidor. Novos dados devem ser adicionados ao schema Drizzle, receber helpers em `server/db.ts`, procedimento em `server/routers.ts` e interface no cliente. Não introduza wrappers REST ou chamadas `fetch` paralelas para operações que já pertencem ao contrato tRPC.

Arquivos de imagem, vídeo e outros assets grandes não devem ser armazenados em `client/public` ou dentro do projeto. Use o armazenamento configurado pelo ambiente e mantenha apenas arquivos pequenos de configuração no diretório público.

Toda funcionalidade ou correção deve ser registrada em `todo.md`, testada e revisada antes de criar um checkpoint.

## Estado atual

O projeto está configurado como uma aplicação full-stack com autenticação, banco de dados e servidor. A versão funcional inclui a identidade visual da plataforma, busca colaborativa, cadastro de quadras, histórico de status, geocodificação obrigatória e integração de mapa com fallback.

## Licença

Este repositório segue a licença definida no projeto. Consulte `package.json` e as regras do ambiente antes de redistribuir ou publicar o código.
