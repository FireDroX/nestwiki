import 'dotenv/config';
import { DataSource, IsNull } from 'typeorm';
import { Page } from '../pages/entities/page.entity.js';
import { PageVersion } from '../pages/entities/page-version.entity.js';
import { PageTag } from '../tags/entities/page-tag.entity.js';
import { Tag } from '../tags/entities/tag.entity.js';
import { User } from '../users/entities/user.entity.js';

interface PageSeed {
  slug: string;
  title: string;
  content?: string;
  tags?: string[];
  children?: PageSeed[];
}

interface TagSeed {
  name: string;
  color: string;
}

const TAG_SEED: TagSeed[] = [
  { name: 'documentation', color: '#3b82f6' },
  { name: 'guide', color: '#6366f1' },
  { name: 'installation', color: '#22c55e' },
  { name: 'configuration', color: '#f59e0b' },
  { name: 'api', color: '#a855f7' },
  { name: 'changelog', color: '#14b8a6' },
  { name: 'mcp', color: '#ec4899' },
];

const PAGE_TREE_SEED: PageSeed[] = [
  {
    slug: 'documentation',
    title: 'Documentation',
    content: `<style>
.doc-hero {
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 2);
  background: var(--card);
  padding: 1.75rem 2rem;
  margin: 1rem 0 1.75rem;
}
.doc-hero h1 {
  margin: 0 0 0.5rem;
  font-size: 1.6rem;
}
.doc-hero p {
  margin: 0;
  color: var(--muted-foreground);
}
.doc-link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin: 1.25rem 0;
}
.doc-link-card {
  display: block;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.9rem 1rem;
  text-decoration: none;
  color: var(--foreground);
  background: var(--background);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.doc-link-card:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}
.doc-link-card strong {
  display: block;
  color: var(--primary);
  margin-bottom: 0.2rem;
}
.doc-link-card span {
  font-size: 0.85rem;
  color: var(--muted-foreground);
}
</style>

<div class="doc-hero">
  <h1>Documentation OpenWiki</h1>
  <p>Tout ce qu'il faut pour installer, configurer, déployer et utiliser OpenWiki — utilisez l'arborescence à gauche pour naviguer, ou les raccourcis ci-dessous.</p>
</div>

<div class="doc-link-grid">
  <a class="doc-link-card" href="/pages/documentation/guide-demarrage">
    <strong>Guide de démarrage</strong>
    <span>Installer, configurer et lancer OpenWiki en local</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/guide-demarrage/deploiement">
    <strong>Déploiement</strong>
    <span>Mise en production avec Docker Compose et CI/CD</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/endpoints">
    <strong>Endpoints</strong>
    <span>Référence complète de l'API REST</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/mcp">
    <strong>Intégration MCP</strong>
    <span>Piloter le wiki depuis un assistant IA</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/marquages-disponibles">
    <strong>Marquages disponibles</strong>
    <span>Markdown, HTML/CSS et LaTeX dans le contenu d'une page</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/notes-de-version">
    <strong>Notes de version</strong>
    <span>Historique de tous les changements</span>
  </a>
</div>`,
    tags: ['documentation'],
    children: [
      {
        slug: 'guide-demarrage',
        title: 'Guide de démarrage',
        tags: ['guide', 'documentation'],
        content: `<style>
.step-grid {
  display: grid;
  gap: 0.9rem;
  margin: 1.25rem 0;
}
.step-card {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  padding: 1rem 1.25rem;
}
.step-number {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.step-card h3 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.step-card p {
  margin: 0;
  color: var(--muted-foreground);
}
</style>

# Guide de démarrage

Ce guide couvre l'installation locale, la configuration, et le déploiement en production d'OpenWiki, de bout en bout.

## Vue d'ensemble

OpenWiki est un monorepo pnpm avec deux packages : \`backend/\` (NestJS + TypeORM + MySQL) et \`frontend/\` (React + Vite). Les pages [Installation](/pages/documentation/guide-demarrage/installation), [Configuration](/pages/documentation/guide-demarrage/configuration) et [Déploiement](/pages/documentation/guide-demarrage/deploiement) détaillent chaque étape ; ce qui suit résume le parcours local complet.

## Étapes

<div class="step-grid">

<div class="step-card">
<div class="step-number">1</div>
<div>
<h3>Installation</h3>
<p>Cloner le dépôt, installer les dépendances, démarrer MySQL et Minio via Docker. Voir <a href="/pages/documentation/guide-demarrage/installation">Installation</a>.</p>
</div>
</div>

<div class="step-card">
<div class="step-number">2</div>
<div>
<h3>Configuration</h3>
<p>Copier et renseigner les trois fichiers <code>.env</code> (racine, <code>backend/</code>, <code>frontend/</code>). Voir <a href="/pages/documentation/guide-demarrage/configuration">Configuration</a>.</p>
</div>
</div>

<div class="step-card">
<div class="step-number">3</div>
<div>
<h3>Migrations</h3>
<p>Appliquer le schéma de base de données avec <code>cd backend && pnpm run migration:run</code>.</p>
</div>
</div>

<div class="step-card">
<div class="step-number">4</div>
<div>
<h3>Compte de test</h3>
<p>Optionnel, développement uniquement : <code>pnpm run seed:dev</code>.</p>
</div>
</div>

<div class="step-card">
<div class="step-number">5</div>
<div>
<h3>Démarrage</h3>
<p>Deux terminaux depuis la racine du dépôt : <code>pnpm run back:dev</code> (backend sur :3000) et <code>pnpm run front:dev</code> (frontend sur :5173).</p>
</div>
</div>

<div class="step-card">
<div class="step-number">6</div>
<div>
<h3>Connexion</h3>
<p>Ouvrir <a href="http://localhost:5173">http://localhost:5173</a> et se connecter avec le compte créé à l'étape 4, ou s'inscrire via la page d'inscription.</p>
</div>
</div>

</div>

## Étapes suivantes

- Créez votre première page depuis le bouton "Nouvelle page" de la barre latérale.
- Consultez [Marquages disponibles](/pages/documentation/marquages-disponibles) pour écrire du Markdown, du HTML/CSS ou des formules LaTeX dans vos pages.
- Consultez la page [Endpoints](/pages/documentation/endpoints) pour la référence complète de l'API.
- Pour mettre OpenWiki en production, voir [Déploiement](/pages/documentation/guide-demarrage/deploiement).`,
        children: [
          {
            slug: 'installation',
            title: 'Installation',
            tags: ['installation'],
            content: `<style>
.callout {
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: var(--radius);
  background: var(--card);
  padding: 0.9rem 1.1rem;
  margin: 1.1rem 0;
}
.callout-icon {
  font-size: 1.1rem;
  line-height: 1.4;
}
.callout strong {
  color: var(--primary);
}
</style>

# Installation

## Prérequis

- Node.js 22+, [pnpm](https://pnpm.io/) (version pinnée dans le champ \`packageManager\` de \`package.json\`)
- Docker + Docker Compose (pour MySQL et Minio)

<div class="callout">
  <span class="callout-icon">💡</span>
  <span><strong>Astuce.</strong> Les trois fichiers <code>.env</code> ne sont jamais commités — copiez chaque <code>.env.example</code> et renseignez les valeurs avant de lancer <code>docker compose</code>, sinon le démarrage échoue faute de variables.</span>
</div>

## Installation locale (développement)

\`\`\`bash
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
\`\`\`

Passez à la page [Configuration](/pages/documentation/guide-demarrage/configuration) pour le détail des trois fichiers \`.env\`, ou à [Déploiement](/pages/documentation/guide-demarrage/deploiement) pour la mise en production.

![Aperçu du tableau de bord](https://placehold.co/480x240?text=Dashboard)`,
          },
          {
            slug: 'configuration',
            title: 'Configuration',
            tags: ['configuration'],
            content: `<style>
.config-table th {
  color: var(--primary);
  text-align: left;
}
.config-table code {
  background: var(--muted);
  padding: 0.1rem 0.35rem;
  border-radius: calc(var(--radius) * 0.5);
}
</style>

# Configuration

La configuration se fait via trois fichiers \`.env\` distincts, chacun avec un \`.env.example\` à copier :

<table class="config-table">
<thead><tr><th>Fichier</th><th>Rôle</th></tr></thead>
<tbody>
<tr><td><code>.env</code> (racine)</td><td>Identifiants MySQL/Minio pour <code>docker-compose.yml</code></td></tr>
<tr><td><code>backend/.env</code></td><td>Port, URL du frontend (CORS), connexion DB, connexion Minio</td></tr>
<tr><td><code>frontend/.env</code></td><td><code>VITE_API_URL</code>, URL de base de l'API backend (préfixe <code>/api</code> inclus)</td></tr>
</tbody>
</table>

Une fois les trois fichiers renseignés, démarrez les serveurs de développement :

\`\`\`bash
pnpm run back:dev   # backend sur http://localhost:3000
pnpm run front:dev  # frontend sur http://localhost:5173
\`\`\``,
          },
          {
            slug: 'deploiement',
            title: 'Déploiement',
            tags: ['installation', 'configuration'],
            content: `<style>
.callout {
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: var(--radius);
  background: var(--card);
  padding: 0.9rem 1.1rem;
  margin: 1.1rem 0;
}
.callout.callout-warning {
  border-left-color: var(--destructive);
}
.callout-icon {
  font-size: 1.1rem;
  line-height: 1.4;
}
.callout strong {
  color: var(--primary);
}
.callout-warning strong {
  color: var(--destructive);
}
</style>

# Déploiement

## Docker Compose en production

Deux versions du \`docker-compose\` sont disponibles :

- **\`docker-compose.yml\`** — version complète (\`mysql\`, \`minio\`, \`backend\`, \`frontend\`), pour un serveur vierge qui n'a encore ni base de données ni stockage objet. Usage manuel uniquement (\`docker compose up -d --build\`), non branché sur le déploiement continu.
- **\`docker-compose.external.yml\`** — version allégée (\`backend\`, \`frontend\` seulement), pour réutiliser un MariaDB/MySQL et un Minio déjà existants sur le serveur (ex. mutualisés avec d'autres apps) plutôt que d'en relancer une paire dédiée. Rejoint le réseau Docker **externe** \`mariadb-network\` où vivent déjà ces conteneurs, au lieu d'en créer un nouveau — adaptez le nom du réseau dans le fichier si le vôtre s'appelle différemment. **C'est celle-ci qu'utilise \`.github/workflows/deploy.yml\`** (\`docker compose -f docker-compose.external.yml up -d --build\`) — le déploiement continu part donc du principe que le mariadb/minio cible existe déjà sur le serveur ; adapter le workflow si un déploiement doit un jour repartir de la version complète.

\`backend\`/\`frontend\` se construisent depuis \`backend/Dockerfile\`/\`frontend/Dockerfile\` (contexte = racine du dépôt, pour le workspace pnpm) dans les deux cas. \`backend/Dockerfile\` exécute \`backend/entrypoint.sh\` au démarrage du conteneur : \`pnpm run migration:run\` puis \`pnpm run seed:content\` puis \`node dist/main.js\` — si une migration échoue, le conteneur ne démarre pas (\`set -e\`), plutôt que de tourner sur un schéma incohérent. Le seed de contenu, lui, échoue sans bloquer le démarrage (\`|| echo ...\`, pas de \`set -e\` dessus) — utile sur le tout premier déploiement, où aucun utilisateur n'existe encore pour lui servir d'auteur ; il repasse au déploiement suivant, une fois le premier admin créé. Les deux sont idempotents : redémarrer sans changement ne fait rien.

<div class="callout callout-warning">
  <span class="callout-icon">⚠️</span>
  <span><strong>Images/médias affichés dans les pages.</strong> <code>MINIO_ENDPOINT</code> sert au backend pour parler à Minio en interne (ex. le nom du service Docker, injoignable depuis un navigateur) — si les images n'apparaissent pas côté client, c'est qu'il manque <code>MINIO_PUBLIC_ENDPOINT</code> (+ <code>MINIO_PUBLIC_PORT</code>/<code>MINIO_PUBLIC_USE_SSL</code>) dans <code>backend/.env</code>, pointant vers un hôte Minio joignable publiquement (ex. tunnel Cloudflare dédié) : c'est cette valeur, et seulement elle, qui sert à signer les URLs présignées données au navigateur. Sans elle, <code>getPresignedUrl</code> retombe sur <code>MINIO_ENDPOINT</code>, ce qui casse toute image en prod si celui-ci n'est pas un hôte public.</span>
</div>

**Sur le serveur, une seule fois (version complète) :**

\`\`\`bash
git clone <url-du-dépôt> /chemin/vers/openwiki
cd /chemin/vers/openwiki
cp .env.example .env               # MYSQL_*, MINIO_*, VITE_*
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# éditer les 3 .env — en particulier backend/.env : DB_HOST=mysql et
# MINIO_ENDPOINT=minio (les noms des services docker-compose, pas
# localhost comme en dev local)
docker compose up -d --build
\`\`\`

**Version allégée (mariadb/minio déjà existants) :**

\`\`\`bash
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
docker compose -f docker-compose.external.yml up -d --build
\`\`\`

Si Minio n'existe pas encore et que vous voulez le lancer à part (sans compose), une seule fois sur le serveur :

\`\`\`bash
docker run -d --name minio --network mariadb-network --restart unless-stopped \\
  -e MINIO_ROOT_USER=<clé-accès> -e MINIO_ROOT_PASSWORD=<clé-secrète> \\
  -p 9000:9000 -p 9001:9001 -v minio-data:/data \\
  minio/minio server /data --console-address ":9001"
\`\`\`

<div class="callout">
  <span class="callout-icon">💡</span>
  <span>Ces trois fichiers <code>.env</code> ne sont <strong>jamais commités</strong> (<code>.gitignore</code>) : sur un premier <code>git clone</code> sans eux, <code>docker compose up</code> échoue (variables manquantes) — c'est attendu, pas un bug. Une fois créés à la main comme ci-dessus, tous les déploiements suivants (manuels ou automatiques via CI/CD) fonctionnent.</span>
</div>

## CI/CD

- \`.github/workflows/ci.yml\` — lint + tests (backend + frontend) sur chaque PR vers \`main\` ; build Docker des deux images en plus sur chaque push vers \`main\`. Voir la page [Notes de version](/pages/documentation/notes-de-version) pour le détail des jobs.
- \`.github/workflows/deploy.yml\` — se déclenche uniquement quand \`ci.yml\` vient de réussir sur \`main\` (\`workflow_run\`, jamais sur une PR) : se connecte en SSH au serveur via un tunnel Cloudflare, puis \`git pull && docker compose up -d --build\`.

Le déploiement passe par un tunnel Cloudflare (\`cloudflared\`) plutôt que d'exposer SSH publiquement — sans application Access devant (pas de service token à gérer). À configurer une fois, côté [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) :

1. **Tunnel** — créer un tunnel \`cloudflared\` sur le serveur, avec une route publique (Public Hostname) vers \`ssh://localhost:22\`.
2. **Clé SSH** — générer une paire de clés dédiée au déploiement (\`ssh-keygen -t ed25519 -C "openwiki-deploy"\`, sans passphrase) et ajouter la clé **publique** à \`~/.ssh/authorized_keys\` de l'utilisateur de déploiement sur le serveur.

Puis, secrets du dépôt GitHub (Settings → Secrets and variables → Actions) :

| Secret | Contenu |
| --- | --- |
| \`DEPLOY_SSH_PRIVATE_KEY\` | Clé **privée** générée à l'étape 2 |
| \`DEPLOY_SSH_HOSTNAME\` | Hostname public du tunnel (étape 1) |
| \`DEPLOY_SSH_USER\` | Utilisateur SSH sur le serveur |
| \`DEPLOY_PATH\` | Chemin absolu du clone git sur le serveur (ex. \`/opt/openwiki\`) |

Si une application Access protège un jour ce hostname (service token), \`deploy.yml\` sait déjà où l'ajouter : \`TUNNEL_SERVICE_TOKEN_ID\`/\`TUNNEL_SERVICE_TOKEN_SECRET\` en env du job \`deploy\`, lus automatiquement par \`cloudflared access ssh\`.

\`deploy.yml\` ne configure ni ne modifie la protection de branche \`main\` (statut check requis pour bloquer un merge sur test cassé) — c'est un réglage du dépôt GitHub (Settings → Branches), pas quelque chose qu'un fichier de workflow puisse exprimer.`,
          },
        ],
      },
      {
        slug: 'endpoints',
        title: 'Endpoints',
        tags: ['api'],
        content: `# Endpoints

La documentation ci-dessous est générée automatiquement à partir des routes réellement exposées par le backend (schéma OpenAPI de \`/api/docs-json\`).

<api-reference></api-reference>`,
      },
      {
        slug: 'mcp',
        title: 'Intégration MCP',
        tags: ['mcp'],
        content: `<style>
.callout {
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--destructive);
  border-radius: var(--radius);
  background: var(--card);
  padding: 0.9rem 1.1rem;
  margin: 1.1rem 0;
}
.callout-icon {
  font-size: 1.1rem;
  line-height: 1.4;
}
.callout strong {
  color: var(--destructive);
}
.scope-badge {
  display: inline-block;
  font-family: monospace;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: calc(var(--radius) * 0.6);
  padding: 0.1rem 0.5rem;
}
</style>

# Intégration MCP

OpenWiki expose un serveur [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) permettant à un assistant IA compatible (Claude Desktop, Claude Code, etc.) de piloter le wiki directement : créer et modifier des pages, gérer des tags, des utilisateurs, uploader des médias et lancer des recherches.

## 1. Créer une clé API

Seul un compte **admin** peut créer une clé, depuis [Administration → Clés API MCP](/admin/mcp/api-keys) ou via l'API :

\`\`\`bash
curl -X POST http://localhost:3000/api/admin/mcp/api-keys \\
  -H "Authorization: Bearer <votre-token-jwt-admin>" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Claude Desktop", "scopes": ["pages:read", "pages:write"] }'
\`\`\`

<div class="callout">
  <span class="callout-icon">⚠️</span>
  <span>La clé en clair n'est affichée <strong>qu'une seule fois</strong>, à la création — copiez-la immédiatement, elle n'est plus jamais récupérable ensuite (seuls son nom, ses scopes et sa dernière utilisation restent visibles). Une clé peut être révoquée à tout moment depuis la même page.</span>
</div>

## 2. Scopes disponibles

Chaque clé porte un ou plusieurs scopes, qui déterminent les tools visibles et utilisables :

<table>
<thead><tr><th>Scope</th><th>Donne accès à</th></tr></thead>
<tbody>
<tr><td><span class="scope-badge">pages:read</span></td><td>Lire des pages, lister l'arborescence, rechercher</td></tr>
<tr><td><span class="scope-badge">pages:write</span></td><td>Créer, modifier, publier, supprimer des pages</td></tr>
<tr><td><span class="scope-badge">tags:read</span></td><td>Lister les tags</td></tr>
<tr><td><span class="scope-badge">tags:write</span></td><td>Créer des tags, (dé)taguer une page</td></tr>
<tr><td><span class="scope-badge">users:read</span></td><td>Lister les utilisateurs</td></tr>
<tr><td><span class="scope-badge">users:write</span></td><td>Créer un utilisateur, modifier son rôle</td></tr>
<tr><td><span class="scope-badge">media:read</span></td><td>Obtenir l'URL présignée d'un média</td></tr>
<tr><td><span class="scope-badge">media:write</span></td><td>Uploader une image</td></tr>
<tr><td><span class="scope-badge">search:read</span></td><td>Rechercher (<code>pages:read</code> suffit aussi)</td></tr>
</tbody>
</table>

Un tool nécessitant un scope absent de la clé n'apparaît même pas dans \`tools/list\`.

## 3. Se connecter avec un client MCP

Le serveur écoute sur \`POST/GET/DELETE /api/mcp\` (transport HTTP streamable, avec gestion de session via l'en-tête \`Mcp-Session-Id\`) et attend la clé API en en-tête \`Authorization: Bearer <clé>\`.

**Avec Claude Code** (CLI \`claude mcp add\`) :

\`\`\`bash
claude mcp add --transport http openwiki http://localhost:3000/api/mcp \\
  --header "Authorization: Bearer <votre-clé-api-mcp>"
\`\`\`

**Avec un autre client** supportant un serveur MCP distant en HTTP (Claude Desktop, etc.), via un fichier de configuration (adapter la syntaxe exacte au client utilisé) :

\`\`\`json
{
  "mcpServers": {
    "openwiki": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <votre-clé-api-mcp>"
      }
    }
  }
}
\`\`\`

Une fois connecté, le client peut lister les tools disponibles (\`tools/list\`) puis les appeler (\`tools/call\`) — seuls les tools couverts par les scopes de la clé apparaissent.

## 4. Tools disponibles

**Pages** (\`pages:read\`/\`pages:write\`)

| Tool | Rôle |
| --- | --- |
| \`wiki_create_page\` | Créer une page (slug, titre, contenu, page parente, visibilité) |
| \`wiki_update_page\` | Modifier titre/contenu (crée une nouvelle version) |
| \`wiki_get_page\` | Récupérer une page par son chemin complet (ex. \`docs/guide\`) |
| \`wiki_list_pages\` | Lister l'arbre entier, ou les enfants directs d'une page |
| \`wiki_delete_page\` | Supprimer une page (\`cascade\` obligatoire si elle a des enfants) |
| \`wiki_set_page_visibility\` | Changer la visibilité d'une page (public/private), en cascade sur les enfants |

**Tags** (\`tags:read\`/\`tags:write\`)

| Tool | Rôle |
| --- | --- |
| \`wiki_create_tag\` | Créer un tag |
| \`wiki_list_tags\` | Lister tous les tags |
| \`wiki_tag_page\` | Associer un tag existant à une page |
| \`wiki_untag_page\` | Retirer un tag d'une page |

**Utilisateurs** (\`users:read\`/\`users:write\`)

| Tool | Rôle |
| --- | --- |
| \`wiki_create_user\` | Créer un compte (mot de passe temporaire généré, jamais renvoyé) |
| \`wiki_list_users\` | Lister les utilisateurs (paginé) |
| \`wiki_update_user_role\` | Modifier le rôle d'un utilisateur |

**Médias** (\`media:read\`/\`media:write\`)

| Tool | Rôle |
| --- | --- |
| \`wiki_upload_image\` | Uploader une image (transmise en base64) sur une page |
| \`wiki_get_media_url\` | Obtenir une URL présignée pour un média existant |

**Recherche** (\`search:read\` ou \`pages:read\`)

| Tool | Rôle |
| --- | --- |
| \`wiki_search\` | Rechercher des pages existantes par mot-clé |

## 5. Journal d'audit

Chaque appel de tool (succès ou échec) est tracé — clé utilisée, tool, entrée/sortie (tronquées), statut, message d'erreur. Consultable, filtrable par clé API, depuis [Administration → Journal d'activité MCP](/admin/mcp/audit-log).`,
      },
      {
        slug: 'marquages-disponibles',
        title: 'Marquages disponibles',
        tags: ['guide', 'documentation'],
        content: `<style>
.markup-example {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin: 1rem 0 1.5rem;
  background: var(--border);
}
.markup-example > div {
  background: var(--background);
  padding: 1rem;
  min-width: 0;
}
.markup-example .markup-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
  margin-bottom: 0.5rem;
  font-weight: 700;
}
.markup-example pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.8rem;
}
@media (max-width: 640px) {
  .markup-example {
    grid-template-columns: 1fr;
  }
}
.mode-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  margin-left: 0.4rem;
  vertical-align: middle;
}
.mode-badge.pages-only {
  background: var(--primary);
  color: var(--primary-foreground);
}
.callout {
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: var(--radius);
  background: var(--card);
  padding: 0.9rem 1.1rem;
  margin: 1.1rem 0;
}
.callout-icon {
  font-size: 1.1rem;
  line-height: 1.4;
}
.callout strong {
  color: var(--primary);
}
.deny-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.75rem 0;
}
.deny-list code {
  background: var(--destructive);
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: calc(var(--radius) * 0.6);
  font-size: 0.8rem;
}
</style>

# Marquages disponibles

Le contenu d'une page est écrit en Markdown. Les pages (mais pas les commentaires — voir l'encart ci-dessous) supportent en plus du HTML et du CSS arbitraires, et des formules mathématiques en LaTeX. <span class="mode-badge pages-only">Pages uniquement</span>

<div class="callout">
  <span class="callout-icon">ℹ️</span>
  <span>Les fonctionnalités marquées <span class="mode-badge pages-only">Pages uniquement</span> sur cette page (HTML/CSS libre, LaTeX) ne s'appliquent qu'au <strong>contenu des pages</strong>, réservé aux comptes editor/admin. Les <strong>commentaires</strong> restent en Markdown restreint pour tous les utilisateurs authentifiés.</span>
</div>

## Markdown de base

La syntaxe [CommonMark](https://commonmark.org/) + [GFM](https://github.github.com/gfm/) habituelle fonctionne partout (pages et commentaires) : titres, listes, tableaux, blocs de code, liens, images, citations, texte barré, cases à cocher.

<div class="markup-example">
<div>
<div class="markup-label">Markdown</div>
<pre>## Titre
- **gras**, *italique*, ~~barré~~
- [lien](https://exemple.fr)
- \`code en ligne\`
| A | B |
|---|---|
| 1 | 2 |</pre>
</div>
<div>
<div class="markup-label">Rendu</div>

## Titre

- **gras**, *italique*, ~~barré~~
- [lien](https://exemple.fr)
- \`code en ligne\`

| A | B |
|---|---|
| 1 | 2 |

</div>
</div>

## HTML et balises custom <span class="mode-badge pages-only">Pages uniquement</span>

N'importe quelle balise HTML peut être écrite directement dans le contenu, y compris des balises custom inconnues (ex. pour styliser un composant maison). Seules ces balises sont retirées, ainsi que tout attribut \`on*\` (\`onclick\`, etc.) et les URLs \`javascript:\` :

<div class="deny-list">
<code>&lt;script&gt;</code>
<code>&lt;iframe&gt;</code>
<code>&lt;object&gt;</code>
<code>&lt;embed&gt;</code>
<code>&lt;form&gt;</code>
<code>&lt;base&gt;</code>
<code>&lt;link&gt;</code>
<code>&lt;meta&gt;</code>
</div>

<div class="markup-example">
<div>
<div class="markup-label">Markdown</div>
<pre>&lt;mon-badge&gt;Nouveau&lt;/mon-badge&gt;
&lt;div style="color: var(--primary); font-weight: 700"&gt;
  Du HTML avec un style inline.
&lt;/div&gt;</pre>
</div>
<div>
<div class="markup-label">Rendu</div>

<mon-badge>Nouveau</mon-badge>

<div style="color: var(--primary); font-weight: 700">
  Du HTML avec un style inline.
</div>

</div>
</div>

## CSS scopé à la page <span class="mode-badge pages-only">Pages uniquement</span>

Un bloc \`<style>\` écrit dans le contenu s'applique — mais uniquement au contenu de **cette page**. Techniquement, le CSS est automatiquement enveloppé dans la règle native [\`@scope\`](https://developer.mozilla.org/fr/docs/Web/CSS/@scope), pour qu'un sélecteur générique comme \`p { color: red }\` ne puisse jamais affecter la sidebar, la barre du haut, ou une autre page.

<div class="markup-example">
<div>
<div class="markup-label">Markdown</div>
<pre>&lt;style&gt;
.exemple-carte {
  border: 2px solid var(--primary);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  display: inline-block;
}
&lt;/style&gt;
&lt;div class="exemple-carte"&gt;Carte stylée&lt;/div&gt;</pre>
</div>
<div>
<div class="markup-label">Rendu</div>

<style>
.exemple-carte {
  border: 2px solid var(--primary);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  display: inline-block;
}
</style>

<div class="exemple-carte">Carte stylée</div>

</div>
</div>

## Formules LaTeX <span class="mode-badge pages-only">Pages uniquement</span>

Les formules mathématiques s'écrivent entre doubles dollars : \`$$formule$$\` — en ligne dans une phrase, ou seule sur son propre paragraphe pour un rendu centré en bloc. Rendu via [KaTeX](https://katex.org/).

<div class="callout">
  <span class="callout-icon">ℹ️</span>
  <span>Seul le double dollar <code>$$...$$</code> est reconnu — pas de simple dollar <code>$...$</code>, qui n'offre aucune protection fiable contre les faux positifs (un prix comme "5 $ ou 10 $" serait interprété comme une formule).</span>
</div>

<div class="markup-example">
<div>
<div class="markup-label">Markdown</div>
<pre>Formule d'Euler : $$e^{i\\pi} + 1 = 0$$
$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$</pre>
</div>
<div>
<div class="markup-label">Rendu</div>

Formule d'Euler : $$e^{i\\pi} + 1 = 0$$

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

</div>
</div>

## Récapitulatif

| Marquage | Pages | Commentaires |
| --- | --- | --- |
| Markdown / GFM | ✅ | ✅ |
| HTML arbitraire (sauf balises interdites) | ✅ | ❌ (HTML très restreint) |
| CSS (\`<style>\`, scopé) | ✅ | ❌ |
| LaTeX (\`$$...$$\`) | ✅ | ❌ |`,
      },
      {
        slug: 'notes-de-version',
        title: 'Notes de version',
        tags: ['changelog'],
        content: `# Notes de version

## Version 0.30

<details>
<summary>0.30.3 — 2026-09-25</summary>

- Le détail d'une page expose désormais la liste précise des actions autorisées (\`permissions\`) au lieu d'un simple \`canEdit\`, l'arborescence des pages indique pour chaque page si l'utilisateur peut y créer une sous-page, et \`GET /users/me\` renvoie les permissions globales et les groupes de l'utilisateur connecté.

</details>

<details>
<summary>0.30.2 — 2026-09-25</summary>

- Les contrôles d'accès existants (pages, tags, médias, commentaires, recherche) utilisent désormais le nouveau système de permissions granulaires. Le rôle \`editor\` est supprimé : les anciens éditeurs conservent leurs droits via un groupe créé automatiquement, les anciens lecteurs ayant un droit d'édition explicite le conservent sur la page concernée et sa sous-arborescence.

</details>

<details>
<summary>0.30.1 — 2026-09-24</summary>

- Service central de résolution des permissions (\`PermissionsService\`) : calcule les droits effectifs d'un utilisateur (directs et via ses groupes) sur une page ou globalement — travail préparatoire, pas encore branché sur les contrôles d'accès existants.

</details>

<details>
<summary>0.30.0 — 2026-09-24</summary>

- Socle de données du nouveau système de permissions (groupes, permissions globales, règles d'accès aux pages attribuables à un utilisateur ou à un groupe) — travail préparatoire, pas encore actif sur les contrôles d'accès existants.

</details>

## Version 0.29

<details>
<summary>0.29.3 — 2026-09-23</summary>

- Les pages, leur historique de versions, et l'aperçu de l'éditeur affichent désormais le HTML/CSS personnalisé et les formules LaTeX du contenu — les commentaires restent inchangés (rendu restreint comme avant).

</details>

<details>
<summary>0.29.2 — 2026-09-23</summary>

- Support des formules mathématiques en LaTeX dans le contenu des pages, avec la syntaxe \`$formule$\` pour une formule en ligne et \`$$formule$$\` pour une formule en bloc.

</details>

<details>
<summary>0.29.1 — 2026-09-23</summary>

- Le CSS personnalisé écrit dans une page reste désormais cantonné à cette page : il ne peut plus affecter le reste de l'interface (sidebar, barre du haut, autres pages).

</details>

<details>
<summary>0.29.0 — 2026-09-23</summary>

- Nouvelle base technique pour un rendu HTML plus permissif sur le contenu des pages (balises et attributs personnalisés autorisés, sauf ceux posant un risque réel : \`<script>\`, \`<iframe>\`, \`<object>\`, \`<embed>\`, \`<form>\`, \`<base>\`, et tout attribut \`on*\`).

</details>

## Version 0.28

<details>
<summary>0.28.0 — 2026-09-22</summary>

- \`GET /search\` matche désormais aussi les tags des pages, en plus du titre et du contenu : une page taguée \`javascript\`, par exemple, remonte pour une recherche "javascript" même si ce mot n'apparaît pas dans son texte. Chaque résultat renvoie aussi la liste de ses tags.

</details>

## Version 0.27

<details>
<summary>0.27.10 — 2026-09-22</summary>

- Correctif : \`GET\`/\`POST /pages/:id/tags\` et \`DELETE /pages/:id/tags/:tagId\` étaient masqués par la route générique \`GET /pages/*path\` — \`TagsModule\` dépend de \`PagesModule\` (pour vérifier les droits de lecture sur la page), ce qui force Nest à initialiser \`PagesModule\` en premier et donc à enregistrer la route générique de \`PagesController\` avant les routes de tags. Toute requête vers ces endpoints tombait dans \`getByPath\` (chemin \`[id, 'tags']\`) et échouait en 404, empêchant l'affichage des tags sur les pages — y compris les pages par défaut, pourtant bien taguées en base par \`seed:content\`. Les trois routes vivent maintenant directement sur \`PagesController\`, comme les autres sous-ressources de page (versions, permissions, commentaires), déclarées avant la route générique — même correctif que 0.21.6 pour les commentaires.
- Correctif : la vue de lecture d'une page attendait le chargement complet des tags avant d'afficher quoi que ce soit (contenu compris) ; un échec ou une lenteur sur l'endpoint des tags de page bloquait toute la page au lieu de se limiter à l'absence de badges de tags.
- Correctif du tool MCP \`wiki_create_tag\` : le schéma d'entrée n'acceptait que \`name\`, ignorant silencieusement une \`color\` transmise par le client alors que le backend la supporte déjà (même mécanisme que celui utilisé par \`seed:content\` pour les couleurs des tags par défaut). \`wiki_create_tag\` et \`wiki_list_tags\` exposent désormais \`color\`.

</details>

<details>
<summary>0.27.9 — 2026-09-22</summary>

- Correctif : \`seed:content\` retrouvait la page à mettre à jour par slug seul, sans tenir compte du parent, alors qu'un slug n'est unique que par parent (\`documentation\`, \`installation\`, \`configuration\`...) — une page existante sans rapport mais portant le même slug ailleurs dans l'arbre pouvait se faire écraser (titre/contenu), déplacer et retaguer par erreur à chaque déploiement. La recherche est désormais scopée par parent, comme partout ailleurs dans l'app.
- Correctif : le panneau de gestion des tags de l'éditeur de page disparaissait entièrement (y compris le bouton "Créer un tag") dès que le chargement des tags existants d'une page échouait, sans aucun message d'erreur.

</details>

<details>
<summary>0.27.8 — 2026-09-22</summary>

- Vue de lecture d'une page : bandeau "nouvelle version disponible" quand quelqu'un sauvegarde la page pendant que tu la consultes, avec bouton pour recharger. Le fil de commentaires se met aussi à jour en direct (ajout/modification/suppression) sans avoir à recharger la page.

</details>

<details>
<summary>0.27.7 — 2026-09-22</summary>

- Les commentaires diffusent désormais un événement temps réel à chaque création/modification/suppression, relayé aux autres personnes en train de regarder la même page.

</details>

<details>
<summary>0.27.6 — 2026-09-22</summary>

- La sidebar (arborescence des pages) se met à jour automatiquement quand une page est créée, déplacée, renommée, supprimée ou change de visibilité, sans avoir à recharger.

</details>

<details>
<summary>0.27.5 — 2026-09-22</summary>

- Diffusion temps réel des changements d'arborescence (création, déplacement, suppression, visibilité, renommage) à tous les navigateurs connectés.

</details>

<details>
<summary>0.27.4 — 2026-09-22</summary>

- Éditeur de page : affichage des marqueurs de conflit \`<<<<<<<\`/\`=======\`/\`>>>>>>>\` en cas de fusion impossible au moment de la sauvegarde, avec bandeau d'alerte tant que le conflit n'est pas résolu.

</details>

<details>
<summary>0.27.3 — 2026-09-22</summary>

- Connexion WebSocket temps réel dans l'éditeur de page : quand quelqu'un d'autre sauvegarde la page que tu es en train d'éditer, tes modifications non enregistrées sont fusionnées automatiquement avec les siennes plutôt que d'écraser silencieusement l'un ou l'autre.

</details>

<details>
<summary>0.27.2 — 2026-09-22</summary>

- Nouvelle infrastructure temps réel (WebSocket) : connexion authentifiée par cookie, rooms par page selon les droits de lecture, base pour toutes les mises à jour en direct de l'application.

</details>

<details>
<summary>0.27.1 — 2026-09-22</summary>

- Filet de sécurité à la sauvegarde d'une page : si la version de base envoyée par le client n'est plus à jour (notification temps réel manquée), le serveur retente automatiquement la fusion avant d'écrire, plutôt que d'écraser une sauvegarde concurrente.

</details>

<details>
<summary>0.27.0 — 2026-09-22</summary>

- Fusion à 3 voies (façon \`git merge\`) des sauvegardes concurrentes d'une page, au lieu du dernier écrivain qui écrase silencieusement les autres. Nouvel endpoint \`POST /pages/:id/merge-preview\` pour prévisualiser une fusion sans sauvegarder.

</details>

## Version 0.26

<details>
<summary>0.26.1 — 2026-09-17</summary>

- Nouvelle vue d'accueil pour les visiteurs non connectés : présentation du wiki, 2 KPI publics (pages, commentaires) et appel à créer un compte ou se connecter. Nouvel endpoint public \`GET /stats/public\`.

</details>

## Version 0.25

<details>
<summary>0.25.11 — 2026-09-16</summary>

- Correctif : \`POST /oauth/authorize/decision\` renvoyait \`{ redirectUrl }\` sans l'enveloppe \`ResponseDto\` standard de l'app, ce qui faisait planter le front (destructuration d'un objet \`undefined\`) au moment de rediriger après un clic sur Autoriser/Refuser sur l'écran de consentement OAuth.

</details>

<details>
<summary>0.25.10 — 2026-09-16</summary>

- Correctif de déploiement : le nginx du frontend forçait \`X-Forwarded-Proto\` sur \`$scheme\` (toujours \`http\` dans ce conteneur, qui écoute en HTTP interne derrière la terminaison TLS externe), ce qui faisait générer des URLs \`http://\` dans les métadonnées de découverte OAuth au lieu de \`https://\`. Valeur fixée en dur sur \`https\`, seul protocole utilisé par ce conteneur en production.

</details>

<details>
<summary>0.25.9 — 2026-09-16</summary>

- Correctif de déploiement : \`frontend/nginx.conf\` proxifie désormais aussi \`/api/*\` vers le backend, en plus des endpoints \`.well-known\` OAuth — le conteneur frontend n'a plus besoin de dépendre d'une règle de routage externe pour ces chemins.

</details>

<details>
<summary>0.25.8 — 2026-09-16</summary>

- Correctif de déploiement : les endpoints de découverte OAuth (\`/.well-known/oauth-protected-resource\`, \`/.well-known/oauth-authorization-server\`) tombaient dans le SPA du frontend au lieu d'atteindre le backend, faute de règle de routage sur ces chemins hors \`/api\`. \`frontend/nginx.conf\` les proxifie désormais directement vers le conteneur backend.

</details>

<details>
<summary>0.25.7 — 2026-09-16</summary>

- Nouvel onglet "Clients OAuth" dans l'administration MCP (\`/admin/mcp/oauth-clients\`) : liste des clients OAuth enregistrés et de leurs refresh tokens actifs, avec révocation individuelle.

</details>

<details>
<summary>0.25.6 — 2026-09-16</summary>

- Écran de consentement OAuth après connexion : une IA connectée via MCP (ex. Claude Code) peut désormais demander à un compte admin d'autoriser ou de refuser sa connexion.

</details>

<details>
<summary>0.25.5 — 2026-09-16</summary>

- Le endpoint \`/mcp\` accepte désormais un access token OAuth en plus des clés API \`sk_...\` existantes (aucun changement pour les intégrations déjà en place).

</details>

<details>
<summary>0.25.4 — 2026-09-16</summary>

- Nouveaux endpoints \`POST /oauth/token\` (échange de code d'autorisation et rafraîchissement) et \`POST /oauth/revoke\` (révocation d'un refresh token).

</details>

<details>
<summary>0.25.3 — 2026-09-16</summary>

- Nouvel endpoint \`GET /oauth/authorize\` : flux d'autorisation OAuth 2.0 avec PKCE (S256 obligatoire), réservé aux comptes admin, avec redirection vers le login existant si nécessaire.

</details>

<details>
<summary>0.25.2 — 2026-09-16</summary>

- Découverte OAuth (\`/.well-known/oauth-protected-resource\`, \`/.well-known/oauth-authorization-server\`) et enregistrement dynamique de client (\`POST /oauth/register\`), pour qu'un client MCP se connecte sans configuration manuelle.

</details>

<details>
<summary>0.25.1 — 2026-09-16</summary>

- Socle de données du serveur d'autorisation OAuth 2.0 pour MCP : nouvelles tables \`oauth_clients\` et \`oauth_refresh_tokens\`.

</details>

## Version 0.24

<details>
<summary>0.24.4 — 2026-09-15</summary>

- Nouvelle page d'accueil "Tableau de bord" : compteurs globaux, pages les plus consultées et pages suivies. Un bouton "Suivre" apparaît désormais sur chaque page pour l'ajouter à ses pages suivies.

</details>

<details>
<summary>0.24.3 — 2026-09-15</summary>

- Possibilité de suivre une page (\`POST\`/\`DELETE /pages/:id/follow\`) et nouvel endpoint \`GET /stats/followed-pages\` : liste les pages suivies par l'utilisateur courant, triées par activité la plus récente.

</details>

<details>
<summary>0.24.2 — 2026-09-15</summary>

- Nouvel endpoint \`GET /stats/popular-pages\` : renvoie les pages les plus consultées, classées par nombre de vues. Chaque lecture d'une page incrémente désormais son compteur de vues.

</details>

<details>
<summary>0.24.1 — 2026-09-15</summary>

- Nouvel endpoint \`GET /stats\` : renvoie le nombre total de pages, de commentaires, d'utilisateurs et de médias, pour alimenter les KPI de la future page d'accueil.

</details>

## Version 0.23

<details>
<summary>0.23.2 — 2026-09-14</summary>

- Un lien markdown vers un fichier PDF dans le contenu d'une page affiche désormais un aperçu de sa première page (même composant \`PdfPreview\` que dans la médiathèque) au lieu d'un simple lien texte.

</details>

<details>
<summary>0.23.1 — 2026-09-14</summary>

- La médiathèque affiche désormais un aperçu de la première page pour les fichiers PDF (nouveau composant \`PdfPreview\`, rendu natif navigateur via iframe) au lieu d'un écran noir. Un clic sur l'aperçu ouvre le PDF dans un nouvel onglet.

</details>

## Version 0.22

<details>
<summary>0.22.14 — 2026-09-14</summary>

- Fusion de \`isPublished\` dans \`visibility\` sur les pages : il n'existe plus qu'un seul état public/privé au lieu de deux drapeaux indépendants (une page pouvait afficher "publique" tout en restant invisible des visiteurs non connectés). Une page privée reste visible aux éditeurs/admins et aux utilisateurs ayant un droit explicite dessus. \`PATCH /pages/:id/publish\` et le tool MCP \`wiki_publish_page\` sont supprimés ; le tool MCP \`wiki_set_page_visibility\` les remplace.

</details>

<details>
<summary>0.22.13 — 2026-09-13</summary>

- La liste des utilisateurs (Administration > Utilisateurs) affiche désormais la vraie photo de profil de chacun, avec repli sur les initiales si elle n'en a pas.

</details>

<details>
<summary>0.22.12 — 2026-09-13</summary>

- Le journal d'activité admin (Administration > Activité) traduit maintenant toutes les actions (mot de passe modifié, version restaurée, visibilité modifiée, commentaires activés/désactivés, commentaire ajouté, photo de profil changée/retirée) au lieu d'afficher le code brut de l'action pour celles manquantes.

</details>

<details>
<summary>0.22.11 — 2026-09-13</summary>

- Correction d'un décalage de 2h sur les dates de la journalisation d'activité (\`created_at\`) en production : la valeur est désormais posée par l'application (toujours en UTC) plutôt que par le \`CURRENT_TIMESTAMP\` du serveur MySQL/MariaDB, dont le fuseau horaire de session n'est pas garanti sur un serveur externe non géré par ce dépôt.

</details>

<details>
<summary>0.22.10 — 2026-09-13</summary>

- La page "Mon profil" a été entièrement refaite : identité (photo, nom, e-mail, rôle, date d'inscription) et statistiques (pages créées, modifications, commentaires) en tête, onglets Profil / Activité / Sécurité. Nouveaux endpoints \`GET /users/me/activity\` (historique personnel) et \`PATCH /auth/password\` (changer son mot de passe).

</details>

<details>
<summary>0.22.9 — 2026-09-13</summary>

- Nouvel endpoint \`GET /users/me/comments\` : chaque utilisateur peut lister ses propres commentaires (page d'origine, date), hors commentaires supprimés.
- Refonte de la page "Mon profil" en layout pleine page à deux colonnes : identité (photo, nom, e-mail, rôle, date d'inscription, nom d'affichage) à gauche, aperçu de tous les commentaires écrits à droite.

</details>

<details>
<summary>0.22.8 — 2026-09-13</summary>

- Refonte visuelle de la page "Mon profil" : identité (photo, nom, rôle, commentaires) et édition du nom d'affichage séparées en deux blocs, changement de photo via une icône appareil photo sur l'avatar plutôt qu'un bouton séparé.

</details>

<details>
<summary>0.22.7 — 2026-09-13</summary>

- La photo de profil s'affiche désormais dans le menu utilisateur de la barre de navigation (au lieu des seules initiales).

</details>

<details>
<summary>0.22.6 — 2026-09-13</summary>

- Les commentaires affichent désormais la vraie photo de profil de leur auteur (au lieu des seules initiales) quand il en a une.

</details>

<details>
<summary>0.22.5 — 2026-09-13</summary>

- La page "Mon profil" permet désormais de changer ou retirer sa photo de profil (aperçu avant envoi, confirmation pour le retrait).

</details>

<details>
<summary>0.22.4 — 2026-09-13</summary>

- Nouvel écran "Mon profil" (\`/profile\`, lien depuis le menu utilisateur) : rôle et nombre de commentaires écrits, édition du nom d'affichage.

</details>

<details>
<summary>0.22.3 — 2026-09-13</summary>

- Nouveaux endpoints \`POST /users/me/avatar\` et \`DELETE /users/me/avatar\` : upload (jpg/png/webp, 2 Mo max) et suppression de sa propre photo de profil, stockée sur Minio comme les autres médias.

</details>

<details>
<summary>0.22.2 — 2026-09-13</summary>

- Tests de non-régression pour \`PATCH /users/me\` : validation du nom d'affichage (2-100 caractères) et confirmation qu'un utilisateur ne peut pas changer son propre rôle via cet endpoint, en préparation de l'écran "Mon profil".

</details>

<details>
<summary>0.22.1 — 2026-09-13</summary>

- \`GET /users/me\` renvoie désormais \`commentsCount\` (nombre de commentaires écrits, hors supprimés), en préparation de l'écran "Mon profil".

</details>

## Version 0.21

<details>
<summary>0.21.10 — 2026-09-12</summary>

- Activation/désactivation des commentaires par page : nouvelle option dans l'édition d'une page (\`PATCH /pages/:id/comments-enabled\`), désactivée par défaut sur les pages seedées (documentation, notes de version, FAQ). Quand c'est désactivé, la section commentaires n'est plus affichée et l'API rejette lecture/écriture de commentaires sur cette page.

</details>

<details>
<summary>0.21.9 — 2026-09-12</summary>

- Petite icône ajoutée sur le bouton "Répondre" du fil de commentaires, pour cohérence avec les boutons "Modifier"/"Supprimer".

</details>

<details>
<summary>0.21.8 — 2026-09-12</summary>

- Modération des commentaires côté admin : nouveau bouton "Messages" sur chaque ligne de \`/admin/users\`, ouvrant un panneau listant les commentaires de l'utilisateur (page d'origine, contenu, date), paginé, avec sélection multiple et purge (sélection ou totale), chacune avec sa propre confirmation.

</details>

<details>
<summary>0.21.7 — 2026-09-12</summary>

- Fil de commentaires sur la vue de lecture d'une page : lire, écrire, répondre (1 niveau), éditer et supprimer son propre commentaire, avec suppression modérée pour les éditeurs/admins.

</details>

<details>
<summary>0.21.6 — 2026-09-12</summary>

- Correctif : \`GET\`/\`POST /pages/:id/comments\` étaient masqués par la route générique \`GET /pages/*path\` (lecture d'une page par chemin) et retournaient toujours "Page not found". Les deux routes vivent maintenant directement sur \`PagesController\`, comme les autres sous-ressources de page (versions, permissions), déclarées avant la route générique.

</details>

<details>
<summary>0.21.5 — 2026-09-12</summary>

- Modération admin des commentaires : \`GET /admin/users/:id/comments\` liste tous les commentaires d'un utilisateur (paginé, avec la page d'origine), \`DELETE /admin/users/:id/comments\` purge tout ou une sélection (\`commentIds\`), cascade sur les réponses, tracé dans le journal d'audit.

</details>

<details>
<summary>0.21.4 — 2026-09-12</summary>

- Nouvel endpoint \`PATCH /comments/:id\` : l'auteur peut éditer son propre commentaire, ce qui pose \`editedAt\` (affiché "(modifié)" côté UI).

</details>

<details>
<summary>0.21.3 — 2026-09-12</summary>

- Nouvel endpoint \`DELETE /comments/:id\` : l'auteur peut retirer son propre commentaire (suppression douce, affiché "[commentaire supprimé]") ; un éditeur ou un admin peut le supprimer définitivement, avec cascade sur ses réponses. Une suppression par un admin est tracée dans le journal d'audit.

</details>

<details>
<summary>0.21.2 — 2026-09-12</summary>

- Nouvel endpoint \`POST /pages/:id/comments\` : créer un commentaire, ou une réponse via \`parentId\` (1 seul niveau de nesting). Ouvert à tout utilisateur authentifié ayant accès à la page, avec limitation de fréquence sur la création.

</details>

<details>
<summary>0.21.1 — 2026-09-12</summary>

- Nouvel endpoint \`GET /pages/:id/comments\` : liste les commentaires d'une page (arbre à un niveau, réponses incluses), en respectant la visibilité de la page.

</details>

<details>
<summary>0.21.0 — 2026-09-12</summary>

- Nouvelle entité \`Comment\` (page, auteur, réponse à 1 niveau, édition et suppression douce) et sa migration — première brique du système de commentaires sur les pages (EPIC-07).

</details>

## Version 0.20

<details>
<summary>0.20.5 — 2026-09-12</summary>

- Remplacement de Minio par [RustFS](https://rustfs.com) pour le stockage objet (S3-compatible) : l'édition Community de Minio (serveur) a été archivée en 2026 et n'est plus distribuée nulle part (Docker Hub, binaires officiels). RustFS est un remplacement direct, activement maintenu et open-source (Apache 2.0) — aucun changement de configuration côté \`backend/.env\` (les variables \`MINIO_*\` restent inchangées). Sur un serveur déjà en place, une seule commande \`chown\` du volume existant est nécessaire avant la mise à jour (voir le README).

</details>

<details>
<summary>0.20.4 — 2026-09-12</summary>

- \`GET /media\` devient \`POST /media\` : les filtres (\`pageId\`, \`search\`, \`type\`, \`page\`, \`limit\`) passent désormais dans le corps de la requête plutôt qu'en query string, pour un typage plus simple côté backend et frontend.

</details>

<details>
<summary>0.20.3 — 2026-09-12</summary>

- Le picker de médiathèque permet désormais de supprimer un média directement (avec confirmation) ; la suppression est refusée avec un message explicite si le média est encore utilisé sur une autre page.

</details>

<details>
<summary>0.20.2 — 2026-09-12</summary>

- Nouveau bouton "Médiathèque" dans l'éditeur de pages : parcourir/rechercher les médias déjà uploadés (avec filtre image/fichier) et en insérer un directement, ou en uploader un nouveau depuis la même fenêtre.

</details>

<details>
<summary>0.20.1 — 2026-09-12</summary>

- La suppression d'un média (\`DELETE /media/:id\`) est désormais refusée (409) s'il est encore référencé dans le contenu d'une autre page.

</details>

<details>
<summary>0.20.0 — 2026-09-12</summary>

- Nouvel endpoint \`GET /media\` sans \`pageId\` : médiathèque globale filtrable (recherche par nom, type image/fichier) et paginée, respectant la visibilité des pages.

</details>

## Version 0.19

<details>
<summary>0.19.5 — 2026-09-11</summary>

- Correctif de sécurité : \`multer\` (upload de fichiers, dépendance transitive de \`@nestjs/platform-express\`) était épinglé en 2.2.0, vulnérable à 3 failles de déni de service et 1 contournement de limite de taille de fichier. Forcé en 2.3.0 via un override pnpm (\`pnpm-workspace.yaml\`), le correctif amont n'étant pas encore répercuté dans \`@nestjs/platform-express\`.

</details>

<details>
<summary>0.19.4 — 2026-09-11</summary>

- Un éditeur ou un administrateur peut désormais changer la visibilité (publique/privée) d'une page depuis son édition, pas seulement à la création. Le changement est appliqué en cascade à toutes les pages descendantes.

</details>

<details>
<summary>0.19.3 — 2026-09-11</summary>

- Correctif de la barre latérale : deux pages partageant le même slug final mais sous des parents différents (ex. \`esgi/s1/reseau\` et \`esgi/s2/reseau\`) faisaient déplier la mauvaise branche et surligner le mauvais élément comme actif. La détection de la page courante comparait uniquement le dernier segment de l'URL (\`slug\`) au lieu du chemin complet ; elle résout désormais le nœud actif en suivant l'arbre niveau par niveau selon le chemin entier.

</details>

<details>
<summary>0.19.2 — 2026-09-11</summary>

- SEO / partage social : og-image, meta tags Open Graph et Twitter Card, \`robots.txt\`, et titres d'onglet dynamiques sur les pages et la recherche.

</details>

<details>
<summary>0.19.1 — 2026-09-11</summary>

- Ajout d'un bouton clair/sombre dans la barre du haut, à droite de la recherche. Le thème s'ouvre en sombre par défaut ; un choix explicite de l'utilisateur (clic sur le bouton) est ensuite mémorisé dans le navigateur (\`localStorage\`).

</details>

<details>
<summary>0.19.0 — 2026-09-08</summary>

- Image Docker \`backend\` : ~1,2 Go → ~450 Mo. La cause : le stage final lançait un \`pnpm install --frozen-lockfile\` non filtré et non \`--prod\` directement dans le stage runtime, embarquant toutes les devDependencies (backend **et** frontend — React, Vite, Tailwind, shiki...) plus le store pnpm entier. Un nouveau stage \`prod-deps\` (\`--prod --filter backend...\`) isole cette installation ; le stage \`runtime\` ne fait plus que \`COPY --from=\` son \`node_modules\`, donc le store pnpm ne touche jamais les layers de l'image finale. \`tsx\`/\`dotenv\` passent en dependencies (nécessaires en prod pour les migrations/seed via \`entrypoint.sh\`) ; le stage \`base\` pré-télécharge la version de pnpm épinglée pour éviter tout accès réseau au démarrage du conteneur.
- Image \`frontend\` (nginx + statique, ~118 Mo) : déjà correcte, seul le stage de build est désormais filtré (\`--filter frontend...\`) pour ne pas installer les dépendances du backend inutilement.

</details>

## Version 0.18

<details>
<summary>0.18.5 — 2026-09-08</summary>

- Correctif : les champs de recherche des journaux d'audit (activité utilisateur, admin, MCP) ne se vidaient jamais complètement — effacer le dernier caractère laissait la dernière lettre affichée. \`updateParams\` distinguait mal "ce filtre n'a pas changé" de "ce filtre a été vidé" (les deux se traduisaient par \`undefined\`) ; il teste désormais la présence de la clé (\`key in next\`) plutôt que sa valeur.
- Correctif CI : \`pages.service.spec.ts\` ne fournissait plus \`UserActivityLogService\` à \`PagesService\` depuis l'ajout du journal d'activité (0.18.0), faisant échouer les 22 tests en résolution de dépendances.

</details>

<details>
<summary>0.18.4 — 2026-09-08</summary>

- Pages \`/admin/audit-log\` et \`/admin/mcp/audit-log\` : ajout des filtres plage de dates et recherche texte, reflétés dans l'URL comme les autres filtres.

</details>

<details>
<summary>0.18.3 — 2026-09-08</summary>

- Nouvelle page admin \`/admin/activity-log\` (onglet "Activité") affichant le journal d'activité utilisateur, avec filtres par utilisateur, action, plage de dates et recherche texte.

</details>

<details>
<summary>0.18.2 — 2026-09-08</summary>

- \`GET /admin/mcp/audit-log\` accepte désormais \`dateFrom\`/\`dateTo\` et \`search\` (nom du tool, nom de la clé API).

</details>

<details>
<summary>0.18.1 — 2026-09-08</summary>

- \`GET /admin/audit-log\` accepte désormais \`dateFrom\`/\`dateTo\` (plage inclusive sur la date, \`YYYY-MM-DD\`) et \`search\` (action, cible, nom/email de l'admin).

</details>

<details>
<summary>0.18.0 — 2026-09-08</summary>

- Nouveau journal d'audit \`UserActivityLog\` (\`GET /admin/activity-log\`, admin uniquement, filtrable par utilisateur, action, plage de dates et recherche texte libre) — distinct de \`AdminAuditLog\` qui reste dédié aux actions admin sensibles. \`UserActivityLogService.record()\` est appelé (fire-and-forget, un échec de log ne bloque jamais l'action) depuis \`AuthService.login()\`, \`PagesService\` (création/édition/déplacement/suppression/restauration de page) et \`MediaService\` (upload/suppression de média).

</details>

## Version 0.17

<details>
<summary>0.17.13 — 2026-09-07</summary>

- \`storage/\` passe au pattern port/adapter déjà utilisé pour les repositories (\`StorageService\` devient une interface, \`MinioStorageService\` son implémentation, injectée via le token \`'StorageService'\`). Les deux clients Minio (interne / présigné public) et la liste des buckets à initialiser au démarrage sont désormais fournis par \`storage.module.ts\` via des providers \`useFactory\`, plutôt que construits dans le constructeur du service. Ajout de \`download\`/\`exists\` à l'interface (non utilisés pour l'instant, mais posés pour un futur besoin). Chaque bucket est maintenant un paramètre explicite des méthodes (\`upload\`/\`download\`/\`getPresignedUrl\`/\`delete\`/\`exists\`) plutôt qu'un champ privé du service — \`MediaService\` reçoit son bucket via un nouveau token \`'MediaBucket'\`. Suppression de \`media.service.spec.ts\` (déjà obsolète vis-à-vis de ce changement de signature, et les fichiers de test ne sont pas d'usage dans ce projet).

</details>

<details>
<summary>0.17.12 — 2026-09-07</summary>

- Correctif \`SignatureDoesNotMatch\` sur l'upload d'images via le MCP (\`wiki_upload_image\`) : \`ConfigService.get<number>('MINIO_PUBLIC_PORT')\` ne caste jamais réellement la valeur (\`process.env\` reste une string, le générique TypeScript est purement cosmétique). Le SDK \`minio-js\` compare le port à \`443\`/\`80\` avec \`!==\` strict pour décider d'ajouter le port au \`Host\` signé — une string \`"443"\` déclenchait donc un \`Host: <hôte>:443\` signé à tort, que Cloudflare Tunnel normalise sans le port en le forwardant à l'origine, d'où la signature invalide côté Minio. \`storage.service.ts\` caste désormais explicitement \`MINIO_PORT\`/\`MINIO_PUBLIC_PORT\` en nombre. L'upload lui-même (\`putObject\`) n'était jamais affecté (port 9000, jamais "par défaut" donc jamais concerné par ce bug) — seule la génération de l'URL présignée juste après l'upload cassait.

</details>

<details>
<summary>0.17.11 — 2026-09-07</summary>

- \`MEDIA_PRESIGNED_URL_EXPIRY_SECONDS\` passe de 1h à 7 jours (le maximum autorisé par une signature SigV4, imposé pareil par Minio) — les URLs présignées embarquées dans le markdown d'une page n'ont pas de mécanisme de rafraîchissement à l'affichage, donc 1h les rendait presque inutilisables pour du contenu durable. Reste une limite dure : au-delà de 7 jours sans ré-upload, l'image casse quand même.

</details>

<details>
<summary>0.17.10 — 2026-09-07</summary>

- \`storage.service.ts\` sépare désormais l'hôte Minio interne (\`MINIO_ENDPOINT\`, utilisé pour toutes les opérations backend→Minio) de l'hôte utilisé pour signer les URLs présignées données au navigateur (\`MINIO_PUBLIC_ENDPOINT\`, optionnel — retombe sur \`MINIO_ENDPOINT\` si absent). En prod, \`MINIO_ENDPOINT\` est typiquement un nom de service Docker interne (injoignable depuis un navigateur), donc sans \`MINIO_PUBLIC_ENDPOINT\` pointant vers un hôte Minio public (ex. tunnel Cloudflare dédié), aucune image uploadée n'était affichable côté client — bug découvert en migrant du contenu externe via le MCP. Doc mise à jour (README §6 + page wiki Déploiement + \`.env.example\`).

</details>

<details>
<summary>0.17.9 — 2026-09-07</summary>

- \`backend/entrypoint.sh\` lance désormais \`pnpm run seed:content\` à chaque démarrage de conteneur (donc à chaque déploiement), entre les migrations et le démarrage de l'app — la doc et les notes de version restent à jour automatiquement, y compris les modifications apportées au contenu de \`content-seed.ts\` lui-même (nouvelle \`PageVersion\` créée si le contenu ou le titre a changé, jamais de skip silencieux). Contrairement aux migrations, un échec du seed ne bloque pas le démarrage (\`|| echo ...\`) : sur le tout premier déploiement, aucun utilisateur n'existe encore pour servir d'auteur, le seed échoue silencieusement et repasse au déploiement suivant, une fois le premier admin créé à la main.

</details>

<details>
<summary>0.17.8 — 2026-09-07</summary>

- Déploiement continu : \`.github/workflows/deploy.yml\` bascule sur \`docker compose -f docker-compose.external.yml\` (au lieu de la version complète) — le serveur cible de la CD réutilise déjà un mariadb/minio existants, plus besoin d'en relancer une paire dédiée à chaque déploiement. Corrige au passage un bug de quoting : \`DEPLOY_PATH\` était entre guillemets simples dans la commande SSH distante, empêchant l'expansion de \`~\` (échec \`cd: no such file or directory\` même avec un chemin valide) — désormais non quoté côté distant.

</details>

<details>
<summary>0.17.7 — 2026-09-07</summary>

- Déploiement : nouveau \`docker-compose.external.yml\`, une version allégée (\`backend\`/\`frontend\` seulement) pour réutiliser un MariaDB/MySQL et un Minio déjà existants sur le serveur au lieu d'en relancer une paire dédiée — rejoint le réseau Docker externe \`mariadb-network\` plutôt que d'en créer un nouveau. \`docker-compose.yml\` reste la version complète (mysql + minio + backend + frontend) utilisée par le déploiement continu. Doc mise à jour (README §6 + page wiki Déploiement) avec la commande \`docker run\` pour lancer Minio en autonome sur ce même réseau.

</details>

<details>
<summary>0.17.6 — 2026-09-07</summary>

- Corrections CI post-merge : le service \`minio\` (\`bitnami/minio:latest\`) n'existe plus sur Docker Hub (catalogue Bitnami retiré) — remplacé par un démarrage manuel de \`minio/minio\` (\`docker run\` + attente sur \`/minio/health/live\`) dans le job \`test-backend\`. Le correctif \`stream-json\`/minio de la 0.17.5 (module resolve hook) ne s'appliquait qu'à l'entrypoint de production, pas aux tests Vitest eux-mêmes (qui n'y passent jamais) — les deux \`vitest.config.ts\` injectent maintenant le même hook via \`NODE_OPTIONS\` (\`backend/vitest.node-options.ts\`), vérifié sur Linux (conteneur) et Windows.
- Documentation : la page de wiki [Guide de démarrage](/pages/documentation/guide-demarrage) gagne une page [Déploiement](/pages/documentation/guide-demarrage/deploiement) (production, CI/CD, tunnel Cloudflare — même contenu que \`README.md\` §6) ; le \`README.md\` perd son ancien backlog de tickets (EPIC-01 à EPIC-22, ordre de développement suggéré) devenu obsolète une fois l'essentiel implémenté, ne garde que la référence technique (stack, architecture, modèle de données, endpoints, installation).

</details>

<details>
<summary>0.17.5 — 2026-09-07</summary>

- Migrations automatiques au déploiement : \`backend/entrypoint.sh\` (\`pnpm run migration:run\` puis \`node dist/main.js\`, \`set -e\` — le conteneur ne démarre pas si une migration échoue) ; \`docker-compose.yml\` gagne les services \`backend\`/\`frontend\`.
- Déploiement continu : \`.github/workflows/deploy.yml\`, déclenché uniquement après succès de la CI sur \`main\` (\`workflow_run\`, jamais sur une PR) — connexion SSH au serveur via tunnel Cloudflare (\`cloudflared\`), \`git pull\` puis \`docker compose up -d --build\`. Premier déploiement sur un serveur vierge : échec attendu (les \`.env\` ne sont pas commités) jusqu'à leur création manuelle une fois.
- \`README.md\` §9 : guide d'installation locale et de déploiement (prérequis, secrets GitHub, configuration du tunnel Cloudflare).
- Corrigé au passage : \`minio@8.0.7\` importe \`stream-json/jsonl/Parser.js\` (casse pré-3.x) alors que le \`stream-json: 3.6.0\` imposé par le correctif de sécurité Dependabot (OPS-010) a renommé ce fichier en minuscules — silencieusement toléré sur système de fichiers insensible à la casse (Windows/macOS, donc invisible en dev), mais faisait planter tout conteneur Docker (Linux) au démarrage. Corrigé par un hook de résolution de module Node natif (\`backend/scripts/\`, chargé via \`node --import\` dans l'entrypoint) plutôt qu'un patch pnpm sur la dépendance ou une rétrogradation.

</details>

<details>
<summary>0.17.4 — 2026-09-07</summary>

- Pipeline CI (\`.github/workflows/ci.yml\`) : lint backend/frontend en parallèle, tests backend (unitaires + e2e, services \`mysql:8\` et \`bitnami/minio\` — \`minio/minio\` seul n'est pas utilisable comme service container GitHub Actions, son CMD par défaut n'affiche que l'aide) et tests frontend sur chaque PR vers \`main\` ; build Docker (\`backend/Dockerfile\`, \`frontend/Dockerfile\`, tous deux ajoutés et testés localement) uniquement sur push vers \`main\`, après succès des jobs précédents. Pas de déploiement automatique dans ce pipeline.

</details>

<details>
<summary>0.17.3 — 2026-09-07</summary>

- Tests frontend (Vitest + Testing Library + jsdom, \`frontend/src/**/*.test.tsx\`) : soumission du formulaire de connexion (appel de \`login()\`, message d'erreur affiché en cas d'échec), auto-génération du slug depuis le titre dans le formulaire de métadonnées de page, rendu et surbrillance du nœud actif dans l'arborescence sur plusieurs niveaux. Les dépendances des composants (auth, arbre de pages) sont injectées directement via leurs contextes React plutôt que par un appel API réel.

</details>

<details>
<summary>0.17.2 — 2026-09-07</summary>

- Tests e2e backend (Vitest + Supertest, \`backend/test/*.e2e-spec.ts\`) sur une base MySQL de test dédiée (\`openwiki_test\`), migrée automatiquement avant la suite : inscription → connexion → profil, page créée → éditée → restaurée (historique de versions vérifié), et les cas d'erreur (email dupliqué, mauvais mot de passe, rôle insuffisant). Chaque test repart d'une base vidée (\`TRUNCATE\`).

</details>

<details>
<summary>0.17.1 — 2026-09-07</summary>

- Tests unitaires backend sur la logique métier critique (\`pages.service.ts\`, \`media.service.ts\`, \`versions.service.ts\`, \`RolesGuard\`, \`JwtAuthGuard\`), via Vitest + \`@nestjs/testing\` avec repositories mockés — couverture ≥ 70% sur ces fichiers.

</details>

## Version 0.16

<details>
<summary>0.16.10 — 2026-09-07</summary>

- Alertes de sécurité Dependabot traitées : \`undici\`, \`tmp\`, \`decode-uri-component\`, \`qs\`, \`stream-json\` (dépendances transitives) forcés vers leurs versions corrigées via \`pnpm-workspace.yaml\` (\`overrides\`). \`.github/dependabot.yml\` ajouté (npm, une seule entrée à la racine du monorepo pnpm — \`pnpm-lock.yaml\` et \`pnpm-workspace.yaml\` y vivent, une entrée par sous-dossier casse la mise à jour du lockfile partagé — hebdomadaire, groupé sur les mises à jour de sécurité) : couvre les *version updates* pnpm (scan hebdomadaire), GitHub ne proposant pas encore de *security updates* automatiques (PR déclenchée par une alerte) pour cet écosystème.

</details>

<details>
<summary>0.16.9 — 2026-09-07</summary>

- Page journal d'audit admin (\`/admin/audit-log\`, réservée admin) : historique paginé des actions admin sensibles (date, admin, action, cible), filtrable par admin et par type d'action.

</details>

<details>
<summary>0.16.8 — 2026-09-07</summary>

- Affichage dédié du verrouillage de compte (\`423\`) sur le formulaire de connexion : message explicite avec décompte jusqu'au déverrouillage (lu depuis le header \`Retry-After\`), plutôt que l'erreur générique de mauvais mot de passe. CORS expose désormais \`Retry-After\` (\`exposedHeaders\`) pour que le frontend puisse le lire.

</details>

<details>
<summary>0.16.7 — 2026-09-07</summary>

- Widget Cloudflare Turnstile sur les formulaires de connexion et d'inscription : le formulaire ne peut pas être soumis tant que le widget n'a pas produit de token valide, transmis dans le payload de soumission. Variable \`VITE_TURNSTILE_SITE_KEY\` (\`frontend/.env\`).
- \`POST /auth/register\` délivre désormais directement les cookies d'authentification (comme \`/auth/login\`) au lieu de nécessiter un second appel à \`/auth/login\` juste après l'inscription — un token Turnstile est à usage unique, le réutiliser pour une seconde vérification aurait échoué.

</details>

<details>
<summary>0.16.6 — 2026-09-07</summary>

- Politique de mot de passe renforcée sur \`POST /auth/register\` : en plus des 8 caractères minimum, le mot de passe doit contenir une majuscule, un chiffre et un caractère spécial (\`400\` sinon). Détection de fuite via l'API haveibeenpwned (k-anonymity, seul un préfixe SHA-1 à 5 caractères est transmis) — mot de passe déjà compromis → \`400\` ; API injoignable → inscription non bloquée (fail-open), erreur loguée côté serveur.

</details>

<details>
<summary>0.16.5 — 2026-09-07</summary>

- Journal d'audit des actions admin sensibles (\`AdminAuditLog\` : admin, action, cible, métadonnées bornées) : chaque changement de rôle et suppression d'utilisateur (REST \`/admin/users\` comme MCP \`wiki_update_user_role\`) crée une entrée. \`GET /admin/audit-log\` (admin, filtrable par \`adminId\`/\`action\`, paginé).

</details>

<details>
<summary>0.16.4 — 2026-09-07</summary>

- Headers de sécurité HTTP standard sur toutes les réponses via \`helmet\` (config par défaut : \`Strict-Transport-Security\`, \`X-Content-Type-Options\`, \`X-Frame-Options\`, etc.). CORS déjà strict (origine limitée à \`FRONTEND_URL\`, pas de wildcard).

</details>

<details>
<summary>0.16.3 — 2026-09-07</summary>

- Verrouillage de compte après échecs répétés : 5 échecs de connexion consécutifs verrouillent le compte 15 minutes (\`POST /auth/login\` → \`423 Locked\` avec header \`Retry-After\`), même avec le bon mot de passe une fois verrouillé. Une connexion réussie remet le compteur d'échecs à zéro.

</details>

<details>
<summary>0.16.2 — 2026-09-07</summary>

- Vérification Cloudflare Turnstile sur \`POST /auth/login\` et \`POST /auth/register\` : le token \`turnstileToken\` transmis dans le body est validé auprès de Cloudflare avant toute vérification d'email/mot de passe. Token manquant ou invalide → \`400\`, sans fuite d'information sur l'existence d'un compte. Nouvelle variable \`TURNSTILE_SECRET_KEY\` (\`backend/.env\`) — si absente, la vérification est ignorée (utile en dev tant que la clé n'est pas configurée).

</details>

<details>
<summary>0.16.1 — 2026-09-07</summary>

- Rate limiting dédié, plus strict que la limite globale, sur \`POST /auth/register\`, \`POST /auth/login\` et \`POST /auth/refresh\` : 5 requêtes/minute/IP.

</details>

<details>
<summary>0.16.0 — 2026-09-07</summary>

- Rate limiting global sur toute l'API : 100 requêtes/minute/IP (\`@nestjs/throttler\`), résolution de l'IP réelle derrière un proxy via \`X-Forwarded-For\`. Dépassement → \`429 Too Many Requests\` avec header \`Retry-After\`.

</details>

## Version 0.15

<details>
<summary>0.15.12 — 2026-09-05</summary>

- Page "Intégration MCP" : ajout d'un exemple de connexion via le CLI Claude Code (\`claude mcp add --transport http ...\`), en complément de l'exemple de configuration JSON générique.

</details>

<details>
<summary>0.15.11 — 2026-09-05</summary>

- Page de documentation "Intégration MCP" (\`/pages/documentation/mcp\`) : création de clé API, scopes disponibles, connexion d'un client MCP, référence des tools par domaine, lien vers le journal d'audit.

</details>

<details>
<summary>0.15.10 — 2026-09-05</summary>

- Page journal d'activité MCP (\`/admin/mcp/audit-log\`, réservée admin) : historique paginé des appels d'outils, filtrable par clé API (\`?apiKeyId=\`, conservé dans l'URL), détail complet (input/output JSON, message d'erreur) au clic sur une ligne.

</details>

<details>
<summary>0.15.9 — 2026-09-05</summary>

- Page de gestion des clés API MCP (\`/admin/mcp/api-keys\`, réservée admin) : création avec sélection des scopes, révélation unique de la clé en clair (confirmation demandée si fermeture sans avoir copié), révocation confirmée par boîte de dialogue (clé grisée plutôt que supprimée de la liste).

</details>

<details>
<summary>0.15.8 — 2026-09-05</summary>

- Journal d'audit des actions MCP : chaque appel de tool (succès ou échec) est tracé (\`McpAuditLog\` : clé API, tool, input/output tronqués à 500 car., succès, message d'erreur), via un wrapper générique autour du dispatch des tools — rien à ajouter dans chaque tool. \`lastUsedAt\` de la clé API est mis à jour à chaque appel réussi. \`GET /admin/mcp/audit-log\` (admin, filtrable par clé, paginé) alimente FE-071.

</details>

<details>
<summary>0.15.7 — 2026-09-05</summary>

- Tool MCP de recherche : \`wiki_search\` (scope \`search:read\` ou \`pages:read\`, l'un des deux suffit). Une clé avec uniquement \`pages:write\` (aucun scope de lecture) ne peut pas l'appeler.

</details>

<details>
<summary>0.15.6 — 2026-09-05</summary>

- Tool MCP d'upload de médias : \`wiki_upload_image\` (fichier transmis en base64, décodé puis validé avec la même logique que l'upload REST — taille, type MIME), \`wiki_get_media_url\` (scopes \`media:read\`/\`media:write\`). Un base64 malformé ou un fichier trop volumineux sont rejetés avant tout appel à Minio.
- La limite de taille du corps JSON de l'API est relevée à 30 Mo (\`GET/POST /api/*\`) pour permettre le transport d'images en base64 par MCP ; l'upload REST multipart (\`/media/upload\`) n'est pas concerné et reste inchangé.

</details>

<details>
<summary>0.15.5 — 2026-09-05</summary>

- Tools MCP de gestion des utilisateurs : \`wiki_create_user\`, \`wiki_list_users\`, \`wiki_update_user_role\` (scopes \`users:read\`/\`users:write\`). Le mot de passe temporaire généré à la création n'est jamais renvoyé. Ces tools sont invisibles dans \`tools/list\` pour une clé sans le scope requis, pas juste refusés à l'appel.

</details>

<details>
<summary>0.15.4 — 2026-09-05</summary>

- Tools MCP de gestion des tags : \`wiki_create_tag\`, \`wiki_list_tags\`, \`wiki_tag_page\`, \`wiki_untag_page\` (scopes \`tags:read\`/\`tags:write\`). \`wiki_tag_page\` avec un \`tagId\` inexistant renvoie une erreur explicite invitant à créer le tag d'abord.
- Correctif : \`POST /pages/:id/tags\` (REST et MCP) vérifiait l'accès à la page comme un visiteur anonyme et rejetait donc le tagging de ses propres pages privées/non publiées ; l'identité de l'appelant est maintenant transmise à la vérification.

</details>

<details>
<summary>0.15.3 — 2026-09-05</summary>

- Tools MCP de gestion des pages : \`wiki_create_page\`, \`wiki_update_page\`, \`wiki_get_page\`, \`wiki_list_pages\`, \`wiki_delete_page\`, \`wiki_publish_page\` (scopes \`pages:read\`/\`pages:write\`). Une clé avec un scope pages voit les pages privées/non publiées comme un éditeur, pas comme un visiteur anonyme.

</details>

<details>
<summary>0.15.2 — 2026-09-05</summary>

- Authentification MCP par clé API à scopes : entité \`McpApiKey\`, \`POST/GET/DELETE /admin/mcp/api-keys\` (admin uniquement). La clé en clair n'est affichée qu'à la création ; une clé révoquée (ou absente) est rejetée par le guard MCP avec une erreur JSON-RPC (\`code: -32001\`) plutôt qu'un \`401\` REST classique.

</details>

<details>
<summary>0.15.1 — 2026-09-05</summary>

- Socle du serveur MCP (\`@modelcontextprotocol/sdk\`) : \`POST/GET/DELETE /mcp\`, transport HTTP streamable avec gestion de session. Aucun tool enregistré à ce stade — un client MCP peut se connecter et lister les tools via \`tools/list\` (liste vide).

</details>

<details>
<summary>0.15.0 — 2026-09-05</summary>

- Entités \`Tag\`/\`PageTag\` + endpoints CRUD : \`POST/GET /tags\`, \`DELETE /tags/:id\` (cascade sur les associations), \`POST/DELETE /pages/:id/tags\`. Chaque tag a une couleur (hex) choisie à la création.

</details>

## Version 0.14

<details>
<summary>0.14.3 — 2026-09-05</summary>

- La langue de l'interface suit désormais le réglage global (\`GET /settings\`, sans authentification) au chargement de l'application, pour tous les visiteurs — aucune préférence par utilisateur, pas de \`localStorage\`.
- Depuis le panel admin, changer la langue (FE-064) retraduit désormais réellement l'UI de l'admin immédiatement ; les autres visiteurs l'appliquent à leur prochain chargement.

</details>

<details>
<summary>0.14.2 — 2026-09-05</summary>

- Intégration \`react-i18next\` : toute la chrome applicative (menus, formulaires, messages, dates relatives) passe désormais par \`useTranslation()\`/\`t()\`, avec des dictionnaires FR/EN complets — le contenu markdown des pages reste, lui, jamais traduit automatiquement.

</details>

<details>
<summary>0.14.1 — 2026-09-05</summary>

- \`GET /settings\` (public, sans authentification) : réglages système exposés à plat (ex. \`{ "locale": "fr" }\`), nécessaire pour les visiteurs non connectés.
- \`PATCH /admin/settings/:key\` (admin) : modifie un réglage, validation dépendant de la clé (\`locale\` limité à \`fr\`/\`en\` pour l'instant) → \`400\` sinon.

</details>

<details>
<summary>0.14.0 — 2026-09-05</summary>

- Entité \`SystemSetting\` (clé/valeur) + migration : socle des réglages système globaux, seedée avec \`locale=fr\`.

</details>

## Version 0.13

<details>
<summary>0.13.1 — 2026-09-05</summary>

- Sélecteur de langue FR/EN dans les paramètres d'administration (\`/admin/settings\`), appelle \`PATCH /admin/settings/locale\`. Réglage global, pas par utilisateur.
- ⚠️ Le socle i18n et l'endpoint \`/admin/settings/:key\` restent à livrer par EPIC-21 : ce sélecteur appellera un endpoint pas encore implémenté tant qu'EPIC-21 n'est pas posé.

</details>

<details>
<summary>0.13.0 — 2026-09-05</summary>

- Page d'administration des utilisateurs (\`/admin/users\`, réservée admin) : liste, changement de rôle inline et suppression (confirmée par boîte de dialogue) — un admin ne peut ni se rétrograder ni se supprimer lui-même (action désactivée sur sa propre ligne).
- Lien "Administration" du menu utilisateur relié à cette page.

</details>

## Version 0.12

<details>
<summary>0.12.4 — 2026-09-03</summary>

- Panneau "Droits d'édition" dans l'éditeur de page (réservé admin) : liste des éditeurs grantés explicitement sur la page, ajout via une recherche d'utilisateur, révocation confirmée par boîte de dialogue.

</details>

<details>
<summary>0.12.3 — 2026-09-03</summary>

- Révocation d'un droit d'édition (\`DELETE /pages/:id/permissions/:userId\`, admin) : \`204\` si un grant explicite existait sur cette page précise, \`404\` sinon — révoquer un droit hérité d'une page ancêtre (au lieu d'un grant explicite sur la page ciblée) échoue volontairement en \`404\`, sans effet sur l'héritage.

</details>

<details>
<summary>0.12.2 — 2026-09-03</summary>

- Création et consultation des droits d'édition explicites d'une page (\`POST\`/\`GET /pages/:id/permissions\`, admin) : un doublon \`(pageId, userId)\` renvoie \`409\`, la liste ne renvoie que les grants définis directement sur cette page (jamais les grants hérités). \`PATCH /pages/:id\` accepte désormais aussi un \`reader\` disposant d'un grant sur la page (la restriction éditeur/admin ne s'appliquait jusque-là qu'aux autres routes de mutation).

</details>

<details>
<summary>0.12.1 — 2026-09-03</summary>

- Résolution du droit d'édition effectif d'une page : un \`reader\` global avec un grant explicite sur une page hérite du droit d'édition sur toute sa sous-arborescence (le grant le plus proche dans l'arbre l'emporte), \`editor\`/\`admin\` globaux ne sont jamais bloqués. Appliqué avant modification, déplacement, suppression et publication d'une page.

</details>

<details>
<summary>0.12.0 — 2026-09-03</summary>

- Entité \`PagePermission\` + migration : modélise les grants d'édition par page (\`pageId\`, \`userId\`, \`grantedById\`), unique sur \`(pageId, userId)\`.

</details>

## Version 0.11

<details>
<summary>0.11.1 — 2026-09-03</summary>

- Page de résultats de recherche complète (\`/search?q=&page=\`) : pagination synchronisée avec l'URL (bookmarkable), terme recherché surligné dans le titre et l'extrait de chaque résultat.
- La recherche utilise désormais le mode booléen MySQL avec préfixe (\`terme*\`) plutôt que le mode langage naturel, pour que taper un début de mot (ex. "note") remonte aussi les mots qui le contiennent (ex. "Notes").

</details>

<details>
<summary>0.11.0 — 2026-09-03</summary>

- Barre de recherche globale (\`Ctrl+K\`/\`Cmd+K\` depuis n'importe quelle route, ou clic sur la barre dans la Topbar) : dialog de commande avec débounce de 300 ms, titre + extrait par résultat, navigation directe vers la page au clic.

</details>

## Version 0.10

<details>
<summary>0.10.1 — 2026-09-03</summary>

- Endpoint de recherche full-text (\`GET /search?q=&page=&limit=\`) : recherche \`MATCH...AGAINST\` sur le titre et le contenu de la version courante de chaque page, résultats triés par pertinence avec un extrait généré autour du terme trouvé. Authentification optionnelle : les lecteurs anonymes ou non-éditeurs ne voient que les pages publiques et publiées, les éditeurs/admins voient tout.

</details>

<details>
<summary>0.10.0 — 2026-09-03</summary>

- Index FULLTEXT MySQL sur \`page_versions\` (\`title\`, \`content\`) pour préparer la recherche full-text.

</details>

## Version 0.9

<details>
<summary>0.9.2 — 2026-09-02</summary>

- Action "Restaurer" sur chaque version de l'historique (\`POST /pages/:id/versions/:versionId/restore\`, éditeur+), confirmation via boîte de dialogue, puis rafraîchissement de la liste : la version restaurée apparaît en haut avec le résumé auto-généré côté backend.

</details>

<details>
<summary>0.9.1 — 2026-09-02</summary>

- Vue diff entre les deux versions sélectionnées dans l'historique : diff ligne à ligne (\`POST /pages/:id/versions/diff\`), lignes ajoutées/supprimées mises en couleur, lignes identiques non colorées, en-tête affichant la date de chaque version comparée.

</details>

<details>
<summary>0.9.0 — 2026-09-02</summary>

- Historique des versions d'une page (\`/history/*\`) : liste paginée (auteur, date relative, résumé), sélection de deux versions au maximum (cocher une 3e ligne décoche automatiquement la plus ancienne sélection), aperçu du contenu d'une version.
- Bouton "Historique" sur la vue d'une page, visible selon les mêmes droits de visibilité que la page elle-même.

</details>

## Version 0.8

<details>
<summary>0.8.4 — 2026-09-02</summary>

- Nouvelle direction artistique de l'éditeur de page (création et modification), alignée sur la maquette : vue plein écran sans navigation latérale, panneau de métadonnées permanent (titre, chemin, page parente, visibilité), barre d'outils markdown (gras, italique, code, lien, image, pièce jointe) et actions "Enregistrer le brouillon" / "Publier".
- En modification, le résumé de modification est désormais un champ permanent du panneau plutôt qu'une boîte de dialogue, et le déplacement de la page (page parente) s'applique immédiatement.

</details>

<details>
<summary>0.8.3 — 2026-09-02</summary>

- Boîte de dialogue de sauvegarde avec champ "résumé de modification" (optionnel), ouverte par le bouton Sauvegarder ou \`Ctrl+S\`/\`Cmd+S\` sur l'éditeur de page ; confirmation par toast une fois la sauvegarde effectuée.

</details>

<details>
<summary>0.8.2 — 2026-09-02</summary>

- Formulaire de métadonnées de page (titre, slug auto-généré et éditable, visibilité, sélection de la page parente via une recherche dans l'arborescence) et page "Nouvelle page" (\`/new\`), reliée au bouton de la barre latérale pour les éditeurs et admins.

</details>

<details>
<summary>0.8.1 — 2026-09-02</summary>

- Upload d'images depuis l'éditeur : bouton toolbar et glisser-déposer directement sur la zone d'édition, insertion automatique du markdown à la position du curseur.
- Notifications (toasts) pour les erreurs d'upload (fichier trop volumineux, type non supporté).

</details>

<details>
<summary>0.8.0 — 2026-09-02</summary>

- Éditeur markdown avec prévisualisation live (split view, bascule mobile édition/aperçu, debounce, raccourci \`Ctrl+S\`/\`Cmd+S\`, confirmation de sortie si modifications non sauvegardées).
- Page \`/edit/*\` (éditeur+) pour modifier une page existante, accessible via un bouton "Modifier" sur la vue d'une page.

</details>

## Version 0.7

<details>
<summary>0.7.4 — 2026-09-02</summary>

- \`DELETE /media/:id\` (éditeur+) : supprime un attachment (fichier Minio puis ligne en base, dans cet ordre).

</details>

<details>
<summary>0.7.3 — 2026-09-02</summary>

- \`GET /media/:id/url\` (selon visibilité) : génère une URL présignée pour un attachment existant.

</details>

<details>
<summary>0.7.2 — 2026-09-02</summary>

- \`GET /media?pageId=\` (selon visibilité) : liste les médias rattachés à une page, avec URL présignée pour chacun.

</details>

<details>
<summary>0.7.1 — 2026-09-02</summary>

- \`POST /media/upload\` (éditeur+, multipart/form-data) : upload d'un fichier vers Minio, clé \`pages/{pageId}/{uuid}-{filename}\`, enregistrement en \`Attachment\` et retour d'une URL présignée. Limite de 20 Mo et whitelist de types MIME (images + documents courants).

</details>

<details>
<summary>0.7.0 — 2026-09-02</summary>

- Entité \`Attachment\` + migration : modélise les fichiers stockés sur Minio (\`pageId\` nullable, \`minioKey\`, \`filename\`, \`mimeType\`, \`size\`, \`uploadedById\`), index sur \`pageId\` pour \`GET /media?pageId=\`.

</details>

## Version 0.6

<details>
<summary>0.6.6 — 2026-09-02</summary>

- Documentation interactive de l'API (\`GET /api/docs\`, \`GET /api/docs-json\`) générée depuis les décorateurs \`@nestjs/swagger\`.
- Page "Endpoints" reliée à cette documentation via un composant de référence intégré au rendu markdown.

</details>

<details>
<summary>0.6.5 — 2026-09-01</summary>

- \`POST /pages/:id/versions/:versionId/restore\` : rollback vers une ancienne version (crée une nouvelle version, l'historique reste intact).

</details>

<details>
<summary>0.6.4 — 2026-09-01</summary>

- \`POST /pages/:id/versions/diff\` : diff ligne à ligne entre deux versions (\`from\`/\`to\` en body plutôt qu'en query).

</details>

<details>
<summary>0.6.3 — 2026-09-01</summary>

- \`GET /pages/:id/versions/:versionId\` : détail d'une version précise, vérifie qu'elle appartient bien à la page.

</details>

<details>
<summary>0.6.2 — 2026-09-01</summary>

- \`GET /pages/:id/versions\` : historique paginé des versions d'une page, droits alignés sur sa visibilité.

</details>

<details>
<summary>0.6.1 — 2026-09-01</summary>

- Entité \`PageVersion\` + migration : index sur \`pageId\` pour accélérer l'historique des versions d'une page.

</details>

## Version 0.5

<details>
<summary>0.5.4 — 2026-09-01</summary>

- Icônes de dossier/page dans l'arborescence, alignées façon VS Code (chevron avant l'icône).
- En-tête pleine largeur avec logo OpenWiki.
- Barre de filtre et bouton "Nouvelle page" (aperçu) dans la barre latérale.

</details>

<details>
<summary>0.5.3 — 2026-09-01</summary>

- Page de visualisation d'une page : rendu markdown, coloration syntaxique des blocs de code, images.
- Résolution par chemin complet (arborescence), pas par simple slug.
- États de chargement, page introuvable (404) et accès refusé (403).

</details>

<details>
<summary>0.5.2 — 2026-09-01</summary>

- Fournisseur de contexte de l'arborescence des pages et composant fil d'ariane (breadcrumb).

</details>

<details>
<summary>0.5.1 — 2026-09-01</summary>

- Script de seed de développement et composants d'arborescence des pages côté frontend.

</details>

## Version 0.4

<details>
<summary>0.4.8 — 2026-09-01</summary>

- Module de gestion des pages : entité, migration, création, modification, déplacement, suppression (cascade), publication et arborescence.

</details>

## Version 0.3

<details>
<summary>0.3.5 — 2026-08-30</summary>

- Initialisation du frontend (React, Vite, TypeScript) et parcours d'authentification (connexion, inscription, cookies).

</details>

## Version 0.2

<details>
<summary>0.2.8 — 2026-08-30</summary>

- Authentification et gestion des utilisateurs : inscription, connexion JWT, rafraîchissement de token, profils, pagination.

</details>

## Version 0.1

<details>
<summary>0.1.4 — 2026-08-29</summary>

- Mise en place du monorepo pnpm (backend/frontend), Docker Compose (MySQL + Minio) et intégration du stockage d'objets.

</details>`,
      },
    ],
  },
];

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  synchronize: false,
  entities: [User, Page, PageVersion, Tag, PageTag],
});

