# CLAUDE.md

Ce fichier donne à Claude Code (claude.ai/code) le contexte nécessaire pour travailler sur ce dépôt.

## graphify

Ce dépôt a un graphe de connaissance à `graphify-out/` :

- Pour toute question sur le code, lancer d'abord `graphify query "<question>"` si `graphify-out/graph.json` existe. `graphify path "<A>" "<B>"` pour des relations, `graphify explain "<concept>"` pour un concept ciblé. Ça retourne un sous-graphe scopé, généralement bien plus petit que `GRAPH_REPORT.md` ou du grep brut.
- Si `graphify-out/wiki/index.md` existe, l'utiliser pour la navigation large plutôt que parcourir les sources à la main.
- Lire `graphify-out/GRAPH_REPORT.md` seulement pour une revue d'architecture globale, ou quand query/path/explain ne remontent pas assez de contexte.
- Après une modif de code, lancer `graphify update .` pour garder le graphe à jour (AST-only, pas de coût API).

## Projet

**NestWiki** — wiki collaboratif auto-hébergé (clone de WikiJS). pnpm workspace avec deux packages à la racine : `backend/` (NestJS + TypeORM + MySQL 8) et `frontend/` (React + TypeScript + Vite — scaffoldé, TailwindCSS/shadcn-ui restent à configurer, voir EPIC-10/FE-002). `README.md` est le cahier des charges complet et le backlog (voir §6/§7). La branche courante (`EPIC-10`) correspond au 3ème epic réellement implémenté du backlog (Frontend : Setup & Layout). Le numéro de version ne suit pas le numéro d'EPIC affiché dans le backlog, et chaque ticket terminé s'accompagne aussi d'une entrée dans la page "Notes de version" — voir §Versioning & changelog.

## Commandes

**Toujours lancer l'app depuis `backend/`** (`cd backend`) via ses scripts `package.json` — jamais `nest start`, `node dist/...` etc. directement depuis la racine.

