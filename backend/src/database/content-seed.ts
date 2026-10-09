import 'dotenv/config';
import { DataSource, IsNull } from 'typeorm';
import { Page } from '../pages/entities/page.entity.js';
import { PageVersion } from '../pages/entities/page-version.entity.js';
import { PageTag } from '../tags/entities/page-tag.entity.js';
import { Tag } from '../tags/entities/tag.entity.js';
import { User } from '../users/entities/user.entity.js';
import {
  loadChangelog,
  parseChangelog,
  renderReleaseNotesPage,
} from './release-notes.js';

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
  <h1>Documentation NestWiki</h1>
  <p>Tout ce qu'il faut pour installer, configurer, déployer et utiliser NestWiki — utilisez l'arborescence à gauche pour naviguer, ou les raccourcis ci-dessous.</p>
</div>

<div class="doc-link-grid">
  <a class="doc-link-card" href="/pages/documentation/guide-demarrage">
    <strong>Guide de démarrage</strong>
    <span>Installer, configurer et lancer NestWiki en local</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/guide-demarrage/deploiement">
    <strong>Déploiement</strong>
    <span>Mise en production avec Docker Compose et CI/CD</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/endpoints">
    <strong>Endpoints</strong>
    <span>Référence complète de l'API REST</span>
  </a>
  <a class="doc-link-card" href="/pages/documentation/apercus-de-liens">
    <strong>Aperçus de liens</strong>
    <span>Cartes Discord et Open Graph de chaque page</span>
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

Ce guide couvre l'installation locale, la configuration, et le déploiement en production de NestWiki, de bout en bout.

## Vue d'ensemble

NestWiki est un monorepo pnpm avec deux packages : \`backend/\` (NestJS + TypeORM + MySQL) et \`frontend/\` (React + Vite). Les pages [Installation](/pages/documentation/guide-demarrage/installation), [Configuration](/pages/documentation/guide-demarrage/configuration) et [Déploiement](/pages/documentation/guide-demarrage/deploiement) détaillent chaque étape ; ce qui suit résume le parcours local complet.

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
<h3>Compte administrateur</h3>
<p>Renseignez <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> et <code>ADMIN_DISPLAY_NAME</code> dans <code>backend/.env</code> : le premier admin est créé automatiquement au premier démarrage.</p>
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
- Pour mettre NestWiki en production, voir [Déploiement](/pages/documentation/guide-demarrage/deploiement).`,
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
pnpm run seed:admin       # premier admin (ADMIN_* de backend/.env), aussi créé au démarrage
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
git clone <url-du-dépôt> /chemin/vers/nestwiki
cd /chemin/vers/nestwiki
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

## Aperçus de liens (Discord, Slack, X…)

