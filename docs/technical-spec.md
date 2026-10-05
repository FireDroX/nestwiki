# NestWiki — Spécification technique

Clone de WikiJS — NestJS / TypeORM / MySQL / React / TypeScript / Tailwind / shadcn / Minio

---

## 1. Présentation du projet

**NestWiki** est une plateforme de wiki collaboratif auto-hébergée. Les utilisateurs créent des pages organisées en arborescence, chaque édition est versionnée, les médias sont stockés sur Minio.

### Objectifs fonctionnels

- Créer, éditer, organiser des pages en arborescence (dossiers/sous-pages)
- Versionner chaque modification (historique + rollback)
- Uploader et insérer des médias (images, fichiers) dans les pages
- Rechercher du contenu (full-text)
- Gérer des utilisateurs, des groupes et des permissions granulaires par page ou globales (admin / membre)

---

## 2. Stack technique

| Couche          | Techno                                                               |
| --------------- | -------------------------------------------------------------------- |
| Backend         | NestJS (Node.js, TypeScript)                                         |
| ORM             | TypeORM                                                              |
| Base de données | MySQL 8                                                              |
| Stockage objets | RustFS (S3-compatible ; remplace Minio, dont l'édition Community a été archivée en 2026) |
| Frontend        | React + TypeScript + Vite                                            |
| UI              | TailwindCSS + shadcn/ui                                              |
| Auth            | JWT (access + refresh token)                                         |
| Recherche       | MySQL FULLTEXT (v1) → migration Meilisearch possible (v2)            |

---

## 3. Architecture globale

```
nestwiki/
├── backend/           (NestJS)
│   ├── src/
│   │   ├── auth/
│   │   │   ├── services/
│   │   │   ├── persistances/   (entités TypeORM)
│   │   │   ├── dto/
│   │   │   │   ├── in/
│   │   │   │   └── out/
│   │   │   ├── mapper/
│   │   │   ├── filters/
│   │   │   ├── exceptions/
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.module.ts
│   │   ├── users/          (même structure : services/persistances/dto/mapper/filters)
│   │   ├── pages/          (idem)
│   │   ├── versions/       (idem)
│   │   ├── media/          (idem)
│   │   ├── search/         (idem)
│   │   ├── admin/          (idem)
│   │   ├── health/
│   │   ├── common/ (guards, decorators, interceptors, filters globaux)
│   │   └── main.ts
├── frontend/          (React + Vite)
│   ├── src/
│   │   ├── pages/         (routes)
│   │   ├── components/
│   │   ├── features/      (auth, pages, editor, search, admin)
│   │   ├── lib/
│   │   └── main.tsx
├── docker-compose.yml (mysql, minio, backend, frontend)
└── docker-compose.external.yml (backend, frontend — réutilise un mariadb/minio existants)
```

Chaque module vit directement sous `src/` (pas de dossier `modules/` intermédiaire). À l'intérieur d'un module :

- `services/` — logique métier, orchestre `persistances/` et `mapper/`
- `persistances/` — entités TypeORM (couche persistance)
- `dto/in/` et `dto/out/` — DTO de requête (validés via class-validator) et de réponse (jamais l'entity brute exposée)
- `mapper/` — conversion entity ↔ DTO
- `filters/` — exception filters spécifiques au module
- `exceptions/` — exceptions métier custom
- `<module>.controller.ts` — HTTP uniquement, ne manipule que des DTO
- `<module>.module.ts`

---

## 4. Modèle de données (entités TypeORM)

### User

| Champ        | Type                        | Notes             |
| ------------ | --------------------------- | ----------------- |
| id           | uuid                        | PK                |
| email        | varchar                     | unique            |
| passwordHash | varchar                     |                   |
| displayName  | varchar                     |                   |
| avatarUrl    | varchar nullable            | pointe vers Minio |
| role         | enum(admin, member)         | `admin` a accès à tout ; `member` dépend de ses permissions directes et/ou de groupe (voir `UserPermission`/`PageAccessRule` plus bas). Les anciens rôles `editor`/`reader` ont été retirés (EPIC-30), migrés vers des groupes équivalents. |
| isActive     | boolean, défaut true        | Un compte désactivé ne peut plus se connecter ni rafraîchir sa session |
| failedLoginAttempts | int                  | reset à 0 sur connexion réussie |
| lockedUntil  | datetime nullable           | verrouillage temporaire après échecs répétés |
| passwordChangedAt | datetime nullable      |                   |
| createdAt    | datetime                    |                   |
| updatedAt    | datetime                    |                   |

### Page

| Champ            | Type                  | Notes                                  |
| ---------------- | --------------------- | -------------------------------------- |
| id               | uuid                  | PK                                     |
| slug             | varchar               | unique par branche                     |
| title            | varchar               | dénormalisé depuis la version courante |
| parentId         | uuid nullable         | FK → Page (arborescence)               |
| currentVersionId | uuid nullable         | FK → PageVersion                       |
| visibility       | enum(public, private) | public = visible de tous ; private = admins/détenteurs de `page.read` sur la page (direct ou via groupe) |
| createdById      | uuid                  | FK → User                              |
| createdAt        | datetime              |                                        |
| updatedAt        | datetime              |                                        |

### PageVersion

| Champ         | Type             | Notes                       |
| ------------- | ---------------- | --------------------------- |
| id            | uuid             | PK                          |
| pageId        | uuid             | FK → Page                   |
| content       | text (markdown)  |                             |
| title         | varchar          |                             |
| authorId      | uuid             | FK → User                   |
| changeSummary | varchar nullable | message de commit façon git |
| createdAt     | datetime         | append-only, jamais modifié |

### Attachment

| Champ        | Type          | Notes              |
| ------------ | ------------- | ------------------ |
| id           | uuid          | PK                 |
| pageId       | uuid nullable | FK → Page          |
| minioKey     | varchar       | chemin objet Minio |
| filename     | varchar       |                    |
| mimeType     | varchar       |                    |
| size         | int           | bytes              |
| uploadedById | uuid          | FK → User          |
| createdAt    | datetime      |                    |

### Group / GroupMember / GroupPermission

Modèle de permissions granulaires (EPIC-30, remplace `PagePermission` et l'ancien rôle `editor`).

| Champ (Group)   | Type               | Notes             |
| --------------- | ------------------ | ----------------- |
| id              | uuid                | PK                |
| name            | varchar, unique      |                   |
| description     | varchar nullable     |                   |
| createdAt       | datetime             |                   |
| updatedAt       | datetime             |                   |

`GroupMember` (table de jointure) : PK composite `(groupId, userId)`, `createdAt`.

`GroupPermission` (table de jointure) : PK composite `(groupId, permission)` où `permission` est une `GlobalPermission` (ex. `user.manage`, `tag.create`), `createdAt`.

### UserPermission

| Champ        | Type     | Notes                                       |
| ------------ | -------- | -------------------------------------------- |
| userId        | uuid     | PK composite — FK → User                     |
| permission    | varchar  | PK composite — une `GlobalPermission`        |
| createdAt     | datetime |                                                |

Permissions globales accordées **directement** à un utilisateur, en plus de celles héritées de ses groupes.

### PageAccessRule / PageAccessExclusion

| Champ (PageAccessRule) | Type                    | Notes                                                                 |
| ------------------------ | ----------------------- | ---------------------------------------------------------------------- |
| id                        | uuid                     | PK                                                                      |
| userId                    | uuid nullable            | FK → User — bénéficiaire si la règle cible un utilisateur               |
| groupId                   | uuid nullable            | FK → Group — bénéficiaire si la règle cible un groupe                   |
| pageId                    | uuid nullable            | FK → Page ; `null` = toute la wiki                                      |
| appliesTo                 | enum(page, subtree)      | `page` = cette page seule ; `subtree` = la page et toute sa descendance |
| actions                   | json (`PageAction[]`)    | ex. `page.read`, `page.edit`, `page.manage_tags`, `page.manage_permissions`… |
| grantedById               | uuid                     | FK → User (auteur de l'octroi)                                          |
| createdAt                 | datetime                 |                                                                          |

Exactement un de `userId`/`groupId` est renseigné. `PageAccessExclusion` (PK composite `ruleId` + `pageId`) retire une sous-page précise de la couverture d'une règle `subtree`, sans affecter le reste de l'arbre. Un bénéficiaire ne peut jamais recevoir, via une règle ou une permission de groupe, plus d'actions que celui qui les accorde ne détient lui-même (vérifié à chaque création/modification, voir §5 « Groupes et permissions »).

### AdminAuditLog

| Champ        | Type              | Notes                                                    |
| ------------ | ----------------- | --------------------------------------------------------- |
| id           | uuid              | PK                                                          |
| adminId      | uuid              | FK → User                                                   |
| action       | varchar           | ex. `user.role_changed`, `user.deleted`                     |
| targetType   | varchar           | ex. `User`                                                   |
| targetId     | uuid nullable     |                                                              |
| metadata     | json nullable     | détails de l'action (ex. ancien/nouveau rôle)               |
| createdAt    | datetime          |                                                              |

### SystemSetting

| Champ  | Type    | Notes                                          |
| ------ | ------- | ----------------------------------------------- |
| key    | varchar | PK, ex. `locale`                                |
| value  | varchar | ex. `fr` / `en`                                 |

Table clé/valeur générique pour les réglages globaux (pas par utilisateur). Le premier usage est la langue de l'UI (EPIC-21), extensible à d'autres réglages système futurs.

### Tag / PageTag

| Champ          | Type    | Notes        |
| -------------- | ------- | ------------ |
| Tag.id         | uuid    | PK           |
| Tag.name       | varchar | unique       |
| PageTag.pageId | uuid    | FK composite |
| PageTag.tagId  | uuid    | FK composite |

### McpApiKey

| Champ       | Type              | Notes                                   |
| ----------- | ----------------- | --------------------------------------- |
| id          | uuid              | PK                                      |
| name        | varchar           | libellé de la clé                       |
| keyHash     | varchar           | hash de la clé, jamais stockée en clair |
| scopes      | json              | ex. `["pages:write", "tags:read"]`      |
| createdById | uuid              | FK → User (admin)                       |
| lastUsedAt  | datetime nullable |                                         |
| revokedAt   | datetime nullable |                                         |
| createdAt   | datetime          |                                         |

### McpAuditLog

| Champ        | Type             | Notes                  |
| ------------ | ---------------- | ---------------------- |
| id           | uuid             | PK                     |
| apiKeyId     | uuid             | FK → McpApiKey         |
| toolName     | varchar          | ex. `wiki_create_page` |
| input        | json             | tronqué si volumineux  |
| output       | json             | tronqué si volumineux  |
| success      | boolean          |                        |
| errorMessage | varchar nullable |                        |
| createdAt    | datetime         |                        |

---

## 5. Récapitulatif complet des endpoints API

### Auth

| Méthode | Route          | Auth | Description         |
| ------- | -------------- | ---- | ------------------- |
| POST    | /auth/register | non  | Inscription — rate limit strict + Turnstile requis (EPIC-20) |
| POST    | /auth/login    | non  | Connexion — rate limit strict + Turnstile requis, verrouillage après échecs répétés (EPIC-20) |
| POST    | /auth/refresh  | non  | Rafraîchir le token |

### Users

Toutes les routes `/admin/users` sont accessibles aux administrateurs ou à quiconque détient la permission globale `user.manage` (un admin ne peut ni se rétrograder, ni se désactiver, ni se supprimer lui-même ; le dernier administrateur actif est protégé contre ces trois actions — 409 sinon).

| Méthode | Route                                  | Auth               | Description              |
| ------- | --------------------------------------- | ------------------- | ------------------------ |
| GET     | /users/me                              | oui                 | Profil courant, avec `permissions` (globales) et `groups` |
| PATCH   | /users/me                              | oui                 | Modifier son profil      |
| GET     | /admin/users                           | admin ou `user.manage` | Liste des utilisateurs — filtres `?search=&role=&groupId=&active=`, pagination ; chaque ligne inclut `groups` et `isActive` |
| POST    | /admin/users                           | admin ou `user.manage` | Créer un utilisateur — sans `password`, un mot de passe temporaire est généré et renvoyé une seule fois |
| GET     | /admin/users/:id                       | admin ou `user.manage` | Détail : infos, groupes, permissions directes, dernière connexion, verrouillage |
| PATCH   | /admin/users/:id                       | admin ou `user.manage` | Modifier `displayName`/`email`/`role` (remplace l'ancien `PATCH /:id/role`) |
| PATCH   | /admin/users/:id/status                | admin ou `user.manage` | Activer/désactiver le compte |
| POST    | /admin/users/:id/reset-password        | admin ou `user.manage` | Génère un mot de passe temporaire et invalide les sessions existantes |
| POST    | /admin/users/:id/unlock                | admin ou `user.manage` | Réinitialise les tentatives de connexion échouées et le verrouillage |
| PUT     | /admin/users/:id/groups                | admin ou `user.manage` | Remplacer les groupes de l'utilisateur |
| GET     | /admin/users/:id/effective-permissions | admin ou `user.manage` | Permissions globales + règles d'accès cumulées, avec leur origine (directe ou groupe X) |
| DELETE  | /admin/users/:id                       | admin ou `user.manage` | Supprimer un utilisateur |
| PUT     | /admin/users/:id/permissions           | admin ou `user.manage` | Remplacer les permissions globales directes |
| GET     | /admin/users/:id/access-rules          | admin ou `user.manage` | Règles d'accès directes de l'utilisateur |
| POST    | /admin/users/:id/access-rules          | admin ou `user.manage` | Créer une règle d'accès directe |
| PATCH   | /admin/users/:id/access-rules/:ruleId  | admin ou `user.manage` | Modifier une règle d'accès directe |
| DELETE  | /admin/users/:id/access-rules/:ruleId  | admin ou `user.manage` | Supprimer une règle d'accès directe |

### Pages

| Méthode | Route              | Auth             | Description               |
| ------- | ------------------ | ---------------- | ------------------------- |
| POST    | /pages             | `page.create_root` (racine) ou `page.create_child` (sur le parent) | Créer une page |
| GET     | /pages/tree        | selon visibilité | Arborescence complète     |
| GET     | /pages/*path       | selon visibilité | Lire une page par son chemin complet (slugs des ancêtres, comme dans l'URL) |
| GET     | /pages/:id/stats   | selon visibilité | Stats d'une page (vues, dernière modification, versions, commentaires, contributeurs) — n'incrémente pas les vues |
| PATCH   | /pages/:id         | `page.edit` sur la page | Éditer (nouvelle version) |
| POST    | /pages/:id/merge-preview | `page.edit` sur la page | Prévisualiser une fusion à 3 voies (base/mine/theirs) sans sauvegarder |
| PATCH   | /pages/:id/move    | `page.move` sur la page | Déplacer dans l'arbre     |
| DELETE  | /pages/:id         | `page.delete` sur la page | Supprimer                 |
| PATCH   | /pages/:id/visibility | `page.manage_visibility` sur la page | Changer la visibilité (cascade aux enfants) |

### Groupes et permissions

Modèle de permissions granulaires (EPIC-30) : chaque bénéficiaire (utilisateur ou groupe) peut recevoir des permissions globales (`GlobalPermission`, ex. `user.manage`) et des règles d'accès aux pages (`PageAccessRule` : `pageId` ou toute la wiki, portée `page`/`subtree`, `actions` parmi `PageAction`, exclusions possibles sur des descendants). La logique d'attribution est commune aux trois points d'entrée ci-dessous ; toute mutation ajoute une entrée dans `/admin/audit-log`, et un bénéficiaire ne peut jamais se voir accorder par un tiers plus d'actions que ce tiers ne détient lui-même.

| Méthode | Route                                   | Auth                  | Description                          |
| ------- | ---------------------------------------- | ---------------------- | ------------------------------------- |
| GET     | /admin/groups                           | admin ou `user.manage` | Liste des groupes (membres, règles)  |
| POST    | /admin/groups                           | admin ou `user.manage` | Créer un groupe                       |
| GET     | /admin/groups/:id                       | admin ou `user.manage` | Détail : membres, permissions, règles |
| PATCH   | /admin/groups/:id                       | admin ou `user.manage` | Modifier nom/description              |
| DELETE  | /admin/groups/:id                       | admin ou `user.manage` | Supprimer (cascade)                   |
| PUT     | /admin/groups/:id/members               | admin ou `user.manage` | Remplacer la liste des membres        |
| PUT     | /admin/groups/:id/permissions           | admin ou `user.manage` | Remplacer les permissions globales    |
| GET     | /admin/groups/:id/access-rules          | admin ou `user.manage` | Règles d'accès du groupe              |
| POST    | /admin/groups/:id/access-rules          | admin ou `user.manage` | Créer une règle d'accès               |
| PATCH   | /admin/groups/:id/access-rules/:ruleId  | admin ou `user.manage` | Modifier une règle d'accès            |
| DELETE  | /admin/groups/:id/access-rules/:ruleId  | admin ou `user.manage` | Supprimer une règle d'accès           |
| GET     | /pages/:id/access-rules                 | `page.manage_permissions` sur la page | Règles couvrant la page (directes + héritées, bénéficiaire nommé) |
| POST    | /pages/:id/access-rules                 | `page.manage_permissions` sur la page | Créer une règle pour un utilisateur ou un groupe |
| PATCH   | /pages/:id/access-rules/:ruleId         | `page.manage_permissions` sur la page | Modifier une règle directe (non héritée) |
| DELETE  | /pages/:id/access-rules/:ruleId         | `page.manage_permissions` sur la page | Supprimer une règle directe (non héritée) |

Voir aussi `/pages/*path` et `/pages/tree`, qui exposent respectivement `permissions` (actions effectives sur la page) et `canCreateChild` par nœud.

### Versions

| Méthode | Route                                  | Auth             | Description           |
| ------- | -------------------------------------- | ---------------- | --------------------- |
| GET     | /pages/:id/versions                    | selon visibilité | Historique            |
| GET     | /pages/:id/versions/:versionId         | selon visibilité | Une version           |
| GET     | /pages/:id/versions/diff               | selon visibilité | Diff entre 2 versions |
| POST    | /pages/:id/versions/:versionId/restore | `page.restore_version` sur la page | Rollback |

### Médias

| Méthode | Route          | Auth             | Description                                                           |
| ------- | -------------- | ---------------- | ---------------------------------------------------------------------- |
| POST    | /media/upload  | `media.upload`   | Upload vers Minio                                                     |
| POST    | /media         | selon visibilité | Corps `{ pageId }` : médias d'une page. Corps sans `pageId` : médiathèque globale, filtrable (search/type) et paginée (page/limit), authentifié |
| GET     | /media/:id/url | selon visibilité | URL présignée                                                         |
| DELETE  | /media/:id     | `media.delete`   | Supprimer (409 si le média est encore référencé ailleurs)             |

### Tags

| Méthode | Route                  | Auth     | Description                |
| ------- | ---------------------- | -------- | -------------------------- |
| POST    | /tags                  | `tag.create` | Créer un tag               |
| GET     | /tags                  | non      | Lister les tags            |
| POST    | /pages/:id/tags        | `page.manage_tags` sur la page | Associer un tag à une page |
| DELETE  | /pages/:id/tags/:tagId | `page.manage_tags` sur la page | Retirer un tag d'une page  |
| DELETE  | /tags/:id              | `tag.delete` | Supprimer un tag           |

### Recherche

| Méthode | Route      | Auth             | Description         |
| ------- | ---------- | ---------------- | ------------------- |
| GET     | /search?q= | selon visibilité | Recherche full-text |

### Aperçus de liens

| Méthode | Route             | Auth | Description |
| ------- | ----------------- | ---- | ----------- |
| GET     | /meta/pages/*path | non  | HTML minimal (balises Open Graph/Twitter + composant Discord `discord:component-embed`) d'une page publique, pour les robots d'aperçu ; carte par défaut si la page est privée ou inconnue. Servi aux robots sur `/pages/*` par `frontend/nginx.conf`. N'incrémente pas les vues |

### MCP (pilotage par IA)

| Méthode   | Route                   | Auth                 | Description                                         |
| --------- | ----------------------- | -------------------- | --------------------------------------------------- |
| POST /GET | /mcp                    | clé API MCP (scopes) | Transport MCP (JSON-RPC), expose les tools `wiki_*` |
| POST      | /admin/mcp/api-keys     | admin                | Créer une clé API MCP                               |
| GET       | /admin/mcp/api-keys     | admin                | Lister les clés API MCP                             |
| DELETE    | /admin/mcp/api-keys/:id | admin                | Révoquer une clé                                    |
| GET       | /admin/mcp/audit-log    | admin                | Journal des actions effectuées par les IA           |

### Sécurité

| Méthode | Route              | Auth  | Description                        |
| ------- | ------------------- | ----- | ------------------------------------ |
| GET     | /admin/audit-log    | admin | Journal des actions admin sensibles |

### Réglages système

| Méthode | Route                  | Auth  | Description                          |
| ------- | ------------------------ | ----- | -------------------------------------- |
| GET     | /settings                | non   | Réglages publics (ex. langue de l'UI) |
| PATCH   | /admin/settings/:key     | admin | Modifier un réglage système           |

---

Installation et configuration : voir le [README](../README.md). Exemple de déploiement continu (tunnel Cloudflare, `docker-compose.external.yml`) : [deployment.md](deployment.md).
