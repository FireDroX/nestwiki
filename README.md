# OpenWiki — Documentation technique

Clone de WikiJS — NestJS / TypeORM / MySQL / React / TypeScript / Tailwind / shadcn / Minio

---

## 1. Présentation du projet

**OpenWiki** est une plateforme de wiki collaboratif auto-hébergée. Les utilisateurs créent des pages organisées en arborescence, chaque édition est versionnée, les médias sont stockés sur Minio.

### Objectifs fonctionnels

- Créer, éditer, organiser des pages en arborescence (dossiers/sous-pages)
- Versionner chaque modification (historique + rollback)
- Uploader et insérer des médias (images, fichiers) dans les pages
- Rechercher du contenu (full-text)
- Gérer des utilisateurs et des permissions (admin / éditeur / lecteur)

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
openwiki/
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
| role         | enum(admin, editor, reader) |                   |
| failedLoginAttempts | int                  | reset à 0 sur connexion réussie |
| lockedUntil  | datetime nullable           | verrouillage temporaire après échecs répétés |
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
| visibility       | enum(public, private) | public = visible de tous ; private = éditeurs+/permissions explicites |
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

### PagePermission

| Champ        | Type     | Notes                                                             |
| ------------ | -------- | ------------------------------------------------------------------ |
| id           | uuid     | PK                                                                  |
| pageId       | uuid     | FK → Page                                                           |
| userId       | uuid     | FK → User                                                           |
| grantedById  | uuid     | FK → User (admin ayant accordé le droit)                           |
| createdAt    | datetime |                                                                      |

Unique sur `(pageId, userId)`. Accorde des droits d'éditeur sur la page **et toute sa sous-arborescence**, sauf override explicite plus bas dans l'arbre — voir EPIC-19. Ne remplace jamais `User.role` : élève seulement un `reader` global en éditeur localement.

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

| Méthode | Route                                  | Auth               | Description              |
| ------- | --------------------------------------- | ------------------- | ------------------------ |
| GET     | /users/me                              | oui                 | Profil courant, avec `permissions` (globales) et `groups` |
| PATCH   | /users/me                              | oui                 | Modifier son profil      |
| GET     | /admin/users                           | admin               | Liste des utilisateurs   |
| PATCH   | /admin/users/:id/role                  | admin               | Changer un rôle          |
| DELETE  | /admin/users/:id                       | admin               | Supprimer un utilisateur |
| PUT     | /admin/users/:id/permissions           | admin ou `user.manage` | Remplacer les permissions globales directes |
| GET     | /admin/users/:id/access-rules          | admin ou `user.manage` | Règles d'accès directes de l'utilisateur |
| POST    | /admin/users/:id/access-rules          | admin ou `user.manage` | Créer une règle d'accès directe |
| PATCH   | /admin/users/:id/access-rules/:ruleId  | admin ou `user.manage` | Modifier une règle d'accès directe |
| DELETE  | /admin/users/:id/access-rules/:ruleId  | admin ou `user.manage` | Supprimer une règle d'accès directe |

### Pages

| Méthode | Route              | Auth             | Description               |
| ------- | ------------------ | ---------------- | ------------------------- |
| POST    | /pages             | éditeur+         | Créer une page            |
| GET     | /pages/tree        | selon visibilité | Arborescence complète     |
| GET     | /pages/:slug       | selon visibilité | Lire une page             |
| PATCH   | /pages/:id         | éditeur+         | Éditer (nouvelle version) |
| POST    | /pages/:id/merge-preview | éditeur+   | Prévisualiser une fusion à 3 voies (base/mine/theirs) sans sauvegarder |
| PATCH   | /pages/:id/move    | éditeur+         | Déplacer dans l'arbre     |
| DELETE  | /pages/:id         | éditeur+         | Supprimer                 |
| PATCH   | /pages/:id/visibility | éditeur+      | Changer la visibilité (cascade aux enfants) |

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

Voir aussi `/pages/:slug` et `/pages/tree`, qui exposent respectivement `permissions` (actions effectives sur la page) et `canCreateChild` par nœud.

### Versions

| Méthode | Route                                  | Auth             | Description           |
| ------- | -------------------------------------- | ---------------- | --------------------- |
| GET     | /pages/:id/versions                    | selon visibilité | Historique            |
| GET     | /pages/:id/versions/:versionId         | selon visibilité | Une version           |
| GET     | /pages/:id/versions/diff               | selon visibilité | Diff entre 2 versions |
| POST    | /pages/:id/versions/:versionId/restore | éditeur+         | Rollback              |

### Médias

| Méthode | Route          | Auth             | Description                                                           |
| ------- | -------------- | ---------------- | ---------------------------------------------------------------------- |
| POST    | /media/upload  | éditeur+         | Upload vers Minio                                                     |
| POST    | /media         | selon visibilité | Corps `{ pageId }` : médias d'une page. Corps sans `pageId` : médiathèque globale, filtrable (search/type) et paginée (page/limit), authentifié |
| GET     | /media/:id/url | selon visibilité | URL présignée                                                         |
| DELETE  | /media/:id     | éditeur+         | Supprimer (409 si le média est encore référencé ailleurs)             |

