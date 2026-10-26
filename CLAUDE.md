# CLAUDE.md

Ce fichier donne à Claude Code (claude.ai/code) le contexte nécessaire pour travailler sur ce dépôt.

## graphify

Ce dépôt a un graphe de connaissance à `graphify-out/` :

- Pour toute question sur le code, lancer d'abord `graphify query "<question>"` (`graphify path "<A>" "<B>"` pour une relation, `graphify explain "<concept>"` pour un concept ciblé) : sous-graphe scopé, bien plus petit que `GRAPH_REPORT.md` ou du grep brut.
- Si `graphify-out/wiki/index.md` existe, l'utiliser pour la navigation large ; `GRAPH_REPORT.md` seulement pour une revue d'architecture globale.
- Après une modif de code, `graphify update .` (AST-only, pas de coût API).

## Projet

**NestWiki** — wiki collaboratif auto-hébergé, open source (AGPL-3.0, `LICENSE`). pnpm workspace avec deux packages : `backend/` (NestJS + TypeORM + MySQL 8) et `frontend/` (React + TypeScript + Vite, TailwindCSS + shadcn/ui). `README.md` (anglais) présente le projet et l'installation ; `docs/technical-spec.md` (français) contient le modèle de données et le tableau complet des endpoints ; `docs/deployment.md` décrit le déploiement continu de l'instance de l'auteur. Le backlog vit dans Jira (projet `WIKI`, un epic `EPIC-<n>` par lot de tickets `WIKI-<n>`).

Skills : `finish-ticket` pour clôturer un ticket (version, changelog, PR, arrêt pour relecture), `new-backend-module` pour créer un module backend. Ce fichier reste la référence des conventions propres au projet.

## Commandes

**Toujours lancer l'app depuis `backend/`** via ses scripts `pnpm run <script>` — jamais `nest start`, `node dist/...` ni `npm run`. L'utilisateur a en général déjà ses serveurs de dev (backend `:3000`, frontend `:5173`) : vérifier les ports avant d'en lancer un. `TaskStop` ne tue pas toujours le process `node` sous-jacent ici : vérifier `netstat -ano | grep ":3000"` après l'arrêt, puis `taskkill //F //PID <pid>` si c'est le sien.

```bash
docker compose up -d                     # MySQL + RustFS, requis par le backend
cd backend && pnpm run start:dev         # backend en watch
cd frontend && pnpm run dev              # frontend Vite
```

Backend (`backend/`) :

```bash
pnpm run lint                # eslint --fix
pnpm run test                # vitest
pnpm run build
pnpm run start:prod          # node dist/main (build requis avant)

pnpm run migration:run       # applique les migrations TypeORM en attente
pnpm run migration:revert    # annule la dernière migration
pnpm run migration:generate  # diff entities vs DB (via tsx, hors contexte Nest) — à relire, jamais pris tel quel
pnpm run seed:admin          # crée le premier admin depuis ADMIN_* s'il n'existe aucun admin (idempotent, lancé par entrypoint.sh ; Nest fait la même vérification au démarrage)
pnpm run seed:content        # (re)seed l'arborescence documentation/notes-de-version/faq (safe en prod, rejoué à chaque déploiement)
pnpm run backfill:avatars    # rattache le fichier avatars/{id}/avatar.* resté dans le stockage aux comptes sans avatar_extension (idempotent ; déjà lancé par la migration 1790300000000, à relancer seulement si elle l'a sauté faute de stockage joignable)
```

Config : trois fichiers `.env` séparés, chacun avec un `.env.example` à copier :