Les robots d'aperçu de lien n'exécutent pas le JavaScript : servis par la SPA, ils verraient la même carte par défaut pour toutes les pages. \`frontend/nginx.conf\` les repère donc par leur \`User-Agent\` (\`Discordbot\`, \`Twitterbot\`, \`Slackbot\`, \`facebookexternalhit\`, \`LinkedInBot\`, \`WhatsApp\`, \`TelegramBot\`…) et, **uniquement sur \`/pages/*\`**, réécrit la requête en interne vers \`/api/meta/pages/*\` sur le backend. L'URL vue par le robot reste \`/pages/<chemin>\` (pas de redirection), les humains reçoivent toujours la SPA, et toutes les autres routes gardent la carte par défaut de \`index.html\`. Les réponses portent \`Vary: User-Agent\` pour qu'un cache intermédiaire ne serve pas la version robot à un humain (ou l'inverse).

Le backend construit les URLs absolues de la carte (\`og:url\`, boutons) à partir de \`FRONTEND_URL\` : en production, cette variable doit donc être l'URL publique réelle du wiki.

<div class="callout">
  <span class="callout-icon">💡</span>
  <span>Si le frontend est un jour servi autrement que par ce conteneur nginx (CDN, autre reverse proxy), cette règle est à reproduire sur le nouveau point d'entrée, sinon les aperçus retombent sur la carte par défaut. Pour vérifier : <code>curl -A "Discordbot/2.0" https://&lt;hôte&gt;/pages/documentation</code> doit renvoyer le HTML des balises meta, et la même commande sans <code>-A</code> la SPA. Discord garde les aperçus en cache : après un changement, ajoutez un paramètre à l'URL (ex. <code>?v=2</code>) pour forcer un nouvel aperçu.</span>
</div>

## CI/CD

- \`.github/workflows/ci.yml\` — lint + tests (backend + frontend) sur chaque PR vers \`main\` ; build Docker des deux images en plus sur chaque push vers \`main\`. Voir la page [Notes de version](/pages/documentation/notes-de-version) pour le détail des jobs.
- \`.github/workflows/deploy.yml\` — se déclenche uniquement quand \`ci.yml\` vient de réussir sur \`main\` (\`workflow_run\`, jamais sur une PR) : se connecte en SSH au serveur via un tunnel Cloudflare, puis \`git pull && docker compose up -d --build\`.

Le déploiement passe par un tunnel Cloudflare (\`cloudflared\`) plutôt que d'exposer SSH publiquement — sans application Access devant (pas de service token à gérer). À configurer une fois, côté [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) :

1. **Tunnel** — créer un tunnel \`cloudflared\` sur le serveur, avec une route publique (Public Hostname) vers \`ssh://localhost:22\`.
2. **Clé SSH** — générer une paire de clés dédiée au déploiement (\`ssh-keygen -t ed25519 -C "nestwiki-deploy"\`, sans passphrase) et ajouter la clé **publique** à \`~/.ssh/authorized_keys\` de l'utilisateur de déploiement sur le serveur.

Puis, secrets du dépôt GitHub (Settings → Secrets and variables → Actions) :

| Secret | Contenu |
| --- | --- |
| \`DEPLOY_SSH_PRIVATE_KEY\` | Clé **privée** générée à l'étape 2 |
| \`DEPLOY_SSH_HOSTNAME\` | Hostname public du tunnel (étape 1) |
| \`DEPLOY_SSH_USER\` | Utilisateur SSH sur le serveur |
| \`DEPLOY_PATH\` | Chemin absolu du clone git sur le serveur (ex. \`/opt/nestwiki\`) |

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
        slug: 'apercus-de-liens',
        title: 'Aperçus de liens',
        tags: ['documentation'],
        content: `# Aperçus de liens

Quand vous collez le lien d'une page du wiki dans Discord, Slack, X, WhatsApp ou Telegram, la plateforme affiche un aperçu propre à cette page plutôt que la carte générique de NestWiki.

## Ce que montre l'aperçu

Sur **Discord**, une carte aux couleurs du wiki :

