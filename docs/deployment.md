# Déploiement — exemple de l'instance de démonstration

Ce document décrit comment l'instance de l'auteur est déployée en continu (tunnel Cloudflare, images GHCR, base et stockage mutualisés). Pour installer NestWiki chez vous, suivez d'abord le [README](../README.md) : ce qui suit n'est qu'un exemple à adapter, pas un prérequis.

## Les deux docker-compose


Deux versions du `docker-compose` sont disponibles :

- **`docker-compose.yml`** — version complète (`mysql`, `minio`, `backend`, `frontend`), pour un serveur vierge qui n'a encore ni base de données ni stockage objet. Usage manuel uniquement (`docker compose up -d --build`), non branché sur le déploiement continu.
- **`docker-compose.external.yml`** — version allégée (`backend`, `frontend` seulement), pour réutiliser un MariaDB/MySQL et un Minio déjà existants sur le serveur (ex. mutualisés avec d'autres apps) plutôt que d'en relancer une paire dédiée. Le backend rejoint les réseaux Docker **externes** où vivent déjà ces conteneurs, nommés par `DATABASE_NETWORK` et `STORAGE_NETWORK` dans le `.env` racine (`mariadb-network` par défaut) ; le frontend reste seul avec le backend sur le réseau `default` du projet (voir [Isolation réseau](#isolation-réseau)). **C'est celle-ci qu'utilise `.github/workflows/deploy.yml`** (`docker compose -f docker-compose.external.yml pull && docker compose -f docker-compose.external.yml up -d`) — pas de `--build` : les images `backend`/`frontend` y sont référencées par leur tag GHCR (`ghcr.io/firedrox/nestwiki-{backend,frontend}:latest`, poussées par `ci.yml` à chaque push sur `main`), le serveur les pull plutôt que de rebuild depuis les sources. Le déploiement continu part donc du principe que le mariadb/minio cible existe déjà sur le serveur ; adapter le workflow si un déploiement doit un jour repartir de la version complète.

`backend`/`frontend` se construisent depuis `backend/Dockerfile`/`frontend/Dockerfile` (contexte = racine du dépôt, pour le workspace pnpm) dans les deux cas — `docker-compose.yml` les build localement, `docker-compose.external.yml` référence les images déjà construites par `ci.yml`. `backend/Dockerfile` exécute `backend/entrypoint.sh` au démarrage du conteneur, directement avec `node` sur le code compilé de `dist/` (l'image ne contient ni pnpm, ni tsx, ni les sources TypeScript) : les migrations (`dist/config/data-source.js`), `dist/database/run-admin-seed.js` (premier admin depuis `ADMIN_*` s'il n'en existe aucun), `dist/database/content-seed.js` (documentation et notes de version générées depuis `CHANGELOG.md`), puis `dist/main.js` lancé en `exec` pour recevoir directement le `SIGTERM` de `docker stop`. Équivalent dans le conteneur de `pnpm run backfill:avatars` : `node --import ./scripts/register-stream-json-case-loader.mjs dist/database/run-avatar-backfill.js`. Le script tourne en `set -e` : si une étape échoue, le conteneur ne démarre pas plutôt que de tourner sur un schéma ou un contenu incohérent. Toutes les étapes sont idempotentes : redémarrer sans changement ne fait rien. Avant même d'ouvrir son port, le backend refuse de démarrer si un secret de `backend/.env` est absent ou par défaut (voir le README).

**Images/médias affichés dans les pages** : `MINIO_ENDPOINT` sert au backend pour parler à Minio en interne (ex. le nom du service Docker, injoignable depuis un navigateur) — si les images n'apparaissent pas côté client, c'est qu'il manque `MINIO_PUBLIC_ENDPOINT` (+ `MINIO_PUBLIC_PORT`/`MINIO_PUBLIC_USE_SSL`) dans `backend/.env`, pointant vers un hôte Minio joignable publiquement (ex. tunnel Cloudflare dédié) : c'est cette valeur, et seulement elle, qui sert à signer les URLs présignées données au navigateur. Sans elle, `getPresignedUrl` retombe sur `MINIO_ENDPOINT`, ce qui casse toute image en prod si celui-ci n'est pas un hôte public.

**Sur le serveur, une seule fois (version complète) :**

```bash
git clone <url-du-dépôt> /chemin/vers/nestwiki
cd /chemin/vers/nestwiki
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
git clone <url-du-dépôt> /chemin/vers/nestwiki
cd /chemin/vers/nestwiki
cp .env.example .env               # BIND_ADDRESS, DATABASE_NETWORK, STORAGE_NETWORK
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
  -e RUSTFS_ADDRESS=":9000" -e RUSTFS_CONSOLE_ENABLE=false \
  -p 127.0.0.1:9000:9000 -v minio-data:/data \
  rustfs/rustfs:latest /data
```

**Serveur déjà en place avec l'ancien Minio** : RustFS tourne en uid 10001, pas root comme Minio — un volume `minio-data` déjà peuplé par l'ancien conteneur a ses fichiers appartenant à root, et RustFS ne les rechown pas au démarrage. Avant de relancer avec la nouvelle image, une seule fois :

```bash
docker compose stop minio
docker run --rm -v <nom-projet>_minio-data:/data alpine chown -R 10001:10001 /data
```

(nom exact du volume via `docker volume ls`). Un volume neuf (nouveau déploiement) n'a pas ce problème.

### Isolation réseau

Une RCE dans un conteneur ne doit pas donner accès aux autres services. Les deux compose publient les ports `3000`/`8080` sur `BIND_ADDRESS` (`127.0.0.1` par défaut : seul un reverse proxy ou un tunnel tournant sur l'hôte les atteint) et laissent le frontend sur le seul réseau `default`, avec le backend : il ne voit ni la base ni le stockage. `docker-compose.yml` met `mysql`/`minio` sur un réseau `backing` partagé uniquement avec le backend, et publie leurs ports (`3306`, `9000`, console `9001` désactivée par défaut) sur `BACKING_BIND_ADDRESS`, `127.0.0.1` par défaut.

Avec `docker-compose.external.yml`, isoler le backend des autres conteneurs du serveur demande des réseaux `--internal` dédiés, partagés uniquement avec la base et le stockage. Exemple de l'instance de l'auteur (sous-réseaux fixes pour pouvoir restreindre l'hôte de l'utilisateur SQL, ex. `'nestwiki'@'172.31.10.%'`) :

```bash
docker network create --internal --subnet 172.31.10.0/24 db-nestwiki
docker network create --internal --subnet 172.31.11.0/24 storage-nestwiki
docker network connect db-nestwiki mariadb
docker network connect storage-nestwiki minio
```

puis dans le `.env` racine : `DATABASE_NETWORK=db-nestwiki` et `STORAGE_NETWORK=storage-nestwiki`. Docker ne publie pas de port sur un réseau `--internal` : le frontend et le backend gardent le réseau `default` (non internal) pour leurs ports publiés et la sortie Internet (webhooks, vérification des mises à jour). Les réseaux doivent exister avant `docker compose up`, sinon compose refuse de démarrer.

### Content-Security-Policy

Le nginx du frontend envoie une `Content-Security-Policy` avec chaque page de l'application : scripts limités au site lui-même et à Cloudflare Turnstile (`script-src 'self' https://challenges.cloudflare.com`), aucun script inline ni URL `javascript:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, plus `X-Content-Type-Options: nosniff`. Images, médias, iframes (aperçus PDF) et connexions restent ouverts à tout hôte, parce que le stockage des médias ou l'API peuvent être servis depuis un autre domaine selon l'installation.

`frame-ancestors` (sites autorisés à afficher le wiki dans une iframe) vient de `CSP_FRAME_ANCESTORS` dans le `.env` racine, `'self'` par défaut. Garder les guillemets doubles autour de la valeur pour conserver les simples : `CSP_FRAME_ANCESTORS="'self' https://addrien.fr https://*.addrien.fr"` pour l'instance de l'auteur. Un proxy placé devant (ex. une règle Cloudflare de transformation des en-têtes de réponse) ne doit pas remplacer cet en-tête : il perdrait toute la politique sauf ce qu'il réécrit.

Le chemin `/api` peut être routé directement vers le backend (c'est le cas de l'instance de l'auteur) : ces réponses JSON ne portent pas cette CSP, ce qui ne change rien puisqu'elles ne sont pas affichées comme des pages.

### IP cliente derrière les proxys

La limitation de débit (connexion, inscription, refresh) et Turnstile identifient le client par l'entrée de `X-Forwarded-For` ajoutée par le dernier proxy avant le backend : un client peut écrire ce qu'il veut au début de l'en-tête, mais pas la fin. `TRUST_PROXY_HOPS` (`backend/.env`, `1` par défaut) donne le nombre de proxys qui ajoutent une entrée : `1` quand le backend est atteint directement par le tunnel Cloudflare (instance de l'auteur, `/api` → `localhost:3000`) ou par le nginx du frontend, `2` si un tunnel ou un autre reverse proxy est placé devant le nginx du frontend. Une valeur trop basse fait partager la même limite à tous les visiteurs (l'IP du proxy) ; une valeur trop haute rend la limite contournable.

Ces trois fichiers `.env` ne sont **jamais commités** (`.gitignore`) : sur un premier `git clone` sans eux, `docker compose up` échoue (variables manquantes) — c'est attendu, pas un bug. Une fois créés à la main comme ci-dessus, tous les déploiements suivants (manuels ou automatiques via CI/CD) fonctionnent.

## CI/CD

Deux branches longues : **`dev`**, branche d'intégration où sont mergées les PR de chaque ticket, et **`main`**, qui ne reçoit que des merges de `dev` (ou un correctif urgent) et qui seule déploie. Un merge `dev` → `main` livre donc d'un coup tout ce qui a été intégré depuis la dernière release.

- `.github/workflows/ci.yml` — sur chaque PR vers `main` ou `dev` et chaque push vers ces deux branches, en parallèle : lint + tests unitaires backend, tests e2e backend, lint + tests frontend, et build des deux images Docker (job `image`, cache de couches `type=gha`). L'image backend est démarrée contre une vraie base MySQL et un stockage objet (smoke test : migrations, seeds, `/api/health`). Sur un push vers `main` ou `dev`, `image` pousse seulement le tag `sha-<commit>` sur GHCR (`ghcr.io/firedrox/nestwiki-{backend,frontend}`) ; une fois tous les tests verts, le job `release` ajoute à ces images testées les tags `latest`, `X.Y.Z` et `X.Y` (lus dans `package.json`, via `docker buildx imagetools create`, sans rebuild), puis publie la release GitHub `vX.Y.Z` (texte = section `## X.Y.Z` de `CHANGELOG.md`, tag posé sur le commit de `main`), marquée « latest » ; les pré-releases des versions arrivées avec ce merge (voir `dev` ci-dessous) deviennent des releases, et celle de `vX.Y.Z` est remplacée. Rien n'est fait si `vX.Y.Z` est déjà une release.
- Sur un push vers `dev`, une fois tous les tests verts, le job `prerelease` ajoute aux images testées les tags `dev` et `X.Y.Z-dev`, puis publie `vX.Y.Z` comme **pré-release** GitHub (même texte tiré de `CHANGELOG.md`). Un nouveau push de la même version (corrections après relecture) déplace la pré-release sur le nouveau commit ; une version déjà publiée en release n'est jamais touchée. Aucun déploiement : pour essayer une pré-release, `docker compose -f docker-compose.external.yml` avec les images `:dev` à la place de `:latest`. Les Dockerfiles retirent le champ `version` des `package.json` avant d'installer les dépendances : le bump de version de chaque ticket ne change donc pas la couche `node_modules`, que le serveur n'a à retélécharger que quand le lockfile change.
- `.github/workflows/deploy.yml` — se déclenche uniquement quand `ci.yml` vient de réussir pour un **push** sur `main` du dépôt `FireDroX/nestwiki` (`workflow_run`). Le filtre `branches` de `workflow_run` ne regarde que le nom de branche : une PR venue d'un fork dont la branche s'appelle `main` y correspondrait aussi, d'où la condition du job sur `event == 'push'`, `head_branch` et `head_repository`. Il installe `cloudflared` à une version fixe dont la somme SHA256 est vérifiée, se connecte en SSH au serveur via le tunnel Cloudflare en vérifiant sa clé d'hôte, se log in à GHCR (jeton passé sur l'entrée standard, jamais sur une ligne de commande), avance le clone du serveur sur le commit testé (`git merge --ff-only <sha>`), puis `docker compose pull && up -d` avec `NESTWIKI_TAG` = version de ce commit : les images déjà construites et taguées `X.Y.Z` par `ci.yml`, jamais de rebuild sur le serveur.
- Les actions tierces de `ci.yml` sont épinglées par SHA de commit (version en commentaire, mises à jour par Dependabot), le workflow n'a par défaut que `contents: read`, et les checkouts ne gardent pas le jeton dans `.git/config` (`persist-credentials: false`).

Le déploiement passe par un tunnel Cloudflare (`cloudflared`) plutôt que d'exposer SSH publiquement, et ce hostname est protégé par une application Cloudflare Access : le runner s'y authentifie avec un service token, faute de pouvoir faire la connexion dans un navigateur. À configurer une fois, côté [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) :

1. **Tunnel** — créer un tunnel `cloudflared` sur le serveur, avec une route publique (Public Hostname) vers `ssh://localhost:22`.
2. **Access** — créer une application Access (type self-hosted) sur ce hostname, un service token (Access → Service Auth), et une règle de l'application en action **Service Auth** qui autorise ce token.
3. **Clé SSH** — générer une paire de clés dédiée au déploiement (`ssh-keygen -t ed25519 -C "nestwiki-deploy"`, sans passphrase) et ajouter la clé **publique** à `~/.ssh/authorized_keys` de l'utilisateur de déploiement sur le serveur.

Puis, secrets du dépôt GitHub (Settings → Secrets and variables → Actions) :

| Secret | Contenu |
| --- | --- |
| `CF_ACCESS_CLIENT_ID` | Client ID du service token Access (étape 2) |
| `CF_ACCESS_CLIENT_SECRET` | Client Secret du service token Access (étape 2) |
| `DEPLOY_SSH_PRIVATE_KEY` | Clé **privée** générée à l'étape 3 |
| `DEPLOY_SSH_HOSTNAME` | Hostname public du tunnel (étape 1) |
| `DEPLOY_SSH_HOST_KEY` | Clé d'hôte **publique** du serveur, contenu de `/etc/ssh/ssh_host_ed25519_key.pub` (ex. `ssh-ed25519 AAAA… root@serveur`). Le déploiement refuse de se connecter si le serveur présente une autre clé, et échoue si ce secret manque |
| `DEPLOY_SSH_USER` | Utilisateur SSH sur le serveur |
| `DEPLOY_PATH` | Chemin absolu du clone git sur le serveur (ex. `/opt/nestwiki`) |

`deploy.yml` passe les deux secrets Access à `cloudflared access ssh` (le `ProxyCommand` SSH) par les variables `TUNNEL_SERVICE_TOKEN_ID`/`TUNNEL_SERVICE_TOKEN_SECRET` du job `deploy`. Sans application Access devant le hostname, ces deux secrets peuvent rester vides.

`deploy.yml` ne configure ni ne modifie la protection de branche `main` (statut check requis pour bloquer un merge sur test cassé) — c'est un réglage du dépôt GitHub (Settings → Branches), pas quelque chose qu'un fichier de workflow puisse exprimer.