async function resolveContentAuthorId(dataSource: DataSource): Promise<string> {
  const userRepository = dataSource.getRepository(User);
  const [oldest] = await userRepository.find({
    order: { createdAt: 'ASC' },
    take: 1,
  });
  if (!oldest) {
    throw new Error(
      'No user found in database — create an admin user before running the content seed.',
    );
  }
  return oldest.id;
}

async function seedTags(dataSource: DataSource): Promise<Map<string, string>> {
  const tagRepository = dataSource.getRepository(Tag);
  const tagIdByName = new Map<string, string>();

  for (const seed of TAG_SEED) {
    let tag = await tagRepository.findOneBy({ name: seed.name });
    if (!tag) {
      tag = await tagRepository.save(
        tagRepository.create({ name: seed.name, color: seed.color }),
      );
      console.log(`Created tag "${seed.name}".`);
    } else if (tag.color !== seed.color) {
      tag.color = seed.color;
      tag = await tagRepository.save(tag);
      console.log(`Updated color of tag "${seed.name}".`);
    }
    tagIdByName.set(seed.name, tag.id);
  }

  return tagIdByName;
}

async function seedPageTags(
  dataSource: DataSource,
  pageId: string,
  tagNames: string[],
  tagIdByName: Map<string, string>,
): Promise<void> {
  const pageTagRepository = dataSource.getRepository(PageTag);

  for (const tagName of tagNames) {
    const tagId = tagIdByName.get(tagName);
    if (!tagId) {
      continue;
    }

    const existing = await pageTagRepository.findOneBy({ pageId, tagId });
    if (!existing) {
      await pageTagRepository.save(pageTagRepository.create({ pageId, tagId }));
      console.log(`Tagged page "${pageId}" with "${tagName}".`);
    }
  }
}