- le **titre** de la page ;
- son **fil d'Ariane** (ex. \`Documentation › Guide de démarrage › Installation\`), omis pour une page racine ;
- ses **tags** (8 au maximum, puis \`+N\`) ;
- ses **statistiques** : nombre de vues, de versions, de commentaires et de contributeurs ;
- la **date et l'auteur de la dernière modification** ;
- deux boutons : **Ouvrir la page** et **Modifier**.

Le bouton « Modifier » est affiché à tout le monde, mais il mène à l'éditeur, qui vérifie toujours les droits : un visiteur sans le droit \`page.edit\` sur la page ne pourra pas la modifier (connexion demandée s'il n'est pas connecté).

Les **autres plateformes** utilisent les balises Open Graph : titre de la page, une description du type \`Documentation › Installation · 2 tags · 1 240 vues\` (la partie tags disparaît quand la page n'en a aucun) et l'image habituelle de NestWiki.

## Pages privées

Seules les pages **publiques** ont un aperçu détaillé. Le lien d'une page privée (ou d'une page qui n'existe pas) affiche la carte générique de NestWiki : ni son titre, ni ses tags, ni ses statistiques ne sont divulgués, même si la personne qui colle le lien y a accès. De même, le fil d'Ariane d'une page publique n'affiche jamais ses pages parentes privées.

## Fonctionnement

Les robots des plateformes n'exécutent pas le JavaScript de l'application. Le serveur web du frontend les reconnaît donc à leur \`User-Agent\` et, sur les adresses \`/pages/...\` uniquement, leur sert à la place un petit document HTML généré par le backend (\`GET /api/meta/pages/<chemin>\`). Ce document contient les balises Open Graph et un composant Discord (\`<script id="discord:component-embed">\`) que seul Discord interprète. Les visiteurs humains, eux, reçoivent toujours l'application normale. La configuration côté serveur, la commande pour vérifier ce que reçoit un robot et l'astuce pour forcer un nouvel aperçu malgré le cache des plateformes sont décrites dans la page [Déploiement](/pages/documentation/guide-demarrage/deploiement), section « Aperçus de liens ».

Les statistiques de la carte viennent du même calcul que l'endpoint \`GET /api/pages/<id>/stats\`, et générer un aperçu ne compte pas comme une vue.

## Limites

- Les plateformes **gardent les aperçus en cache** : après une modification de la page, un lien déjà partagé peut montrer l'ancien aperçu.
- L'image de l'aperçu est la même pour toutes les pages.`,
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

NestWiki expose un serveur [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) permettant à un assistant IA compatible (Claude Desktop, Claude Code, etc.) de piloter le wiki directement : créer et modifier des pages, gérer des tags, des utilisateurs, uploader des médias et lancer des recherches.

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
<tr><td><span class="scope-badge">media:read</span></td><td>Obtenir l'adresse d'un média (permanente et présignée)</td></tr>
<tr><td><span class="scope-badge">media:write</span></td><td>Uploader une image</td></tr>
<tr><td><span class="scope-badge">search:read</span></td><td>Rechercher (<code>pages:read</code> suffit aussi)</td></tr>
</tbody>
</table>

Un tool nécessitant un scope absent de la clé n'apparaît même pas dans \`tools/list\`.

## 3. Se connecter avec un client MCP

Le serveur écoute sur \`POST/GET/DELETE /api/mcp\` (transport HTTP streamable, avec gestion de session via l'en-tête \`Mcp-Session-Id\`) et attend la clé API en en-tête \`Authorization: Bearer <clé>\`.

**Avec Claude Code** (CLI \`claude mcp add\`) :

\`\`\`bash
claude mcp add --transport http nestwiki http://localhost:3000/api/mcp \\
  --header "Authorization: Bearer <votre-clé-api-mcp>"
\`\`\`

**Avec un autre client** supportant un serveur MCP distant en HTTP (Claude Desktop, etc.), via un fichier de configuration (adapter la syntaxe exacte au client utilisé) :

\`\`\`json
{
  "mcpServers": {
    "nestwiki": {
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

**Formatage** (aucun scope requis)

| Tool | Rôle |
| --- | --- |
| \`wiki_get_formatting_guide\` | Renvoyer le guide complet du formatage supporté dans les pages ([Marquages disponibles](/pages/documentation/marquages-disponibles)) |

Ce même guide est envoyé dans les instructions du serveur à la connexion : la plupart des clients le donnent directement à l'IA, qui sait alors quelle syntaxe utiliser (encadrés, Mermaid, LaTeX, liens internes, images…).

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
| \`wiki_upload_image\` | Uploader une image (transmise en base64) sur une page ; renvoie \`embedUrl\`, l'adresse permanente à écrire dans le contenu |
| \`wiki_get_media_url\` | Obtenir l'adresse d'un média existant : \`embedUrl\` (permanente, pour le contenu des pages) et \`url\` (présignée, temporaire, pour télécharger) |

**Recherche** (\`search:read\` ou \`pages:read\`)

| Tool | Rôle |
| --- | --- |
| \`wiki_search\` | Rechercher des pages existantes par mot-clé |

## 5. Journal d'audit

Chaque appel de tool (succès ou échec) est tracé — clé utilisée, tool, entrée/sortie (tronquées), statut, message d'erreur. Consultable, filtrable par clé API, depuis [Administration → Journal d'activité MCP](/admin/mcp/audit-log).`,
      },
      {
        slug: 'gestion-utilisateurs-groupes-acces',
        title: 'Gérer les utilisateurs, groupes et accès',
        tags: ['documentation', 'guide'],
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
</style>

# Gérer les utilisateurs, groupes et accès

NestWiki n'a que deux rôles globaux : **admin** (accès à tout, sans exception) et **membre**. Tout le reste — qui peut créer des tags, uploader des médias, modérer les commentaires, gérer les autres utilisateurs, ou lire/éditer telle page précise — est accordé au cas par cas, directement à un utilisateur ou à un groupe.

<div class="callout">
  <span class="callout-icon">💡</span>
  <span>Un utilisateur cumule toujours <strong>ses droits propres</strong> et <strong>ceux de tous les groupes dont il est membre</strong>. Retirer un droit accordé par un groupe ne se fait qu'en quittant le groupe ou en modifiant les droits du groupe lui-même.</span>
</div>

## 1. Permissions globales et permissions par page

Deux familles de droits existent :

- **Permissions globales** — valables sur tout le wiki, indépendamment d'une page précise : \`user.manage\` (gérer les comptes, groupes et leurs accès), \`page.create_root\` (créer une page à la racine), \`tag.create\`/\`tag.delete\`, \`media.upload\`/\`media.delete\`, \`comment.moderate\`.
- **Permissions par page** — accordées sur une page précise, avec une portée : *cette page uniquement* ou *cette page et toutes ses sous-pages* (avec possibilité d'exclure certaines sous-pages de la couverture). Actions possibles : lire, modifier, créer des sous-pages, supprimer, déplacer, gérer la visibilité, gérer les tags, restaurer une version, et gérer les permissions de la page elle-même.

## 2. Les groupes (\`/admin/groups\`)

Un groupe regroupe des utilisateurs pour leur accorder des droits en une fois (ex. « Éditeurs », « Modérateurs »). Réservé aux admins ou à quiconque détient \`user.manage\`.

Depuis la fiche d'un groupe : onglet **Membres** (ajouter/retirer des utilisateurs), **Permissions globales** (cases à cocher), **Accès aux pages** (arborescence du wiki avec cases à cocher à trois états — cocher une page accorde l'accès à toute sa sous-arborescence, décocher une sous-page l'exclut sans toucher au reste).

## 3. Les utilisateurs (\`/admin/users\`)

Depuis la fiche d'un utilisateur, en plus des infos de base (nom, e-mail, rôle, activation, réinitialisation de mot de passe) : onglet **Groupes** (quels groupes il rejoint), **Permissions globales** (droits directs — ceux hérités d'un groupe apparaissent cochés et grisés avec le nom du groupe), **Accès aux pages** (mêmes règles directes que pour un groupe, avec les pages déjà couvertes par un groupe signalées par un badge), et **Permissions effectives** : la vue en lecture seule de tout ce que l'utilisateur peut faire, avec l'origine de chaque droit (direct, ou via tel groupe).

## 4. Depuis une page : le panneau « Accès »

Pas besoin d'accès admin pour partager une page précise : quiconque détient \`page.manage_permissions\` sur une page voit un bouton **Accès** dans sa vue, qui ouvre un panneau listant qui peut faire quoi sur cette page.

- Les règles **directes** (créées depuis cette page) sont éditables et supprimables ici.
- Les règles **héritées** d'une page ancêtre ou d'une portée « tout le wiki » sont affichées en lecture seule, avec un lien vers la page d'origine — elles ne se modifient que depuis là où elles ont été créées.
- Ajouter un accès se fait en une recherche (utilisateur ou groupe), un choix de portée (cette page seule, ou cette page et ses sous-pages) et une sélection d'actions — limitée à ce que vous détenez vous-même sur cette page, pour éviter toute escalade.

## 5. La règle anti-escalade

Quelle que soit l'interface utilisée, une règle simple s'applique partout : **vous ne pouvez jamais accorder à quelqu'un d'autre plus de droits que vous n'en avez vous-même** — ni en lui donnant un accès direct, ni en l'ajoutant à un groupe qui en détient davantage que vous. Toute tentative renvoie une erreur plutôt que de silencieusement échouer ou de réduire la demande.

Toutes ces actions sont tracées dans le [journal d'audit](/admin/audit-log).`,
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

> [!NOTE]
> Les fonctionnalités marquées <span class="mode-badge pages-only">Pages uniquement</span> sur cette page (HTML/CSS libre, LaTeX) ne s'appliquent qu'au **contenu des pages**, réservé aux comptes editor/admin. Les **commentaires** restent en Markdown restreint pour tous les utilisateurs authentifiés.

## Markdown de base

La syntaxe [CommonMark](https://commonmark.org/) + [GFM](https://github.github.com/gfm/) habituelle fonctionne partout (pages et commentaires) : titres, listes, tableaux, blocs de code, liens, images, citations, texte barré, cases à cocher.

<div class="markup-example">
<div>
<div class="markup-label">Markdown</div>
<pre>#### Titre
- **gras**, *italique*, ~~barré~~
- [lien](https://exemple.fr)
- \`code en ligne\`
| A | B |
|---|---|
| 1 | 2 |</pre>
</div>
<div>
<div class="markup-label">Rendu</div>

#### Titre

- **gras**, *italique*, ~~barré~~
- [lien](https://exemple.fr)
- \`code en ligne\`

| A | B |
|---|---|
| 1 | 2 |

</div>
</div>

## Ancres et sommaire

<span class="mode-badge pages-only">Pages uniquement</span>

Chaque titre d'une page reçoit une ancre dérivée de son texte : \`## Guide de démarrage\` devient \`#guide-de-démarrage\` (minuscules, espaces remplacés par des tirets, ponctuation retirée ; un titre en double reçoit \`-1\`, \`-2\`…). Survolez un titre et cliquez sur l'icône de lien qui apparaît pour obtenir l'adresse de la section, à partager ou à utiliser dans un lien : \`[voir l'installation](#installation)\`. Un \`id\` écrit à la main dans un titre HTML (\`<h2 id="mon-ancre">\`) est conservé.

Dès qu'une page compte au moins deux titres de niveau 1 à 3, un **sommaire** « Sur cette page » est généré automatiquement, présenté en arborescence : dans une colonne à droite sur grand écran, avec la section en cours de lecture mise en évidence, ou dans un bloc repliable au-dessus du contenu sur les écrans plus petits.

## Encadrés

Une citation qui commence par \`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\` ou \`[!CAUTION]\` devient un encadré coloré (même syntaxe que GitHub). Le texte écrit après le marqueur, sur la même ligne, remplace le titre par défaut. Fonctionne aussi dans les commentaires.

<div class="markup-example">
<div>
<div class="markup-label">Markdown</div>
<pre>&gt; [!TIP]
&gt; Utilisez la recherche pour retrouver une page.

&gt; [!WARNING] Migration requise
&gt; Lancez la migration avant de redémarrer.</pre>
</div>
<div>
<div class="markup-label">Rendu</div>

> [!TIP]
> Utilisez la recherche pour retrouver une page.

> [!WARNING] Migration requise
> Lancez la migration avant de redémarrer.

</div>
</div>

Les cinq types disponibles :

> [!NOTE]
> Information utile, même en survolant la page.

> [!TIP]
> Conseil pour faire mieux ou plus vite.

> [!IMPORTANT]
> Information indispensable pour réussir.

> [!WARNING]
> Point qui demande une attention immédiate.

> [!CAUTION]
> Risque ou conséquence négative d'une action.

## HTML et balises custom

<span class="mode-badge pages-only">Pages uniquement</span>

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

## CSS scopé à la page

<span class="mode-badge pages-only">Pages uniquement</span>

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

## Formules LaTeX

<span class="mode-badge pages-only">Pages uniquement</span>

Les formules mathématiques s'écrivent entre doubles dollars : \`$$formule$$\` — en ligne dans une phrase, ou seule sur son propre paragraphe pour un rendu centré en bloc. Rendu via [KaTeX](https://katex.org/).

> [!NOTE]
> Seul le double dollar \`$$...$$\` est reconnu — pas de simple dollar \`$...$\`, qui n'offre aucune protection fiable contre les faux positifs (un prix comme "5 $ ou 10 $" serait interprété comme une formule).

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

## Diagrammes Mermaid

<span class="mode-badge pages-only">Pages uniquement</span>

Un bloc de code dont le langage est \`mermaid\` est dessiné comme un diagramme : organigramme, séquence, classes, états, entité-relation, Gantt… Voir la [documentation Mermaid](https://mermaid.js.org/intro/) pour la syntaxe de chaque type. Le diagramme suit le thème clair ou sombre, et une syntaxe invalide affiche l'erreur avec le code source. Dans un commentaire, le bloc reste un simple bloc de code.

<div class="markup-example">
<div>
<div class="markup-label">Markdown</div>
<pre>\`\`\`mermaid
flowchart LR
  A[Brouillon] --> B{Relu ?}
  B -- oui --> C[Publié]
  B -- non --> A
\`\`\`</pre>
</div>
<div>
<div class="markup-label">Rendu</div>

\`\`\`mermaid
flowchart LR
  A[Brouillon] --> B{Relu ?}
  B -- oui --> C[Publié]
  B -- non --> A
\`\`\`

</div>
</div>

## Récapitulatif

| Marquage | Pages | Commentaires |
| --- | --- | --- |
| Markdown / GFM | ✅ | ✅ |
| Encadrés (\`> [!NOTE]\`…) | ✅ | ✅ |
| Ancres sur les titres et sommaire | ✅ | ❌ |
| HTML arbitraire (sauf balises interdites) | ✅ | ❌ (HTML très restreint) |
| CSS (\`<style>\`, scopé) | ✅ | ❌ |
| LaTeX (\`$$...$$\`) | ✅ | ❌ |
| Diagrammes Mermaid | ✅ | ❌ |`,
      },
      {
        slug: 'notes-de-version',
        title: 'Notes de version',
        tags: ['changelog'],
        content: renderReleaseNotesPage(parseChangelog(loadChangelog())),
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
