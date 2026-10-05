# Déploiement — exemple de l'instance de démonstration

Ce document décrit comment l'instance de l'auteur est déployée en continu (tunnel Cloudflare, images GHCR, base et stockage mutualisés). Pour installer NestWiki chez vous, suivez d'abord le [README](../README.md) : ce qui suit n'est qu'un exemple à adapter, pas un prérequis.

## Les deux docker-compose


Deux versions du `docker-compose` sont disponibles :

- **`docker-compose.yml`** — version complète (`mysql`, `minio`, `backend`, `frontend`), pour un serveur vierge qui n'a encore ni base de données ni stockage objet. Usage manuel uniquement (`docker compose up -d --build`), non branché sur le déploiement continu.
- **`docker-compose.external.yml`** — version allégée (`backend`, `frontend` seulement), pour réutiliser un MariaDB/MySQL et un Minio déjà existants sur le serveur (ex. mutualisés avec d'autres apps) plutôt que d'en relancer une paire dédiée. Rejoint le réseau Docker **externe** `mariadb-network` où vivent déjà ces conteneurs, au lieu d'en créer un nouveau — adaptez le nom du réseau dans le fichier si le vôtre s'appelle différemment. **C'est celle-ci qu'utilise `.github/workflows/deploy.yml`** (`docker compose -f docker-compose.external.yml pull && docker compose -f docker-compose.external.yml up -d`) — pas de `--build` : les images `backend`/`frontend` y sont référencées par leur tag GHCR (`ghcr.io/firedrox/nestwiki-{backend,frontend}:latest`, poussées par `ci.yml` à chaque push sur `main`), le serveur les pull plutôt que de rebuild depuis les sources. Le déploiement continu part donc du principe que le mariadb/minio cible existe déjà sur le serveur ; adapter le workflow si un déploiement doit un jour repartir de la version complète.

`backend`/`frontend` se construisent depuis `backend/Dockerfile`/`frontend/Dockerfile` (contexte = racine du dépôt, pour le workspace pnpm) dans les deux cas — `docker-compose.yml` les build localement, `docker-compose.external.yml` référence les images déjà construites par `ci.yml`. `backend/Dockerfile` exécute `backend/entrypoint.sh` au démarrage du conteneur : `pnpm run migration:run`, `pnpm run seed:admin` (premier admin depuis `ADMIN_*` s'il n'en existe aucun), `pnpm run seed:content` (documentation et notes de version générées depuis `CHANGELOG.md`), puis `node dist/main.js`. Le script tourne en `set -e` : si une étape échoue, le conteneur ne démarre pas plutôt que de tourner sur un schéma ou un contenu incohérent. Toutes les étapes sont idempotentes : redémarrer sans changement ne fait rien. Avant même d'ouvrir son port, le backend refuse de démarrer si un secret de `backend/.env` est absent ou par défaut (voir le README).

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

## CI/CD

- `.github/workflows/ci.yml` — lint + tests (backend + frontend) sur chaque PR vers `main` ; sur chaque push vers `main` en plus, le job `build-and-push-images` build les deux images Docker et les pousse sur GHCR (`ghcr.io/firedrox/nestwiki-{backend,frontend}`) avec les tags `X.Y.Z` et `X.Y` (lus dans `package.json`), `latest` et `sha-<commit>`, puis crée le tag git `vX.Y.Z` et la release GitHub correspondante (texte = section `## X.Y.Z` de `CHANGELOG.md`) si elle n'existe pas encore.
- `.github/workflows/deploy.yml` — se déclenche uniquement quand `ci.yml` vient de réussir sur `main` (`workflow_run`, jamais sur une PR), et seulement sur le dépôt `FireDroX/nestwiki` (jamais sur un fork) : se connecte en SSH au serveur via un tunnel Cloudflare, se log in à GHCR, puis `git pull && docker compose pull && docker compose up -d` — pull les images déjà construites par `ci.yml`, jamais de rebuild sur le serveur.

Le déploiement passe par un tunnel Cloudflare (`cloudflared`) plutôt que d'exposer SSH publiquement — sans application Access devant (pas de service token à gérer). À configurer une fois, côté [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) :

1. **Tunnel** — créer un tunnel `cloudflared` sur le serveur, avec une route publique (Public Hostname) vers `ssh://localhost:22`.
2. **Clé SSH** — générer une paire de clés dédiée au déploiement (`ssh-keygen -t ed25519 -C "nestwiki-deploy"`, sans passphrase) et ajouter la clé **publique** à `~/.ssh/authorized_keys` de l'utilisateur de déploiement sur le serveur.

Puis, secrets du dépôt GitHub (Settings → Secrets and variables → Actions) :

| Secret | Contenu |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | Clé **privée** générée à l'étape 2 |
| `DEPLOY_SSH_HOSTNAME` | Hostname public du tunnel (étape 1) |
| `DEPLOY_SSH_USER` | Utilisateur SSH sur le serveur |
| `DEPLOY_PATH` | Chemin absolu du clone git sur le serveur (ex. `/opt/nestwiki`) |

Si une application Access protège un jour ce hostname (service token), `deploy.yml` sait déjà où l'ajouter : `TUNNEL_SERVICE_TOKEN_ID`/`TUNNEL_SERVICE_TOKEN_SECRET` en env du job `deploy`, lus automatiquement par `cloudflared access ssh`.

`deploy.yml` ne configure ni ne modifie la protection de branche `main` (statut check requis pour bloquer un merge sur test cassé) — c'est un réglage du dépôt GitHub (Settings → Branches), pas quelque chose qu'un fichier de workflow puisse exprimer.