async function seedPage(
  dataSource: DataSource,
  seed: PageSeed,
  parentId: string | null,
  authorId: string,
  tagIdByName: Map<string, string>,
): Promise<Page> {
  const pageRepository = dataSource.getRepository(Page);
  const versionRepository = dataSource.getRepository(PageVersion);

  let page = await pageRepository.findOneBy({
    slug: seed.slug,
    parentId: parentId === null ? IsNull() : parentId,
  });
  const content = seed.content ?? `# ${seed.title}`;

  if (!page) {
    page = await pageRepository.save(
      pageRepository.create({
        slug: seed.slug,
        title: seed.title,
        parentId,
        visibility: 'public',
        commentsEnabled: false,
        createdById: authorId,
      }),
    );

    const version = await versionRepository.save(
      versionRepository.create({
        pageId: page.id,
        title: seed.title,
        content,
        authorId,
      }),
    );

    page.currentVersionId = version.id;
    await pageRepository.save(page);
    console.log(`Created page "${seed.slug}".`);
  } else {
    const currentVersion = page.currentVersionId
      ? await versionRepository.findOneBy({ id: page.currentVersionId })
      : null;
    const contentChanged =
      currentVersion?.content !== content || page.title !== seed.title;
    const commentsSettingChanged = page.commentsEnabled !== false;

    if (commentsSettingChanged) {
      page.commentsEnabled = false;
    }

    if (contentChanged) {
      const version = await versionRepository.save(
        versionRepository.create({
          pageId: page.id,
          title: seed.title,
          content,
          authorId,
          changeSummary: 'Content seed update',
        }),
      );

      page.title = seed.title;
      page.currentVersionId = version.id;
    }

    if (contentChanged || commentsSettingChanged) {
      page = await pageRepository.save(page);
      console.log(
        contentChanged
          ? `Updated page "${seed.slug}".`
          : `Disabled comments on page "${seed.slug}".`,
      );
    } else {
      console.log(`Page "${seed.slug}" already up to date, skipping.`);
    }
  }

  if (seed.tags?.length) {
    await seedPageTags(dataSource, page.id, seed.tags, tagIdByName);
  }

  for (const child of seed.children ?? []) {
    await seedPage(dataSource, child, page.id, authorId, tagIdByName);
  }

  return page;
}

async function run(): Promise<void> {
  await dataSource.initialize();

  const authorId = await resolveContentAuthorId(dataSource);
  const tagIdByName = await seedTags(dataSource);
  for (const root of PAGE_TREE_SEED) {
    await seedPage(dataSource, root, null, authorId, tagIdByName);
  }

  await dataSource.destroy();
  console.log('Content seed complete.');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