- racine — `MYSQL_ROOT_PASSWORD`/`MYSQL_DATABASE`, `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` pour `docker-compose.yml`, et `VITE_*` lus au build de l'image frontend.
- `backend/.env` — `PORT`, `FRONTEND_URL` (origine CORS), `DB_*`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_DISPLAY_NAME` (premier admin), `MINIO_ENDPOINT`/`MINIO_PORT`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`MINIO_BUCKET`/`MINIO_USE_SSL`, et optionnellement `MINIO_PUBLIC_ENDPOINT`/`MINIO_PUBLIC_PORT`/`MINIO_PUBLIC_USE_SSL` : `MINIO_ENDPOINT` sert au backend pour parler au stockage en interne (ex. nom du service Docker), `MINIO_PUBLIC_ENDPOINT` sert uniquement à signer les URLs présignées données au navigateur, et retombe sur `MINIO_ENDPOINT` s'il est absent (`storage.service.ts`). Lu via `@nestjs/config` dans `app.module.ts`, et via `dotenv` dans `src/config/data-source.ts` pour le CLI TypeORM. **`validateEnvironment` (`src/config/env.validation.ts`) bloque le démarrage**, y compris en dev, si un secret JWT fait moins de 32 caractères, si les deux secrets JWT sont identiques, ou si `DB_PASSWORD`/`MINIO_SECRET_KEY`/`ADMIN_PASSWORD` est absent ou dans `KNOWN_DEFAULT_SECRETS` (`changeme`, `minioadmin`, `root`…) — sauf `DEV=true` dans `backend/.env` (court-circuite la validation, développement local uniquement, jamais en prod).
- `frontend/.env` — `VITE_API_URL`, URL de base de l'API préfixe `/api` inclus (`app.setGlobalPrefix('api')` dans `main.ts`), ex. `http://localhost:3000/api`. Consommé par `src/lib/api-client.ts`.

## Versioning & changelog

La version des trois `package.json` (racine, `backend/`, `frontend/`, gardées identiques) suit `1.<n>.<ticket>` depuis la 1.0 (EPIC-32) : le dernier nombre s'incrémente de un par ticket terminé (un bump par ticket/PR, pas par epic) ; un nouvel epic incrémente `<n>` et remet le dernier à `0`. Avant la 1.0 : `0.<n>.<ticket>`, `<n>` comptant les epics dans l'ordre réel d'implémentation.

Chaque ticket ajoute une section **en tête de `CHANGELOG.md`** : `## <version> — <AAAA-MM-JJ>` puis des puces du point de vue de l'utilisateur, avec ⚠️ quand une mise à jour demande une action. `CHANGELOG.md` est la source unique : `backend/src/database/release-notes.ts` le lit pour générer la page « Notes de version » seedée par `content-seed.ts` (regroupement par version mineure, sélecteur HTML + CSS sans JS), et la CI en extrait la section de la version pour la release GitHub. Ne pas écrire de notes de version dans `content-seed.ts`.

`GET /health` ne retourne pas la version : il reste un JSON nu (`{ status: 'ok' }`), pas enveloppé par `ResponseDto`, car consommé par des outils d'infra.