**Utiliser `pnpm run <script>`** (`packageManager: "pnpm@..."`, `pnpm-workspace.yaml` — `npm run` n'est pas le gestionnaire de ce dépôt). En revanche, surveiller la sortie de `pnpm add`/`pnpm install` : ajouter une dépendance avec un build-script natif (ex. `bcrypt`) déclenche `[ERR_PNPM_IGNORED_BUILDS]`, un prompt d'approbation qui bloque la commande dans cet environnement — préférer une lib pure JS équivalente quand elle existe (ex. `bcryptjs` plutôt que `bcrypt`) plutôt que de débloquer le build-script. L'utilisateur a en général déjà ses propres serveurs de dev qui tournent en dehors de Claude Code (backend `:3000`, frontend `:5173` plus tard) — vérifier ces ports (`netstat`) avant d'en lancer un nouveau plutôt que de supposer qu'ils sont down.

**Tuer tout process lancé soi-même une fois la tâche terminée** (serveur de dev lancé pour vérifier un changement, script one-off, etc.) — ne rien laisser tourner en arrière-plan. `TaskStop` sur une tâche ne tue pas forcément le process `node` sous-jacent dans cet environnement (vécu plusieurs fois cette session) — vérifier avec `netstat -ano | grep ":3000"` et `taskkill //F //PID <pid>` si le port est toujours occupé après l'arrêt de la tâche. Ne jamais tuer un process qu'on n'a pas lancé.

```bash
# MySQL + Minio (requis par le backend)
docker compose up -d

# Backend dev server (watch mode)
cd backend && pnpm run start:dev

cd backend && pnpm run build
```

Backend seul (`backend/`) :

```bash
pnpm run lint                # eslint --fix
pnpm run start:prod          # node dist/main (build requis avant)

pnpm run migration:run       # applique les migrations TypeORM en attente
pnpm run migration:revert    # annule la dernière migration
pnpm run migration:generate  # diff entities vs DB (via tsx, hors contexte Nest)
pnpm run seed:dev            # crée l'utilisateur admin de dev (dev uniquement, jamais en prod)
pnpm run seed:content        # (re)seed la page arborescence documentation/notes-de-version/faq (safe en prod, à rejouer à chaque déploiement)
pnpm run backfill:avatars    # rattache aux comptes sans avatar_extension le fichier avatars/{id}/avatar.* encore présent dans Minio (idempotent ; déjà exécuté une fois automatiquement par la migration 1790300000000, à relancer à la main seulement si elle a été sautée faute de Minio joignable)
```

Config : trois fichiers `.env` séparés (chacun avec un `.env.example` à copier) :

- racine du dépôt — `MYSQL_ROOT_PASSWORD`/`MYSQL_DATABASE`, `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` pour `docker-compose.yml`.
- `backend/.env` — `PORT`, `FRONTEND_URL` (origine CORS), `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE`, `MINIO_ENDPOINT`/`MINIO_PORT`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`MINIO_BUCKET`/`MINIO_USE_SSL`, optionnellement `MINIO_PUBLIC_ENDPOINT`/`MINIO_PUBLIC_PORT`/`MINIO_PUBLIC_USE_SSL` (voir `storage.service.ts` — `MINIO_ENDPOINT` sert au backend pour parler à Minio en interne, ex. le nom du service Docker, injoignable depuis un navigateur ; `MINIO_PUBLIC_ENDPOINT`, quand défini, est l'hôte public utilisé uniquement pour signer les URLs présignées données au client, sinon retombe sur `MINIO_ENDPOINT`). Lu via `@nestjs/config` dans `app.module.ts`, et directement via `dotenv` dans `src/config/data-source.ts` pour le CLI TypeORM.
- `frontend/.env` — `VITE_API_URL` (URL de base de l'API backend, préfixe `/api` inclus — le backend a `app.setGlobalPrefix('api')` dans `main.ts` — ex. `http://localhost:3000/api`). Lu via `import.meta.env` (Vite), consommé par `src/lib/api-client.ts`.

## Versioning & changelog

`package.json` version (racine et chaque package, gardées synchronisées) continue de suivre `0.<n>.<ticket>` :
- Le nombre du milieu **n'est pas le numéro d'EPIC affiché** dans le backlog (README §6) — c'est un compteur qui s'incrémente de 1 à chaque changement d'EPIC, dans l'ordre réel d'implémentation (le dernier nombre repasse à `0` à ce moment-là).
- Le dernier nombre s'incrémente de un par ticket terminé dans l'EPIC courant — un bump par commit/ticket, pas par EPIC.

`GET /health` ne retourne en revanche plus cette version — il reste un JSON nu (`{ status: 'ok' }`), pas enveloppé par `ResponseDto` — c'est un healthcheck consommé par des outils d'infra, pas par le frontend applicatif.

En complément du bump de version, chaque ticket terminé ajoute aussi une entrée dans le contenu de la page **"Notes de version"** seedée par `backend/src/database/content-seed.ts` (entrée `notes-de-version` de `PAGE_TREE_SEED`) : entrée en tête de la section `## Version 0.<n>` de l'EPIC courant (créée au premier ticket de l'EPIC, plus récent en premier), sous la forme d'un bloc `<details><summary><version> — <date></summary>` contenant une liste à puces résumant le changement.

## Architecture backend (`backend/src`)

NestJS, un module par domaine, directement sous `src/` — **pas** de dossier `modules/` intermédiaire. Modules prévus : `auth`, `users`, `pages`, `versions`, `media`, `search`, `comments`, `integrations`, `webhooks`, `admin`, `health`, plus `common/` (transverse : filtres/DTOs/exceptions/constantes globaux, pas de guards/décorateurs pour l'instant).

Chaque module suit le même découpage en couches — pour une nouvelle feature, suivre le découpage de fichiers du module `auth`/`users` plutôt qu'en inventer un nouveau :

- `<module>.controller.ts` — HTTP uniquement, pas de logique métier ; délègue directement à un service. Routes protégées : `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` pour un admin-only strict, ou `@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@RequirePermission(<GlobalPermission>)` pour une permission globale (voir "Core domain model" plus bas) — et `@UseFilters(<Module>ExceptionFilter)`.
- `services/*.service.ts` — logique métier **et validation** (pas de `class-validator`/`ValidationPipe` global câblé — voir `dto/in`) ; lève des exceptions de domaine depuis `common/exceptions/<domain>/*.exception.ts` (ou `common/exceptions/validation.exception.ts` pour une erreur de validation générique). Les garder spécifiques (ex. `EmailAlreadyExistsException`, pas une `HttpException` générique) — le filtre d'exception du module dispatch sur `exception.name` ; une exception générique ou mal nommée tombe dans le `default:` (500).
- `dto/in/*.dto.ts` / `dto/out/*.dto.ts` — classes simples, **pas de décorateurs `class-validator`**. Un fichier `dto/out` peut être une simple `interface` plutôt qu'une `class` quand c'est une forme de donnée nue jamais instanciée directement et seulement enveloppée dans une réponse (ex. `auth/dto/out/user-response.dto.ts` `UserResponseDto`, retourné dans un `ResponseDto<UserResponseDto>`).
- `entities/*.entity.ts` — entités TypeORM ; le schéma DB est possédé par les migrations, **jamais** `synchronize: true` (hardcodé `false` dans `config/typeorm.config.ts`) et pas la sortie de `migration:generate` prise telle quelle sans relecture.
- `persistence/` — repository **port** (interface, ex. `user.repository.ts`) + adapter TypeORM (`typeorm.user.repository.ts`), injecté via un **token string littéral** (ex. `@Inject('UsersRepository')`) bindé dans les `providers` du module (`{ provide: 'UsersRepository', useClass: TypeormUserRepository }`) — pas de `Symbol`, pas de `abstract class`, pas de constante exportée pour le nom du token (littéral inline aux deux sites). ⚠️ Choisir un token **différent** de `` `${EntityName}Repository` `` (ex. `'UsersRepository'` au pluriel pour l'entité `User`) : `@nestjs/typeorm` enregistre déjà un provider sous ce nom exact pour `@InjectRepository(Entity)`, et réutiliser la même string écrase silencieusement ce provider avec le vôtre → dépendance circulaire sur lui-même (`UnknownDependenciesException` au démarrage).
- `mapper/*.mapper.ts` — classe statique traduisant entities <-> DTOs, et construisant les objets d'enveloppe de réponse (`new ResponseDto(...)`) retournés au controller.
- `filter/*.exception.filter.ts` — filtre `@Catch()` (sans type précisé) par module, dispatchant sur `exception.name` vers `{ statusCode, error }`, avec un `default:` qui retombe sur 500.

**Enveloppe de réponse (`common/`)** : `common/dto/response.dto.ts` exporte `ResponseDto<T>` (`{ status: ApiStatus, data: T | null }`, construit via `new ResponseDto(data)`) ; `common/enums/api-status.enum.ts` exporte `ApiStatus`. Les endpoints retournent `{ status: 'success', data: ... }` en succès (via `ResponseDto`, construit par le mapper) et `{ error: '<message>' }` (avec un statut HTTP approprié) en échec, via le filtre d'exception du module — `common/filters/http-exception.filter.ts` est le filtre global de secours (`@UseGlobalFilters` dans `main.ts`) pour tout ce qu'aucun filtre de module n'attrape. Les messages d'erreur sont en anglais (convention déjà posée par les tickets `BE-0xx`).

**`common/variables.global.ts`** centralise les constantes transverses (`EMAIL_REGEX`, `MIN_PASSWORD_LENGTH`, `DISPLAY_NAME_MIN_LENGTH`, `DISPLAY_NAME_MAX_LENGTH`, etc.) — ajouter les nouvelles constantes de validation partagées ici plutôt que de les redéclarer localement dans un service.

Auth : JWT (access + refresh token), retournés dans le **corps** de la réponse par `POST /auth/login`/`POST /auth/refresh` (pas de cookie `httpOnly`) — c'est le contrat déjà fixé par le backlog (README §7).

Base de données : MySQL 8 via `@nestjs/typeorm`, tous les changements de schéma passent par des migrations dans `src/database/migrations/` (SQL brut via `queryRunner.query`, pas le query builder — voir les migrations existantes). `src/config/data-source.ts` est un `DataSource` standalone séparé utilisé seulement par le CLI TypeORM (les migrations tournent hors du contexte Nest, contre `src/**/*.entity.ts` directement, pas `dist/`).

Deux scripts `tsx` standalone comme `data-source.ts`, hors contexte Nest, idempotents :

- `src/database/dev-seed.ts` (`pnpm run seed:dev`) crée l'utilisateur admin de dev (skip s'il existe déjà par email). **Usage dev uniquement, jamais exécuté en prod/CI.**
- `src/database/content-seed.ts` (`pnpm run seed:content`) crée/met à jour l'arborescence de pages de contenu (documentation sur 3 niveaux, notes de version, FAQ) — une page existante dont le contenu a changé reçoit une nouvelle `PageVersion` (jamais de skip silencieux d'un contenu modifié), attribuée au plus ancien utilisateur de la base. **Safe à rejouer en prod, prévu pour tourner à chaque déploiement** afin de garder la doc et les notes de version à jour.

Stockage médias : Minio (S3-compatible) via `storage/services/storage.service.ts`, bucket auto-créé au démarrage (`onModuleInit`) si absent.

## Architecture frontend (`frontend/src`)

Structure plate directement sous `src/` — **pas** de dossier `features/` :

- `api/` — fonctions d'appel API par domaine, utilisent l'instance de `lib/api-client.ts`.
- `assets/` — images, fonts, etc.
- `components/` — un sous-dossier par page pour les composants spécifiques à cette page, plus les composants génériques réutilisables à la racine ; `components/ui` accueillera les composants shadcn générés (**ne pas éditer à la main**, FE-002) et `components/layout` le layout global (Sidebar/Topbar/Breadcrumb, FE-003).
- `hooks/` — hooks React réutilisables.
- `lib/` — setup d'intégrations tierces ; `api-client.ts` est l'instance axios centralisée (interception 401 → refresh token automatique à venir, FE-004).
- `pages/` — un composant par route, câblées dans `main.tsx` via `react-router-dom` (`createBrowserRouter`).
- `schemas/` — schémas `zod` (validation de formulaires, parsing de réponses API).
- `utils/` — fonctions utilitaires pures (ex. `cn`), sans dépendance à une lib tierce (à la différence de `lib/`).

Suivre la même logique de couches que le backend côté appels API (wrapper par domaine dans `api/`, enveloppe `ResponseDto`/`ApiStatus` reflétée côté client) plutôt que d'inventer une structure différente.

## Core domain model (voir README.md §4 pour la liste complète des champs)

- **Page** a un pointeur `currentVersionId` ; éditer une page **ne modifie jamais** une `PageVersion` existante — insère toujours une nouvelle version et repointe `currentVersionId`. L'historique est append-only. Le rollback (`POST /pages/:id/versions/:versionId/restore`) crée une *nouvelle* version à partir de l'ancien contenu plutôt que de supprimer quoi que ce soit.
- L'arbre de **Page** est auto-référencé via `parentId` ; déplacer une page doit rejeter les cycles (une page devenant son propre ancêtre).
- Les lignes **Attachment** pointent vers des clés d'objet Minio (`pages/{pageId}/{uuid}-{filename}`) ; les fichiers ne sont pas publics par défaut — accès via URLs présignées (`GET /media/:id/url`).
- **User.role** est `admin | member` (les anciens rôles `editor`/`reader` ont été retirés, EPIC-30) ; `admin` a accès à tout, `member` dépend de ses permissions effectives (voir ci-dessous). Un compte a aussi `isActive` (désactivation) et `lockedUntil`/`failedLoginAttempts` (verrouillage temporaire après échecs de connexion répétés).
- **Modèle de permissions** (EPIC-30, voir README §4 pour le détail des entités) : un bénéficiaire est soit un utilisateur, soit un groupe (`Group`/`GroupMember`). Deux types de droits, chacun accordable directement à un utilisateur (`UserPermission`/règle sans `groupId`) ou à un groupe (`GroupPermission`/règle avec `groupId`) — un utilisateur cumule toujours ses droits directs **et** ceux de tous ses groupes :
  - des **permissions globales** (`GlobalPermission`, ex. `user.manage`, `tag.create`, `media.upload`) ;
  - des **règles d'accès aux pages** (`PageAccessRule`) : `pageId` (ou `null` pour toute la wiki), portée `page` (cette page seule) ou `subtree` (la page et toute sa descendance, sauf pages listées dans `PageAccessExclusion`), et un sous-ensemble de `PageAction` (`page.read`, `page.edit`, `page.manage_permissions`, etc.).
  - `PermissionsService` (`permissions/services/permissions.service.ts`) est le point d'entrée unique de résolution : `hasGlobal(user, permission)` et `can(user, action, pageId)` (un admin passe toujours ; sinon cumule droits directs + groupes, résout l'héritage de sous-arborescence en remontant la chaîne d'ancêtres de la page via `PageHierarchyRepository.findChains`, et court-circuite sur une exclusion). `explainUserPermissions` renvoie en plus l'origine de chaque droit (direct vs groupe X).
  - Invariant anti-escalade : toute création/modification d'une permission de groupe ou d'une règle d'accès vérifie que l'auteur (`grantedById`) détient lui-même au moins autant que ce qu'il accorde — sinon `InsufficientPermissionException`/403. Un bénéficiaire ne peut jamais finir avec plus de droits que son auteur, même indirectement via un ajout à un groupe.
  - Deux mécanismes de garde coexistent côté routes : `JwtAuthGuard` + `RolesGuard`/`@Roles(...)` pour une poignée de routes strictement réservées aux admins (clés API MCP, réglages système, journaux d'audit — 403 sinon) ; `JwtAuthGuard` + `PermissionsGuard`/`@RequirePermission(<GlobalPermission>)` pour les routes gardées par une permission globale (ex. `/admin/users`, `/admin/groups`, via `hasGlobal`). Les actions **par page** (éditer, déplacer, supprimer, gérer les tags/la visibilité/les permissions d'une page précise) ne passent **pas** par un guard générique — chaque service appelle `permissionsService.can(user, action, pageId)` au cas par cas, car le droit dépend de la ressource visée, pas seulement du rôle.
- **IntegrationConfig** (`discord` | `n8n`) porte l'URL webhook/secret/options en JSON ; les notifications Discord sont fire-and-forget (un échec d'envoi ne doit jamais bloquer l'action déclenchante).
- La visibilité (`public | private`) est le seul drapeau de lecture sur `Page` (pas de champ `isPublished` séparé) : `public` est lisible par tout le monde y compris anonyme, `private` n'est lisible que par les admins ou par un utilisateur/groupe ayant `page.read` sur cette page ou un ancêtre (`PermissionsService.can`, réutilisé tel quel comme vérification de lecture). `PagesService.setVisibility` déclenche `PAGE_PUBLISHED_EVENT` quand une page passe de private à public (cascade sur les descendants). "selon visibilité" dans le tableau des endpoints signifie que l'ensemble de réponse doit être filtré selon les droits de l'utilisateur demandeur — voir aussi recherche, médias et commentaires.

## Full API surface and backlog

`README.md` contient le tableau complet des endpoints (§7) et le backlog ticket par ticket (§6, tickets `BE-xxx`/`FE-xxx`/`OPS-xxx` groupés en EPIC-01 à EPIC-18) avec les critères d'acceptation par ticket. Traiter les AC de chaque ticket comme la spec de ce morceau de travail — ex. slug dupliqué au même niveau d'arborescence → 409, mauvais mot de passe → 401, suppression d'une page avec enfants nécessite `?cascade=true`, etc.

## Commentaires de code

Pas de commentaires de code. Écrire du code auto-explicite (nommage clair, petites fonctions/classes) plutôt que d'expliquer après coup.

## Tests

Fichiers `*.spec.ts`/`*.e2e-spec.ts` autorisés (vitest — scripts `test`/`test:watch`/`test:cov`/`test:e2e`). Suivre le pattern déjà en place plutôt qu'en inventer un nouveau : voir `backend/src/pages/services/pages.service.spec.ts` (`Test.createTestingModule`, repository/services mockés via `vi.fn()`, pas d'accès DB réel dans les tests unitaires).