### Tags

| Méthode | Route                  | Auth     | Description                |
| ------- | ---------------------- | -------- | -------------------------- |
| POST    | /tags                  | éditeur+ | Créer un tag               |
| GET     | /tags                  | non      | Lister les tags            |
| POST    | /pages/:id/tags        | éditeur+ | Associer un tag à une page |
| DELETE  | /pages/:id/tags/:tagId | éditeur+ | Retirer un tag d'une page  |
| DELETE  | /tags/:id              | admin    | Supprimer un tag           |

### Recherche

| Méthode | Route      | Auth             | Description         |
| ------- | ---------- | ---------------- | ------------------- |
| GET     | /search?q= | selon visibilité | Recherche full-text |

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

## 6. Installation

### Prérequis

- Node.js 22+, [pnpm](https://pnpm.io/) (version pinnée dans `packageManager`, `package.json` racine)
- Docker + Docker Compose

### Installation locale (développement)

```bash
git clone <url-du-dépôt>
cd wiki

# MySQL + Minio
docker compose up -d

# Copier les 3 fichiers .env.example -> .env et renseigner les valeurs
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

pnpm install

cd backend
pnpm run migration:run    # crée le schéma
pnpm run seed:dev         # utilisateur admin de dev
pnpm run seed:content     # arborescence de doc/notes de version/FAQ
cd ..

pnpm run back:dev   # terminal 1 — backend sur :3000
pnpm run front:dev  # terminal 2 — frontend sur :5173
```

### Déploiement en production

Deux versions du `docker-compose` sont disponibles :

- **`docker-compose.yml`** — version complète (`mysql`, `minio`, `backend`, `frontend`), pour un serveur vierge qui n'a encore ni base de données ni stockage objet. Usage manuel uniquement (`docker compose up -d --build`), non branché sur le déploiement continu.
- **`docker-compose.external.yml`** — version allégée (`backend`, `frontend` seulement), pour réutiliser un MariaDB/MySQL et un Minio déjà existants sur le serveur (ex. mutualisés avec d'autres apps) plutôt que d'en relancer une paire dédiée. Rejoint le réseau Docker **externe** `mariadb-network` où vivent déjà ces conteneurs, au lieu d'en créer un nouveau — adaptez le nom du réseau dans le fichier si le vôtre s'appelle différemment. **C'est celle-ci qu'utilise `.github/workflows/deploy.yml`** (`docker compose -f docker-compose.external.yml pull && docker compose -f docker-compose.external.yml up -d`) — pas de `--build` : les images `backend`/`frontend` y sont référencées par leur tag GHCR (`ghcr.io/firedrox/openwiki-{backend,frontend}:latest`, poussées par `ci.yml` à chaque push sur `main`), le serveur les pull plutôt que de rebuild depuis les sources. Le déploiement continu part donc du principe que le mariadb/minio cible existe déjà sur le serveur ; adapter le workflow si un déploiement doit un jour repartir de la version complète.

`backend`/`frontend` se construisent depuis `backend/Dockerfile`/`frontend/Dockerfile` (contexte = racine du dépôt, pour le workspace pnpm) dans les deux cas — `docker-compose.yml` les build localement, `docker-compose.external.yml` référence les images déjà construites par `ci.yml`. `backend/Dockerfile` exécute `backend/entrypoint.sh` au démarrage du conteneur : `pnpm run migration:run` puis `pnpm run seed:content` puis `node dist/main.js` — si une migration échoue, le conteneur ne démarre pas (`set -e`), plutôt que de tourner sur un schéma incohérent. Le seed de contenu, lui, échoue sans bloquer le démarrage (`|| echo ...`, pas de `set -e` dessus) — utile sur le tout premier déploiement, où aucun utilisateur n'existe encore pour lui servir d'auteur ; il repasse au déploiement suivant, une fois le premier admin créé. Les deux sont idempotents : redémarrer sans changement ne fait rien.

**Images/médias affichés dans les pages** : `MINIO_ENDPOINT` sert au backend pour parler à Minio en interne (ex. le nom du service Docker, injoignable depuis un navigateur) — si les images n'apparaissent pas côté client, c'est qu'il manque `MINIO_PUBLIC_ENDPOINT` (+ `MINIO_PUBLIC_PORT`/`MINIO_PUBLIC_USE_SSL`) dans `backend/.env`, pointant vers un hôte Minio joignable publiquement (ex. tunnel Cloudflare dédié) : c'est cette valeur, et seulement elle, qui sert à signer les URLs présignées données au navigateur. Sans elle, `getPresignedUrl` retombe sur `MINIO_ENDPOINT`, ce qui casse toute image en prod si celui-ci n'est pas un hôte public.

**Sur le serveur, une seule fois (version complète) :**

```bash
git clone <url-du-dépôt> /chemin/vers/openwiki
cd /chemin/vers/openwiki
cp .env.example .env               # MYSQL_*, MINIO_*, VITE_*
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# éditer les 3 .env — en particulier backend/.env : DB_HOST=mysql et
# MINIO_ENDPOINT=minio (les noms des services docker-compose, pas
# localhost comme en dev local)
docker compose up -d --build
```

**Version allégée (mariadb/minio déjà existants) :**

```bash
git clone <url-du-dépôt> /chemin/vers/openwiki
cd /chemin/vers/openwiki
cp .env.example .env               # seul VITE_* est lu par cette version
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# backend/.env : DB_HOST/MINIO_ENDPOINT doivent pointer vers les noms de
# conteneur réels de vos mariadb/minio existants (pas mysql/minio, ni
# localhost) ; DB_USERNAME/DB_PASSWORD/DB_DATABASE et MINIO_ACCESS_KEY/
# MINIO_SECRET_KEY/MINIO_BUCKET doivent correspondre à des identifiants
# déjà valides sur ces instances (ce fichier n'y crée rien pour vous)
docker compose -f docker-compose.external.yml pull
docker compose -f docker-compose.external.yml up -d
```

Si le stockage objet (S3-compatible) n'existe pas encore et que vous voulez le lancer à part (sans compose), une seule fois sur le serveur — image RustFS, pas Minio : l'édition Community de Minio (serveur) a été archivée en 2026 et n'est plus distribuée nulle part (voir `docker-compose.yml`) :

```bash
docker run -d --name minio --network mariadb-network --restart unless-stopped \
  -e RUSTFS_ACCESS_KEY=<clé-accès> -e RUSTFS_SECRET_KEY=<clé-secrète> \
  -e RUSTFS_ADDRESS=":9000" -e RUSTFS_CONSOLE_ADDRESS=":9001" -e RUSTFS_CONSOLE_ENABLE=true \
  -p 9000:9000 -p 9001:9001 -v minio-data:/data \
  rustfs/rustfs:latest /data
```

**Serveur déjà en place avec l'ancien Minio** : RustFS tourne en uid 10001, pas root comme Minio — un volume `minio-data` déjà peuplé par l'ancien conteneur a ses fichiers appartenant à root, et RustFS ne les rechown pas au démarrage. Avant de relancer avec la nouvelle image, une seule fois :

```bash
docker compose stop minio
docker run --rm -v <nom-projet>_minio-data:/data alpine chown -R 10001:10001 /data
```

(nom exact du volume via `docker volume ls`). Un volume neuf (nouveau déploiement) n'a pas ce problème.

Ces trois fichiers `.env` ne sont **jamais commités** (`.gitignore`) : sur un premier `git clone` sans eux, `docker compose up` échoue (variables manquantes) — c'est attendu, pas un bug. Une fois créés à la main comme ci-dessus, tous les déploiements suivants (manuels ou automatiques via CI/CD) fonctionnent.

### CI/CD

- `.github/workflows/ci.yml` — lint + tests (backend + frontend) sur chaque PR vers `main` ; sur chaque push vers `main` en plus, le job `build-and-push-images` build les deux images Docker et les pousse sur GHCR (`ghcr.io/firedrox/openwiki-{backend,frontend}`, tags `latest` + `sha-<commit>`). Voir la Note de version 0.17.4 pour le détail des jobs.
- `.github/workflows/deploy.yml` — se déclenche uniquement quand `ci.yml` vient de réussir sur `main` (`workflow_run`, jamais sur une PR) : se connecte en SSH au serveur via un tunnel Cloudflare, se log in à GHCR, puis `git pull && docker compose pull && docker compose up -d` — pull les images déjà construites par `ci.yml`, jamais de rebuild sur le serveur.

Le déploiement passe par un tunnel Cloudflare (`cloudflared`) plutôt que d'exposer SSH publiquement — sans application Access devant (pas de service token à gérer). À configurer une fois, côté [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) :

1. **Tunnel** — créer un tunnel `cloudflared` sur le serveur, avec une route publique (Public Hostname) vers `ssh://localhost:22`.
2. **Clé SSH** — générer une paire de clés dédiée au déploiement (`ssh-keygen -t ed25519 -C "openwiki-deploy"`, sans passphrase) et ajouter la clé **publique** à `~/.ssh/authorized_keys` de l'utilisateur de déploiement sur le serveur.

Puis, secrets du dépôt GitHub (Settings → Secrets and variables → Actions) :

| Secret | Contenu |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | Clé **privée** générée à l'étape 2 |
| `DEPLOY_SSH_HOSTNAME` | Hostname public du tunnel (étape 1) |
| `DEPLOY_SSH_USER` | Utilisateur SSH sur le serveur |
| `DEPLOY_PATH` | Chemin absolu du clone git sur le serveur (ex. `/opt/openwiki`) |

Si une application Access protège un jour ce hostname (service token), `deploy.yml` sait déjà où l'ajouter : `TUNNEL_SERVICE_TOKEN_ID`/`TUNNEL_SERVICE_TOKEN_SECRET` en env du job `deploy`, lus automatiquement par `cloudflared access ssh`.

`deploy.yml` ne configure ni ne modifie la protection de branche `main` (statut check requis pour bloquer un merge sur test cassé) — c'est un réglage du dépôt GitHub (Settings → Branches), pas quelque chose qu'un fichier de workflow puisse exprimer.