Branches : les PR de tickets visent **`dev`** (branche d'intégration), jamais `main` ; pour un epic à plusieurs tickets, chaque PR part de `dev` à jour une fois la précédente mergée, plutôt qu'une pile de PR. `main` ne reçoit que des merges de `dev` (ou un correctif urgent) et déclenche seul le déploiement.

CI (`ci.yml`) : un push sur `dev` pousse les images `ghcr.io/firedrox/nestwiki-{backend,frontend}` taguées `dev`, `X.Y.Z-dev` et `sha-<commit>` et publie `vX.Y.Z` en **pré-release** GitHub, sans déployer. Un push sur `main` tague `X.Y.Z`, `X.Y`, `latest`, promeut en releases les pré-releases arrivées avec le merge, publie `vX.Y.Z` si absente, puis `deploy.yml` déploie (uniquement sur `FireDroX/nestwiki`).

## Architecture backend (`backend/src`)

NestJS, un module par domaine directement sous `src/` — **pas** de dossier `modules/` : `activity`, `admin`, `auth`, `comments`, `health`, `imports`, `mcp`, `media`, `meta`, `pages`, `permissions`, `realtime`, `search`, `security`, `stats`, `storage`, `tags`, `users`, `versions`, `webhooks`, plus `common/` (filtres, DTOs, exceptions, guards, décorateurs, stratégies JWT, constantes globales), `config/` (TypeORM, validation de l'environnement) et `database/` (migrations, seeds).

Chaque module suit le même découpage en couches ; `tags` en est l'exemple complet le plus simple :

- `<module>.controller.ts` — HTTP uniquement : un appel au service, puis le mapper construit la réponse. Routes protégées : `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` pour un admin-only strict, ou `@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@RequirePermission(<GlobalPermission>)` pour une permission globale ; toujours `@UseFilters(<Module>ExceptionFilter)`.
- `services/*.service.ts` — logique métier **et validation** (pas de `class-validator` ni de `ValidationPipe` global) ; retourne des entités ou objets métier, jamais un `ResponseDto`. Lève des exceptions de domaine spécifiques depuis `common/exceptions/<domain>/*.exception.ts` (`extends Error`, `this.name = '<NomDeClasse>'`), ou `common/exceptions/validation.exception.ts` pour une validation générique.
- `dto/in/*.dto.ts` — classes simples, sans décorateurs. `dto/out/*.dto.ts` — de préférence une `interface`, enveloppée dans un `ResponseDto<T>`.
- `entities/*.entity.ts` — entités TypeORM ; le schéma appartient aux migrations, **jamais** `synchronize: true` (hardcodé `false` dans `config/typeorm.config.ts`).
- `persistence/` — repository **port** (interface, ex. `user.repository.ts`) + adapter TypeORM (`typeorm.user.repository.ts`), injecté via un **token string littéral** aux deux sites (`@Inject('UsersRepository')` / `{ provide: 'UsersRepository', useClass: TypeormUserRepository }`) — pas de `Symbol`, pas d'`abstract class`, pas de constante exportée. ⚠️ Le token doit **différer** de `` `${EntityName}Repository` `` (d'où le pluriel `'UsersRepository'` pour `User`) : `@nestjs/typeorm` enregistre déjà ce nom pour `@InjectRepository(Entity)`, et le réutiliser provoque une dépendance circulaire au démarrage (`UnknownDependenciesException`).
- `mapper/*.mapper.ts` — classe statique entity → DTO, qui construit l'enveloppe (`new ResponseDto(...)`) retournée par le controller.
- `filter/*.exception.filter.ts` — filtre `@Catch()` par module, `switch (exception.name)` vers `{ statusCode, error }` ; un nom inconnu est délégué à `HttpExceptionFilter.respond`, qui répond 500 hors exceptions HTTP. Le filtre doit lister aussi les exceptions des services d'autres modules appelés (`PageNotFoundException`…), sinon elles finissent en 500.

**Enveloppe de réponse** : `ResponseDto<T>` (`common/dto/response.dto.ts`, `{ status: ApiStatus, data: T | null }`, via `new ResponseDto(data)`) en succès, `{ error: '<message>' }` avec le bon statut HTTP en échec via le filtre du module ; `common/filters/http-exception.filter.ts` est aussi le filtre global de secours (`useGlobalFilters` dans `main.ts`). Messages d'erreur en anglais.

**`common/variables.global.ts`** centralise les constantes de validation (`EMAIL_REGEX`, `MIN_PASSWORD_LENGTH`, `DISPLAY_NAME_MAX_LENGTH`…) : y ajouter les nouvelles plutôt que de les déclarer dans un service.

Auth : JWT (access 15 min + refresh) déposés en cookies `httpOnly` (`accessToken`/`refreshToken`) par `POST /auth/login`/`POST /auth/refresh`, rien dans le corps. `JwtAuthGuard` exige une session ; `OptionalJwtAuthGuard` laisse passer les anonymes mais répond 401 quand un cookie de session est présent sans utilisateur valide (pour que le frontend rafraîchisse le token) ; `AnonymousFallbackJwtAuthGuard` (réservé à `GET /media/:id/raw`, chargé par `<img>`) retombe toujours en anonyme.

Base de données : MySQL 8 ; tout changement de schéma passe par une migration dans `src/database/migrations/`, en SQL brut via `queryRunner.query` (voir les migrations existantes). `src/config/data-source.ts` est un `DataSource` standalone réservé au CLI TypeORM : les migrations tournent hors contexte Nest, contre `src/**/*.entity.ts` et non `dist/`.

Deux scripts `tsx` standalone, idempotents :

- `src/database/run-admin-seed.ts` (`seed:admin`) crée le premier admin depuis `ADMIN_*` quand la base n'en a aucun (`ensureDefaultAdmin` de `default-admin.ts`, aussi appelé au démarrage par `DefaultAdminInitializer`). Ne modifie jamais un compte existant.
- `src/database/content-seed.ts` (`seed:content`) crée/met à jour l'arborescence de contenu (documentation sur 3 niveaux, notes de version, FAQ) ; une page dont le contenu a changé reçoit une nouvelle `PageVersion`, attribuée au plus ancien utilisateur. **Safe à rejouer en prod, prévu pour chaque déploiement.**

Stockage médias : objet S3-compatible (RustFS dans `docker-compose.yml` ; client et variables gardent le nom Minio) via `storage/services/storage.service.ts`, bucket créé au démarrage s'il manque.

## Architecture frontend (`frontend/src`)

Structure plate directement sous `src/` — **pas** de dossier `features/` :

- `api/` — fonctions d'appel API par domaine, via l'instance de `lib/api-client.ts`.
- `assets/` — images, fonts, etc.
- `components/` — un sous-dossier par page pour ses composants, les génériques à la racine ; `components/ui` contient les composants shadcn générés (**ne pas éditer à la main**), `components/layout` le layout global (Sidebar/Topbar/Breadcrumb).
- `hooks/` — hooks React réutilisables.
- `lib/` — setup d'intégrations tierces ; `api-client.ts` est l'instance axios centralisée (cookies `withCredentials`, 401 → refresh du token puis rejeu, déconnexion si le refresh échoue).
- `pages/` — un composant par route, câblées dans `App.tsx` (`react-router`, `BrowserRouter` dans `main.tsx`).
- `schemas/` — schémas `zod` (formulaires, parsing des réponses API).
- `utils/` — fonctions pures (ex. `cn`), sans lib tierce (à la différence de `lib/`).

Côté appels API, même logique de couches que le backend : un wrapper par domaine dans `api/`, enveloppe `ResponseDto`/`ApiStatus` reflétée côté client.

## Core domain model (`docs/technical-spec.md` §4 pour tous les champs)

- **Page** a un pointeur `currentVersionId` ; éditer une page **ne modifie jamais** une `PageVersion` : on insère une nouvelle version et on repointe `currentVersionId` (historique append-only). Le rollback (`POST /pages/:id/versions/:versionId/restore`) crée une *nouvelle* version à partir de l'ancien contenu.
- L'arbre de **Page** est auto-référencé via `parentId` ; un déplacement doit rejeter les cycles.
- Les lignes **Attachment** pointent vers des clés d'objet (`pages/{pageId}/{uuid}-{filename}`), non publiques : accès via URLs présignées (`GET /media/:id/url`).
- **User.role** est `admin | member` (`editor`/`reader` retirés, EPIC-30) : `admin` a accès à tout, `member` dépend de ses permissions effectives. Un compte a aussi `isActive` et `lockedUntil`/`failedLoginAttempts` (verrouillage après échecs de connexion répétés).
- **Modèle de permissions** (EPIC-30) : un bénéficiaire est un utilisateur ou un groupe (`Group`/`GroupMember`) ; chaque droit s'accorde directement (`UserPermission`, règle sans `groupId`) ou à un groupe (`GroupPermission`, règle avec `groupId`), et un utilisateur cumule toujours ses droits directs **et** ceux de ses groupes :
  - **permissions globales** (`GlobalPermission`, ex. `user.manage`, `tag.create`, `media.upload`) ;
  - **règles d'accès aux pages** (`PageAccessRule`) : `pageId` (ou `null` pour toute la wiki), portée `page` ou `subtree` (la page et sa descendance, sauf pages de `PageAccessExclusion`), et un sous-ensemble de `PageAction` (`page.read`, `page.edit`, `page.manage_permissions`…).
  - `PermissionsService` (`permissions/services/permissions.service.ts`) est le point d'entrée unique : `hasGlobal(user, permission)` et `can(user, action, pageId)` (un admin passe toujours ; sinon droits directs + groupes, héritage de sous-arborescence résolu en remontant les ancêtres via `PageHierarchyRepository.findChains`, court-circuit sur une exclusion). `explainUserPermissions` renvoie en plus l'origine de chaque droit.
  - Invariant anti-escalade : créer ou modifier une permission de groupe ou une règle d'accès vérifie que l'auteur (`grantedById`) détient au moins ce qu'il accorde, sinon `InsufficientPermissionException`/403 — même indirectement via un ajout à un groupe.
  - Gardes : `RolesGuard`/`@Roles(...)` pour quelques routes strictement admin (clés API MCP, réglages système, journaux d'audit) ; `PermissionsGuard`/`@RequirePermission(...)` pour une permission globale (ex. `/admin/users`, `/admin/groups`). Les actions **par page** (éditer, déplacer, supprimer, tags, visibilité, permissions d'une page) ne passent **pas** par un guard : chaque service appelle `permissionsService.can(user, action, pageId)`, car le droit dépend de la ressource visée.
- La visibilité (`public | private`) est le seul drapeau de lecture d'une `Page` : `public` est lisible par tous, anonymes compris ; `private` par les admins ou par qui a `page.read` sur la page ou un ancêtre (`PermissionsService.can`). `PagesService.setVisibility` déclenche `PAGE_PUBLISHED_EVENT` au passage private → public (cascade sur les descendants). « Selon visibilité » dans le tableau des endpoints = réponse filtrée selon les droits du demandeur (recherche, médias, commentaires compris).

## Rendu du contenu des pages

`frontend/src/components/MarkdownRenderer.tsx` définit ce qu'une page peut contenir (mode `full` pour les pages, `restricted` pour les commentaires) : GFM, encadrés `> [!NOTE]` (`lib/markdown-callouts.ts`), ancres et sommaire (`lib/markdown-headings.ts`), LaTeX `$$`, Mermaid (`lib/markdown-mermaid.ts`), HTML durci et `<style>` scopé. **Toute évolution de ce rendu met à jour, dans le même ticket, les deux descriptions qui en dépendent** : la page « Marquages disponibles » (`content-seed.ts`) pour les humains, et `backend/src/mcp/constants/page-formatting.guide.ts` pour les IA (instructions du serveur MCP et outil `wiki_get_formatting_guide`).

## API et backlog

`docs/technical-spec.md` §5 contient le tableau complet des endpoints. Chaque ticket Jira porte ses critères d'acceptation, à traiter comme la spec du travail — ex. slug dupliqué au même niveau → 409, mauvais mot de passe → 401, suppression d'une page avec enfants → `?cascade=true` requis.

## Commentaires de code

Pas de commentaires de code : nommage clair, petites fonctions et classes plutôt qu'une explication après coup.

## Tests

`*.spec.ts`/`*.e2e-spec.ts` avec vitest (`test`, `test:watch`, `test:cov`, `test:e2e`). Suivre le pattern existant, ex. `backend/src/pages/services/pages.service.spec.ts` : `Test.createTestingModule`, repositories et services mockés via `vi.fn()`, pas d'accès DB dans les tests unitaires.
