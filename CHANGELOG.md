# Changelog

All notable changes to NestWiki are documented here, newest first, one `## <version> — <date>` section per release. This file is the single source for the in-app "Notes de version" page, which groups releases by minor version (`1.0`, `0.31`…). Entries up to 0.31.10 were written in French, the project's original language.

## 1.0.5 — 2026-10-05

- Première étape de l'interface adaptée au mobile et à la tablette : marges des pages réduites sur petit écran (16 px sur mobile, 24 px sur tablette, 32 px sur ordinateur) au lieu de 32 px partout.
- Administration : la barre d'onglets défile horizontalement sur mobile et tablette au lieu de déborder de l'écran, et l'onglet actif reste toujours visible.
- La barre de recherche du haut n'affiche plus le raccourci clavier « Ctrl K » sur mobile, où il ne sert à rien et mangeait la place du texte.
- Nouveau composant de liste pour les tableaux : tableau classique sur grand écran, cartes empilées sur mobile et tablette. Les pages d'administration l'adoptent dans la prochaine version.

## 1.0.4 — 2026-10-05

- Les notes de version vivent désormais dans `CHANGELOG.md`, à la racine du dépôt : c'est la source unique de cette page, des releases GitHub et de l'historique lisible directement sur GitHub. Chaque version a sa propre section `## x.y.z — date`.
- Nouvelle page « Notes de version » : un sélecteur affiche une version mineure à la fois (1.0, 0.31…) avec toutes ses mises à jour, au lieu d'une longue liste de blocs dépliants. Le sélecteur fonctionne sans JavaScript, au clavier et sur mobile.
- Images Docker publiées avec le numéro de version : `ghcr.io/firedrox/nestwiki-backend:1.0.4`, `:1.0` et `:latest` (idem pour le frontend). Vous pouvez maintenant épingler une version précise. Chaque version publiée a aussi son tag git `vX.Y.Z` et sa release GitHub.
- Nouveau README en anglais (présentation, installation Docker, configuration, mise à jour), guide de contribution, code de conduite, politique de sécurité et modèles d'issues et de pull requests. La spécification technique et l'exemple de déploiement continu sont déplacés dans `docs/`.
- Le déploiement automatique ne se déclenche plus sur les forks du dépôt.

## 1.0.3 — 2026-10-05

- Premier administrateur créé automatiquement : renseignez `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `ADMIN_DISPLAY_NAME` dans `backend/.env`, et le compte est créé au premier démarrage quand la base ne contient encore aucun administrateur. Avant, une installation neuve n'avait aucun moyen documenté d'obtenir un compte admin.
- Le compte n'est créé qu'une fois et n'est **jamais modifié ensuite** : changer `ADMIN_PASSWORD` après coup n'a aucun effet, le mot de passe se change depuis l'application. Si l'adresse appartient déjà à un compte non administrateur, le démarrage s'arrête avec un message clair plutôt que de promouvoir ce compte en silence.
- Le mot de passe suit les mêmes règles qu'une inscription (8 caractères minimum, avec une majuscule, un chiffre et un symbole) et ne peut pas être une valeur par défaut connue.
- Au démarrage du conteneur, `pnpm run seed:admin` s'exécute désormais entre les migrations et `seed:content` : sur une installation neuve, la documentation et les notes de version sont créées dès le premier démarrage (le seed de contenu échouait jusqu'ici faute d'auteur). Le script `seed:dev` et son compte de test sont supprimés.
- Une instance qui a déjà un administrateur n'a rien à faire : les variables `ADMIN_*` ne sont lues que tant qu'aucun admin n'existe.

## 1.0.2 — 2026-10-05

- Sécurité : le backend **refuse de démarrer** tant qu'un secret de `backend/.env` est absent, trop faible ou égal à une valeur par défaut connue (`changeme`, `minioadmin`, `root`…). Avant, une instance installée avec les valeurs d'exemple démarrait avec un secret JWT public, ce qui permettait à n'importe qui de fabriquer un jeton administrateur.
- Règles : `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` obligatoires, d'au moins 32 caractères et différents l'un de l'autre ; `DB_PASSWORD` et `MINIO_SECRET_KEY` obligatoires et non triviaux ; `ADMIN_PASSWORD`, s'il est renseigné, d'au moins 8 caractères. Le message d'erreur liste toutes les variables à corriger d'un coup.
- ⚠️ **Avant de mettre à jour une instance existante**, vérifiez ces variables (y compris en développement) et générez les valeurs manquantes avec `openssl rand -hex 32`. Changer `DB_PASSWORD` ou `MINIO_SECRET_KEY` impose de changer aussi le mot de passe côté MySQL/stockage ; changer les secrets JWT déconnecte simplement tous les utilisateurs.
- Les `.env.example` ne contiennent plus de valeurs par défaut pour les secrets.

## 1.0.1 — 2026-10-05

- NestWiki est désormais un logiciel libre sous licence **GNU AGPL-3.0** (fichier `LICENSE` à la racine du dépôt) : vous pouvez l'utiliser, le modifier et le redistribuer, à condition de publier sous la même licence le code source de toute version modifiée, y compris lorsqu'elle est seulement proposée en ligne.
- Métadonnées des paquets complétées (description, auteur, dépôt, page d'accueil, suivi des bugs, mots-clés).

## 1.0.0 — 2026-10-05

- Le projet s'appelle désormais **NestWiki** (anciennement OpenWiki), pour éviter la confusion avec un autre projet open source du même nom. Nom affiché, logo, favicon, image d'aperçu, titre de l'API et nom du serveur MCP (`nestwiki-mcp`) sont mis à jour.
- Images Docker renommées : `ghcr.io/firedrox/nestwiki-backend` et `ghcr.io/firedrox/nestwiki-frontend` (les anciennes `openwiki-*` ne reçoivent plus de mises à jour). Une instance qui référence les images directement doit mettre à jour leur nom ; `docker-compose.external.yml` est déjà à jour.
- Aucune action côté base de données ni stockage : seules les valeurs par défaut des `.env.example` passent à `nestwiki`, les `.env` existants continuent de fonctionner tels quels.

## 0.31.10 — 2026-10-05

- Correctif : après 15 minutes d'inactivité (expiration du token d'accès), l'arborescence, l'ouverture d'une page ou la recherche étaient servies comme à un visiteur anonyme — arbre réduit aux pages publiques, « Accès refusé » sur une page privée ou à l'ouverture de l'éditeur — jusqu'au rechargement. Ces routes à authentification facultative répondent désormais 401 quand une session existe encore (cookie de rafraîchissement présent), ce qui déclenche le rafraîchissement automatique du token puis rejoue la requête avec les bons droits.
- Correctif : l'arborescence n'est plus chargée avant que la session soit vérifiée, et se recharge à la connexion/déconnexion — plus besoin de recharger la page après s'être connecté.

## 0.31.9 — 2026-10-04

- Correctif : le temps réel (bandeau « nouvelle version disponible », fusion en direct dans l'éditeur, arbre et commentaires mis à jour sans recharger) ne fonctionnait pas en production. Le nginx du frontend ne relayait pas `/socket.io/` vers le backend : ces requêtes recevaient la page HTML de l'application et la connexion temps réel n'aboutissait jamais. `frontend/nginx.conf` proxifie désormais `/socket.io/` vers le backend, upgrade WebSocket compris.

## 0.31.8 — 2026-10-04

- Correctif de déploiement : les commandes `migration:*` et `backfill:avatars` chargent désormais le correctif de résolution de `stream-json` déjà utilisé au démarrage de l'application. Sans lui, la migration de rattrapage des avatars (qui utilise le client Minio) échouait sur le système de fichiers sensible à la casse de l'image Docker (`ERR_MODULE_NOT_FOUND`) et empêchait le conteneur backend de démarrer.
- `shadcn` passe en dépendance de développement : c'est un outil en ligne de commande de génération de composants, seule sa feuille de style est utilisée au build, et rien n'en est livré dans l'application.

## 0.31.7 — 2026-10-04

- Correctif : au-delà de la limite de 100 requêtes par minute, l'API répond enfin `429 Too Many Requests` (avec l'en-tête `Retry-After`) au lieu d'une erreur 500. Plus largement, toute erreur HTTP non spécifique à un module (413, 404 de route, 429…) garde désormais son vrai code au lieu d'être transformée en 500 par le filtre d'erreurs du module ; les endpoints OAuth renvoient `temporarily_unavailable` en cas de limitation. Côté application, les messages d'erreur affichent alors « Trop de requêtes, réessayez dans N s. » (délai lu dans `Retry-After`) au lieu du texte technique du serveur.
- Correctif OAuth : une requête `/oauth/token`, `/oauth/revoke` ou `/oauth/authorize` sans `client_id` (ou sans `client_secret` / `token`) répond désormais `400 invalid_request` / `invalid_client` au lieu d'une erreur 500 qui exposait un message interne de la base de données.

## 0.31.6 — 2026-10-04

- Nouvelle page de documentation [Aperçus de liens](/pages/documentation/apercus-de-liens) : contenu de la carte, cas des pages privées, fonctionnement et limites. Ajout d'un raccourci depuis l'accueil de la documentation, du tag `Meta` dans la documentation de l'API, et de l'endpoint `GET /meta/pages/*path` au README.
- Les photos de profil acceptent désormais les GIF (animés compris), en plus de JPG, PNG et WEBP, toujours dans la limite de 2 Mo.

## 0.31.5 — 2026-10-04

- Les aperçus de lien sont désormais propres à chaque page : `frontend/nginx.conf` repère les robots d'aperçu (Discord, Slack, X, Facebook, LinkedIn, WhatsApp, Telegram…) par leur `User-Agent` et leur sert, sur `/pages/*` uniquement, le HTML des balises meta et le composant Discord rendus par le backend, via une réécriture interne (l'URL reste `/pages/<chemin>`). Les visiteurs humains reçoivent toujours l'application. Voir la page Déploiement, section « Aperçus de liens ».

## 0.31.4 — 2026-10-04

- Carte Discord complète pour toute page publique : titre, fil d'Ariane, tags (8 maximum, puis `+N`), statistiques (vues, versions, commentaires, contributeurs), date et auteur de la dernière modification, et deux boutons « Ouvrir la page » et « Modifier ». La description Open Graph reprend le fil d'Ariane, le nombre de tags et de vues. Le bouton « Modifier » mène à l'éditeur, qui applique toujours les droits de l'utilisateur.

## 0.31.3 — 2026-10-04

- Nouvel endpoint `GET /pages/:id/stats` : nombre de vues, date et auteur de la dernière modification, nombre de versions, de commentaires (hors supprimés) et de contributeurs d'une page. Mêmes droits de lecture que la page (anonyme autorisé sur une page publique) ; la consultation des stats n'incrémente pas le compteur de vues.
- Noms de page réservés, car ils entreraient en conflit avec les routes de l'API : `tree` pour une page racine (`/pages/tree`), et `versions`, `comments`, `tags`, `access-rules`, `stats` pour une page placée directement sous une page racine (`/pages/<racine>/stats`…). Refusés à la création et au déplacement d'une page (erreur 400, vérifiée aussi dans le formulaire de création) ; partout ailleurs dans l'arbre, ces noms restent libres.
- Rattrapage des photos de profil perdues lors du passage à `avatar_extension` (0.30.14) : une migration exécutée une seule fois retrouve dans Minio le fichier `avatars/{id}/avatar.{jpg,png,webp}` des utilisateurs sans avatar et le rattache à leur compte (une seule requête de listing, jamais de compte qui a déjà un avatar). Si Minio est injoignable à ce moment-là, la migration ne bloque pas le démarrage et le rattrapage peut être relancé à la main avec `pnpm run backfill:avatars`.

## 0.31.2 — 2026-10-04

- Les aperçus de lien d'une page publique embarquent désormais un composant Discord (`<script id="discord:component-embed">`) : un conteneur aux couleurs du wiki affichant le titre de la page. Les autres plateformes l'ignorent et gardent les balises Open Graph. Le contenu est échappé (balisage Discord et balise `</script>`) et tronqué sous les limites de Discord ; le composant est absent de la carte par défaut (page privée ou inconnue).

## 0.31.1 — 2026-10-04

- Nouvel endpoint public `GET /meta/pages/*path` qui renvoie un HTML minimal avec les balises Open Graph et Twitter d'une page (titre, fil d'Ariane, URL absolue), destiné aux robots d'aperçu de lien (Discord, Slack, X…). Une page privée, inconnue ou non lisible anonymement renvoie la carte par défaut du wiki, sans divulguer son titre, et le fil d'Ariane d'une page publique n'inclut jamais ses ancêtres privés. La requête n'incrémente pas le compteur de vues et n'est pas soumise à la limite de débit globale (les robots d'aperçu partagent quelques adresses IP). Le routage des robots vers cet endpoint arrive dans un ticket suivant.

## 0.30.14 — 2026-10-01

- Les photos de profil sont désormais stockées dans Minio comme les images de page, et servies via une URL stable (`/users/:id/avatar`) qui redirige vers une URL présignée fraîche à chaque appel — elles ne deviennent plus illisibles après expiration. Correction de 7 alertes Dependabot : `brace-expansion` (2 haute sévérité, DoS par récursion non bornée), `ip-address` (comparaison incohérente entre familles d'adresses), `fast-uri` (normalisation de casse incohérente), `hono` (XSS dans le rendu JSX).

## 0.30.13 — 2026-10-01

- Correction d'une erreur `Data too long for column 'content'` lors du seed de contenu : la colonne `page_versions.content` était en `TEXT` (64 Ko max), dépassée par la page "Notes de version" après l'accumulation de ses entrées. Élargie en `MEDIUMTEXT` (16 Mo).

## 0.30.12 — 2026-10-01

- Correctifs de fin d'EPIC-30, trouvés en relisant les PR de l'epic : l'audit de suppression d'un commentaire par modération est désormais toujours enregistré (plus seulement pour les admins), la liste/purge des commentaires d'un utilisateur depuis l'admin accepte désormais `user.manage` (plus seulement le rôle admin), recherche et médiathèque respectent maintenant les accès accordés page par page ou via un groupe (plus seulement public/admin), un bouton **+** sur chaque page de l'arborescence permet de créer une sous-page directement (si on en a le droit sur cette page précise), et la suppression en cascade d'un sous-arbre fait un seul contrôle de permissions groupé au lieu d'un par page.

## 0.30.11 — 2026-10-01

- Correction de 3 alertes Dependabot (dépendances transitives, GHSA) : `fast-uri` 3.1.6 → 3.1.7 (confusion d'hôte via une parenthèse non fermée dans l'autorité d'une URI), `multer` 2.3.0 → 2.4.0 (déni de service via écritures disque orphelines sur upload interrompu), `undici` 6.28.0 → 6.28.1 (déni de service via erreur non gérée dans la décompression WebSocket permessage-deflate). Forcées via `pnpm-workspace.yaml`.

## 0.30.10 — 2026-10-01

- Panneau **Accès** sur chaque page (visible avec la permission `page.manage_permissions`) : ouvre les règles qui couvrent la page — directes (éditables, actions et suppression) et héritées d'une page ancêtre ou de toute la wiki (lecture seule, avec lien vers l'origine). Ajout d'un accès en une recherche unique proposant utilisateurs et groupes, un choix de portée (cette page seule, ou cette page et ses sous-pages avec exclusion de certaines sous-pages), et une sélection d'actions limitée à ce que vous détenez vous-même sur la page — clôture d'EPIC-30. README, CLAUDE.md et une nouvelle page de documentation ("Gérer les utilisateurs, groupes et accès") décrivent le nouveau modèle de permissions ; plus aucune mention des anciens rôles `editor`/`reader`.

## 0.30.9 — 2026-10-01

- Refonte de l'administration des utilisateurs (`/admin/users`) : liste avec recherche, filtres (rôle, groupe, statut) et pagination, sélection multiple avec actions en lot (ajout à un groupe, création d'un groupe à partir de la sélection), création d'utilisateur (mot de passe temporaire affiché une seule fois, avec bouton copier). Fiche utilisateur (`/admin/users/:id`) en onglets : infos (modification, désactivation/réactivation, réinitialisation de mot de passe, déverrouillage, suppression — actions protégées grisées pour son propre compte), groupes, permissions globales directes (celles héritées d'un groupe apparaissent cochées et grisées avec son nom), accès aux pages via `PageAccessTreeSelector` réutilisé (les pages couvertes par un groupe sont signalées par un badge, non modifiables ici), et permissions effectives en lecture seule avec l'origine de chaque droit.

## 0.30.8 — 2026-09-29

- Nouvel écran d'administration `/admin/groups` (accessible aux administrateurs ou à quiconque détient la permission `user.manage`) : liste des groupes avec nombre de membres/règles, création/renommage/suppression, et fiche par groupe en onglets (membres, permissions globales, accès aux pages). Nouveau composant `PageAccessTreeSelector` : arborescence des pages avec cases à cocher tri-state, cocher un nœud couvre toute sa sous-arborescence, décocher une sous-page l'exclut sans toucher au reste, option "cette page uniquement", sélecteur d'actions par règle, et icône de verrou sur les pages privées.

## 0.30.7 — 2026-09-29

- Le serveur MCP applique désormais les permissions réelles de l'utilisateur propriétaire de la clé API ou du token OAuth, au lieu de lui accorder un accès complet : une clé API sans la permission requise reçoit une erreur explicite (ex. `wiki_update_page` sans `page.edit`, `wiki_create_tag` sans `tag.create`, les outils `wiki_*` réservés à `user.manage`), et les résultats de `wiki_list_pages`/`wiki_search`/`wiki_get_page` sont filtrés selon ce que l'utilisateur peut lire. Une clé API ou un token OAuth appartenant à un compte désactivé est rejeté. Nouveaux outils MCP réservés à `user.manage` : `wiki_list_groups`, `wiki_set_user_groups`, `wiki_grant_access`, `wiki_set_permissions`.

## 0.30.6 — 2026-09-28

- Gestion complète des utilisateurs côté admin (`/admin/users`, accessible aux administrateurs ou à quiconque détient la permission `user.manage`) : recherche/filtres (rôle, groupe, statut), création (mot de passe temporaire généré si non fourni), modification des infos/rôle, activation/désactivation, réinitialisation de mot de passe et déverrouillage de compte, remplacement des groupes, et détail des permissions effectives avec leur origine (directe ou via tel groupe). Un compte désactivé ne peut plus se connecter ni rafraîchir sa session, et le dernier administrateur actif est protégé contre la rétrogradation, la désactivation ou la suppression — de même qu'un administrateur ne peut agir ainsi sur son propre compte. Toutes ces actions sont tracées dans le journal d'audit.

## 0.30.5 — 2026-09-27

- Le frontend n'utilise plus les rôles `editor`/`reader` (supprimés côté backend) : les boutons d'action (édition, tags, modération des commentaires, création de page, médiathèque) s'affichent désormais selon les permissions effectives de l'utilisateur, via un nouveau hook `usePermissions`. Le panneau d'accès par page, devenu obsolète après la bascule vers le nouveau système de permissions, est retiré en attendant sa refonte.

## 0.30.4 — 2026-09-25

- Nouvelle API d'administration des groupes (`/admin/groups`) et des règles d'accès aux pages, accessible aux administrateurs ou à quiconque détient la permission `user.manage` : permissions globales et règles d'accès directes pour un utilisateur ou un groupe, et règles d'accès directement depuis une page (`/pages/:id/access-rules`). Toute mutation est tracée dans le journal d'audit, et une escalade de droits au-delà de ce que possède l'auteur de la règle est bloquée.

## 0.30.3 — 2026-09-25

- Le détail d'une page expose désormais la liste précise des actions autorisées (`permissions`) au lieu d'un simple `canEdit`, l'arborescence des pages indique pour chaque page si l'utilisateur peut y créer une sous-page, et `GET /users/me` renvoie les permissions globales et les groupes de l'utilisateur connecté.

## 0.30.2 — 2026-09-25

- Les contrôles d'accès existants (pages, tags, médias, commentaires, recherche) utilisent désormais le nouveau système de permissions granulaires. Le rôle `editor` est supprimé : les anciens éditeurs conservent leurs droits via un groupe créé automatiquement, les anciens lecteurs ayant un droit d'édition explicite le conservent sur la page concernée et sa sous-arborescence.

## 0.30.1 — 2026-09-24

- Service central de résolution des permissions (`PermissionsService`) : calcule les droits effectifs d'un utilisateur (directs et via ses groupes) sur une page ou globalement — travail préparatoire, pas encore branché sur les contrôles d'accès existants.

## 0.30.0 — 2026-09-24

- Socle de données du nouveau système de permissions (groupes, permissions globales, règles d'accès aux pages attribuables à un utilisateur ou à un groupe) — travail préparatoire, pas encore actif sur les contrôles d'accès existants.

## 0.29.3 — 2026-09-23

- Les pages, leur historique de versions, et l'aperçu de l'éditeur affichent désormais le HTML/CSS personnalisé et les formules LaTeX du contenu — les commentaires restent inchangés (rendu restreint comme avant).

## 0.29.2 — 2026-09-23

- Support des formules mathématiques en LaTeX dans le contenu des pages, avec la syntaxe `$formule$` pour une formule en ligne et `$$formule$$` pour une formule en bloc.

## 0.29.1 — 2026-09-23

- Le CSS personnalisé écrit dans une page reste désormais cantonné à cette page : il ne peut plus affecter le reste de l'interface (sidebar, barre du haut, autres pages).

## 0.29.0 — 2026-09-23

- Nouvelle base technique pour un rendu HTML plus permissif sur le contenu des pages (balises et attributs personnalisés autorisés, sauf ceux posant un risque réel : `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<base>`, et tout attribut `on*`).

## 0.28.0 — 2026-09-22

- `GET /search` matche désormais aussi les tags des pages, en plus du titre et du contenu : une page taguée `javascript`, par exemple, remonte pour une recherche "javascript" même si ce mot n'apparaît pas dans son texte. Chaque résultat renvoie aussi la liste de ses tags.

## 0.27.10 — 2026-09-22

- Correctif : `GET`/`POST /pages/:id/tags` et `DELETE /pages/:id/tags/:tagId` étaient masqués par la route générique `GET /pages/*path` — `TagsModule` dépend de `PagesModule` (pour vérifier les droits de lecture sur la page), ce qui force Nest à initialiser `PagesModule` en premier et donc à enregistrer la route générique de `PagesController` avant les routes de tags. Toute requête vers ces endpoints tombait dans `getByPath` (chemin `[id, 'tags']`) et échouait en 404, empêchant l'affichage des tags sur les pages — y compris les pages par défaut, pourtant bien taguées en base par `seed:content`. Les trois routes vivent maintenant directement sur `PagesController`, comme les autres sous-ressources de page (versions, permissions, commentaires), déclarées avant la route générique — même correctif que 0.21.6 pour les commentaires.
- Correctif : la vue de lecture d'une page attendait le chargement complet des tags avant d'afficher quoi que ce soit (contenu compris) ; un échec ou une lenteur sur l'endpoint des tags de page bloquait toute la page au lieu de se limiter à l'absence de badges de tags.
- Correctif du tool MCP `wiki_create_tag` : le schéma d'entrée n'acceptait que `name`, ignorant silencieusement une `color` transmise par le client alors que le backend la supporte déjà (même mécanisme que celui utilisé par `seed:content` pour les couleurs des tags par défaut). `wiki_create_tag` et `wiki_list_tags` exposent désormais `color`.

## 0.27.9 — 2026-09-22

- Correctif : `seed:content` retrouvait la page à mettre à jour par slug seul, sans tenir compte du parent, alors qu'un slug n'est unique que par parent (`documentation`, `installation`, `configuration`...) — une page existante sans rapport mais portant le même slug ailleurs dans l'arbre pouvait se faire écraser (titre/contenu), déplacer et retaguer par erreur à chaque déploiement. La recherche est désormais scopée par parent, comme partout ailleurs dans l'app.
- Correctif : le panneau de gestion des tags de l'éditeur de page disparaissait entièrement (y compris le bouton "Créer un tag") dès que le chargement des tags existants d'une page échouait, sans aucun message d'erreur.

## 0.27.8 — 2026-09-22

- Vue de lecture d'une page : bandeau "nouvelle version disponible" quand quelqu'un sauvegarde la page pendant que tu la consultes, avec bouton pour recharger. Le fil de commentaires se met aussi à jour en direct (ajout/modification/suppression) sans avoir à recharger la page.

## 0.27.7 — 2026-09-22

- Les commentaires diffusent désormais un événement temps réel à chaque création/modification/suppression, relayé aux autres personnes en train de regarder la même page.

## 0.27.6 — 2026-09-22

- La sidebar (arborescence des pages) se met à jour automatiquement quand une page est créée, déplacée, renommée, supprimée ou change de visibilité, sans avoir à recharger.

## 0.27.5 — 2026-09-22

- Diffusion temps réel des changements d'arborescence (création, déplacement, suppression, visibilité, renommage) à tous les navigateurs connectés.

## 0.27.4 — 2026-09-22

- Éditeur de page : affichage des marqueurs de conflit `<<<<<<<`/`=======`/`>>>>>>>` en cas de fusion impossible au moment de la sauvegarde, avec bandeau d'alerte tant que le conflit n'est pas résolu.

## 0.27.3 — 2026-09-22

- Connexion WebSocket temps réel dans l'éditeur de page : quand quelqu'un d'autre sauvegarde la page que tu es en train d'éditer, tes modifications non enregistrées sont fusionnées automatiquement avec les siennes plutôt que d'écraser silencieusement l'un ou l'autre.

## 0.27.2 — 2026-09-22

- Nouvelle infrastructure temps réel (WebSocket) : connexion authentifiée par cookie, rooms par page selon les droits de lecture, base pour toutes les mises à jour en direct de l'application.

## 0.27.1 — 2026-09-22

- Filet de sécurité à la sauvegarde d'une page : si la version de base envoyée par le client n'est plus à jour (notification temps réel manquée), le serveur retente automatiquement la fusion avant d'écrire, plutôt que d'écraser une sauvegarde concurrente.

## 0.27.0 — 2026-09-22

- Fusion à 3 voies (façon `git merge`) des sauvegardes concurrentes d'une page, au lieu du dernier écrivain qui écrase silencieusement les autres. Nouvel endpoint `POST /pages/:id/merge-preview` pour prévisualiser une fusion sans sauvegarder.

## 0.26.1 — 2026-09-17

- Nouvelle vue d'accueil pour les visiteurs non connectés : présentation du wiki, 2 KPI publics (pages, commentaires) et appel à créer un compte ou se connecter. Nouvel endpoint public `GET /stats/public`.

## 0.25.11 — 2026-09-16

- Correctif : `POST /oauth/authorize/decision` renvoyait `{ redirectUrl }` sans l'enveloppe `ResponseDto` standard de l'app, ce qui faisait planter le front (destructuration d'un objet `undefined`) au moment de rediriger après un clic sur Autoriser/Refuser sur l'écran de consentement OAuth.

## 0.25.10 — 2026-09-16

- Correctif de déploiement : le nginx du frontend forçait `X-Forwarded-Proto` sur `$scheme` (toujours `http` dans ce conteneur, qui écoute en HTTP interne derrière la terminaison TLS externe), ce qui faisait générer des URLs `http://` dans les métadonnées de découverte OAuth au lieu de `https://`. Valeur fixée en dur sur `https`, seul protocole utilisé par ce conteneur en production.

## 0.25.9 — 2026-09-16

- Correctif de déploiement : `frontend/nginx.conf` proxifie désormais aussi `/api/*` vers le backend, en plus des endpoints `.well-known` OAuth — le conteneur frontend n'a plus besoin de dépendre d'une règle de routage externe pour ces chemins.

## 0.25.8 — 2026-09-16

- Correctif de déploiement : les endpoints de découverte OAuth (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`) tombaient dans le SPA du frontend au lieu d'atteindre le backend, faute de règle de routage sur ces chemins hors `/api`. `frontend/nginx.conf` les proxifie désormais directement vers le conteneur backend.

## 0.25.7 — 2026-09-16

- Nouvel onglet "Clients OAuth" dans l'administration MCP (`/admin/mcp/oauth-clients`) : liste des clients OAuth enregistrés et de leurs refresh tokens actifs, avec révocation individuelle.

## 0.25.6 — 2026-09-16

- Écran de consentement OAuth après connexion : une IA connectée via MCP (ex. Claude Code) peut désormais demander à un compte admin d'autoriser ou de refuser sa connexion.

## 0.25.5 — 2026-09-16

- Le endpoint `/mcp` accepte désormais un access token OAuth en plus des clés API `sk_...` existantes (aucun changement pour les intégrations déjà en place).

## 0.25.4 — 2026-09-16

- Nouveaux endpoints `POST /oauth/token` (échange de code d'autorisation et rafraîchissement) et `POST /oauth/revoke` (révocation d'un refresh token).

## 0.25.3 — 2026-09-16

- Nouvel endpoint `GET /oauth/authorize` : flux d'autorisation OAuth 2.0 avec PKCE (S256 obligatoire), réservé aux comptes admin, avec redirection vers le login existant si nécessaire.

## 0.25.2 — 2026-09-16

- Découverte OAuth (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`) et enregistrement dynamique de client (`POST /oauth/register`), pour qu'un client MCP se connecte sans configuration manuelle.

## 0.25.1 — 2026-09-16

- Socle de données du serveur d'autorisation OAuth 2.0 pour MCP : nouvelles tables `oauth_clients` et `oauth_refresh_tokens`.

## 0.24.4 — 2026-09-15

- Nouvelle page d'accueil "Tableau de bord" : compteurs globaux, pages les plus consultées et pages suivies. Un bouton "Suivre" apparaît désormais sur chaque page pour l'ajouter à ses pages suivies.

## 0.24.3 — 2026-09-15

- Possibilité de suivre une page (`POST`/`DELETE /pages/:id/follow`) et nouvel endpoint `GET /stats/followed-pages` : liste les pages suivies par l'utilisateur courant, triées par activité la plus récente.

## 0.24.2 — 2026-09-15

- Nouvel endpoint `GET /stats/popular-pages` : renvoie les pages les plus consultées, classées par nombre de vues. Chaque lecture d'une page incrémente désormais son compteur de vues.

## 0.24.1 — 2026-09-15

- Nouvel endpoint `GET /stats` : renvoie le nombre total de pages, de commentaires, d'utilisateurs et de médias, pour alimenter les KPI de la future page d'accueil.

## 0.23.2 — 2026-09-14

- Un lien markdown vers un fichier PDF dans le contenu d'une page affiche désormais un aperçu de sa première page (même composant `PdfPreview` que dans la médiathèque) au lieu d'un simple lien texte.

## 0.23.1 — 2026-09-14

- La médiathèque affiche désormais un aperçu de la première page pour les fichiers PDF (nouveau composant `PdfPreview`, rendu natif navigateur via iframe) au lieu d'un écran noir. Un clic sur l'aperçu ouvre le PDF dans un nouvel onglet.

## 0.22.14 — 2026-09-14

- Fusion de `isPublished` dans `visibility` sur les pages : il n'existe plus qu'un seul état public/privé au lieu de deux drapeaux indépendants (une page pouvait afficher "publique" tout en restant invisible des visiteurs non connectés). Une page privée reste visible aux éditeurs/admins et aux utilisateurs ayant un droit explicite dessus. `PATCH /pages/:id/publish` et le tool MCP `wiki_publish_page` sont supprimés ; le tool MCP `wiki_set_page_visibility` les remplace.

## 0.22.13 — 2026-09-13

- La liste des utilisateurs (Administration > Utilisateurs) affiche désormais la vraie photo de profil de chacun, avec repli sur les initiales si elle n'en a pas.

## 0.22.12 — 2026-09-13

- Le journal d'activité admin (Administration > Activité) traduit maintenant toutes les actions (mot de passe modifié, version restaurée, visibilité modifiée, commentaires activés/désactivés, commentaire ajouté, photo de profil changée/retirée) au lieu d'afficher le code brut de l'action pour celles manquantes.

## 0.22.11 — 2026-09-13

- Correction d'un décalage de 2h sur les dates de la journalisation d'activité (`created_at`) en production : la valeur est désormais posée par l'application (toujours en UTC) plutôt que par le `CURRENT_TIMESTAMP` du serveur MySQL/MariaDB, dont le fuseau horaire de session n'est pas garanti sur un serveur externe non géré par ce dépôt.

## 0.22.10 — 2026-09-13

- La page "Mon profil" a été entièrement refaite : identité (photo, nom, e-mail, rôle, date d'inscription) et statistiques (pages créées, modifications, commentaires) en tête, onglets Profil / Activité / Sécurité. Nouveaux endpoints `GET /users/me/activity` (historique personnel) et `PATCH /auth/password` (changer son mot de passe).

## 0.22.9 — 2026-09-13

- Nouvel endpoint `GET /users/me/comments` : chaque utilisateur peut lister ses propres commentaires (page d'origine, date), hors commentaires supprimés.
- Refonte de la page "Mon profil" en layout pleine page à deux colonnes : identité (photo, nom, e-mail, rôle, date d'inscription, nom d'affichage) à gauche, aperçu de tous les commentaires écrits à droite.

## 0.22.8 — 2026-09-13

- Refonte visuelle de la page "Mon profil" : identité (photo, nom, rôle, commentaires) et édition du nom d'affichage séparées en deux blocs, changement de photo via une icône appareil photo sur l'avatar plutôt qu'un bouton séparé.

## 0.22.7 — 2026-09-13

- La photo de profil s'affiche désormais dans le menu utilisateur de la barre de navigation (au lieu des seules initiales).

## 0.22.6 — 2026-09-13

- Les commentaires affichent désormais la vraie photo de profil de leur auteur (au lieu des seules initiales) quand il en a une.

## 0.22.5 — 2026-09-13

- La page "Mon profil" permet désormais de changer ou retirer sa photo de profil (aperçu avant envoi, confirmation pour le retrait).

## 0.22.4 — 2026-09-13

- Nouvel écran "Mon profil" (`/profile`, lien depuis le menu utilisateur) : rôle et nombre de commentaires écrits, édition du nom d'affichage.

## 0.22.3 — 2026-09-13

- Nouveaux endpoints `POST /users/me/avatar` et `DELETE /users/me/avatar` : upload (jpg/png/webp, 2 Mo max) et suppression de sa propre photo de profil, stockée sur Minio comme les autres médias.

## 0.22.2 — 2026-09-13

- Tests de non-régression pour `PATCH /users/me` : validation du nom d'affichage (2-100 caractères) et confirmation qu'un utilisateur ne peut pas changer son propre rôle via cet endpoint, en préparation de l'écran "Mon profil".

## 0.22.1 — 2026-09-13

- `GET /users/me` renvoie désormais `commentsCount` (nombre de commentaires écrits, hors supprimés), en préparation de l'écran "Mon profil".

## 0.21.10 — 2026-09-12

- Activation/désactivation des commentaires par page : nouvelle option dans l'édition d'une page (`PATCH /pages/:id/comments-enabled`), désactivée par défaut sur les pages seedées (documentation, notes de version, FAQ). Quand c'est désactivé, la section commentaires n'est plus affichée et l'API rejette lecture/écriture de commentaires sur cette page.

## 0.21.9 — 2026-09-12

- Petite icône ajoutée sur le bouton "Répondre" du fil de commentaires, pour cohérence avec les boutons "Modifier"/"Supprimer".

## 0.21.8 — 2026-09-12

- Modération des commentaires côté admin : nouveau bouton "Messages" sur chaque ligne de `/admin/users`, ouvrant un panneau listant les commentaires de l'utilisateur (page d'origine, contenu, date), paginé, avec sélection multiple et purge (sélection ou totale), chacune avec sa propre confirmation.

## 0.21.7 — 2026-09-12

- Fil de commentaires sur la vue de lecture d'une page : lire, écrire, répondre (1 niveau), éditer et supprimer son propre commentaire, avec suppression modérée pour les éditeurs/admins.

## 0.21.6 — 2026-09-12

- Correctif : `GET`/`POST /pages/:id/comments` étaient masqués par la route générique `GET /pages/*path` (lecture d'une page par chemin) et retournaient toujours "Page not found". Les deux routes vivent maintenant directement sur `PagesController`, comme les autres sous-ressources de page (versions, permissions), déclarées avant la route générique.

## 0.21.5 — 2026-09-12

- Modération admin des commentaires : `GET /admin/users/:id/comments` liste tous les commentaires d'un utilisateur (paginé, avec la page d'origine), `DELETE /admin/users/:id/comments` purge tout ou une sélection (`commentIds`), cascade sur les réponses, tracé dans le journal d'audit.

## 0.21.4 — 2026-09-12

- Nouvel endpoint `PATCH /comments/:id` : l'auteur peut éditer son propre commentaire, ce qui pose `editedAt` (affiché "(modifié)" côté UI).

## 0.21.3 — 2026-09-12

- Nouvel endpoint `DELETE /comments/:id` : l'auteur peut retirer son propre commentaire (suppression douce, affiché "[commentaire supprimé]") ; un éditeur ou un admin peut le supprimer définitivement, avec cascade sur ses réponses. Une suppression par un admin est tracée dans le journal d'audit.

## 0.21.2 — 2026-09-12

- Nouvel endpoint `POST /pages/:id/comments` : créer un commentaire, ou une réponse via `parentId` (1 seul niveau de nesting). Ouvert à tout utilisateur authentifié ayant accès à la page, avec limitation de fréquence sur la création.

## 0.21.1 — 2026-09-12

- Nouvel endpoint `GET /pages/:id/comments` : liste les commentaires d'une page (arbre à un niveau, réponses incluses), en respectant la visibilité de la page.

## 0.21.0 — 2026-09-12

- Nouvelle entité `Comment` (page, auteur, réponse à 1 niveau, édition et suppression douce) et sa migration — première brique du système de commentaires sur les pages (EPIC-07).

## 0.20.5 — 2026-09-12

- Remplacement de Minio par [RustFS](https://rustfs.com) pour le stockage objet (S3-compatible) : l'édition Community de Minio (serveur) a été archivée en 2026 et n'est plus distribuée nulle part (Docker Hub, binaires officiels). RustFS est un remplacement direct, activement maintenu et open-source (Apache 2.0) — aucun changement de configuration côté `backend/.env` (les variables `MINIO_*` restent inchangées). Sur un serveur déjà en place, une seule commande `chown` du volume existant est nécessaire avant la mise à jour (voir le README).

## 0.20.4 — 2026-09-12

- `GET /media` devient `POST /media` : les filtres (`pageId`, `search`, `type`, `page`, `limit`) passent désormais dans le corps de la requête plutôt qu'en query string, pour un typage plus simple côté backend et frontend.

## 0.20.3 — 2026-09-12

- Le picker de médiathèque permet désormais de supprimer un média directement (avec confirmation) ; la suppression est refusée avec un message explicite si le média est encore utilisé sur une autre page.

## 0.20.2 — 2026-09-12

- Nouveau bouton "Médiathèque" dans l'éditeur de pages : parcourir/rechercher les médias déjà uploadés (avec filtre image/fichier) et en insérer un directement, ou en uploader un nouveau depuis la même fenêtre.

## 0.20.1 — 2026-09-12

- La suppression d'un média (`DELETE /media/:id`) est désormais refusée (409) s'il est encore référencé dans le contenu d'une autre page.

## 0.20.0 — 2026-09-12

- Nouvel endpoint `GET /media` sans `pageId` : médiathèque globale filtrable (recherche par nom, type image/fichier) et paginée, respectant la visibilité des pages.

## 0.19.5 — 2026-09-11

- Correctif de sécurité : `multer` (upload de fichiers, dépendance transitive de `@nestjs/platform-express`) était épinglé en 2.2.0, vulnérable à 3 failles de déni de service et 1 contournement de limite de taille de fichier. Forcé en 2.3.0 via un override pnpm (`pnpm-workspace.yaml`), le correctif amont n'étant pas encore répercuté dans `@nestjs/platform-express`.

## 0.19.4 — 2026-09-11

- Un éditeur ou un administrateur peut désormais changer la visibilité (publique/privée) d'une page depuis son édition, pas seulement à la création. Le changement est appliqué en cascade à toutes les pages descendantes.

## 0.19.3 — 2026-09-11

- Correctif de la barre latérale : deux pages partageant le même slug final mais sous des parents différents (ex. `esgi/s1/reseau` et `esgi/s2/reseau`) faisaient déplier la mauvaise branche et surligner le mauvais élément comme actif. La détection de la page courante comparait uniquement le dernier segment de l'URL (`slug`) au lieu du chemin complet ; elle résout désormais le nœud actif en suivant l'arbre niveau par niveau selon le chemin entier.

## 0.19.2 — 2026-09-11

- SEO / partage social : og-image, meta tags Open Graph et Twitter Card, `robots.txt`, et titres d'onglet dynamiques sur les pages et la recherche.

## 0.19.1 — 2026-09-11

- Ajout d'un bouton clair/sombre dans la barre du haut, à droite de la recherche. Le thème s'ouvre en sombre par défaut ; un choix explicite de l'utilisateur (clic sur le bouton) est ensuite mémorisé dans le navigateur (`localStorage`).

## 0.19.0 — 2026-09-08

- Image Docker `backend` : ~1,2 Go → ~450 Mo. La cause : le stage final lançait un `pnpm install --frozen-lockfile` non filtré et non `--prod` directement dans le stage runtime, embarquant toutes les devDependencies (backend **et** frontend — React, Vite, Tailwind, shiki...) plus le store pnpm entier. Un nouveau stage `prod-deps` (`--prod --filter backend...`) isole cette installation ; le stage `runtime` ne fait plus que `COPY --from=` son `node_modules`, donc le store pnpm ne touche jamais les layers de l'image finale. `tsx`/`dotenv` passent en dependencies (nécessaires en prod pour les migrations/seed via `entrypoint.sh`) ; le stage `base` pré-télécharge la version de pnpm épinglée pour éviter tout accès réseau au démarrage du conteneur.
- Image `frontend` (nginx + statique, ~118 Mo) : déjà correcte, seul le stage de build est désormais filtré (`--filter frontend...`) pour ne pas installer les dépendances du backend inutilement.

## 0.18.5 — 2026-09-08

- Correctif : les champs de recherche des journaux d'audit (activité utilisateur, admin, MCP) ne se vidaient jamais complètement — effacer le dernier caractère laissait la dernière lettre affichée. `updateParams` distinguait mal "ce filtre n'a pas changé" de "ce filtre a été vidé" (les deux se traduisaient par `undefined`) ; il teste désormais la présence de la clé (`key in next`) plutôt que sa valeur.
- Correctif CI : `pages.service.spec.ts` ne fournissait plus `UserActivityLogService` à `PagesService` depuis l'ajout du journal d'activité (0.18.0), faisant échouer les 22 tests en résolution de dépendances.

## 0.18.4 — 2026-09-08

- Pages `/admin/audit-log` et `/admin/mcp/audit-log` : ajout des filtres plage de dates et recherche texte, reflétés dans l'URL comme les autres filtres.

## 0.18.3 — 2026-09-08

- Nouvelle page admin `/admin/activity-log` (onglet "Activité") affichant le journal d'activité utilisateur, avec filtres par utilisateur, action, plage de dates et recherche texte.

## 0.18.2 — 2026-09-08

- `GET /admin/mcp/audit-log` accepte désormais `dateFrom`/`dateTo` et `search` (nom du tool, nom de la clé API).

## 0.18.1 — 2026-09-08

- `GET /admin/audit-log` accepte désormais `dateFrom`/`dateTo` (plage inclusive sur la date, `YYYY-MM-DD`) et `search` (action, cible, nom/email de l'admin).

## 0.18.0 — 2026-09-08

- Nouveau journal d'audit `UserActivityLog` (`GET /admin/activity-log`, admin uniquement, filtrable par utilisateur, action, plage de dates et recherche texte libre) — distinct de `AdminAuditLog` qui reste dédié aux actions admin sensibles. `UserActivityLogService.record()` est appelé (fire-and-forget, un échec de log ne bloque jamais l'action) depuis `AuthService.login()`, `PagesService` (création/édition/déplacement/suppression/restauration de page) et `MediaService` (upload/suppression de média).

## 0.17.13 — 2026-09-07

- `storage/` passe au pattern port/adapter déjà utilisé pour les repositories (`StorageService` devient une interface, `MinioStorageService` son implémentation, injectée via le token `'StorageService'`). Les deux clients Minio (interne / présigné public) et la liste des buckets à initialiser au démarrage sont désormais fournis par `storage.module.ts` via des providers `useFactory`, plutôt que construits dans le constructeur du service. Ajout de `download`/`exists` à l'interface (non utilisés pour l'instant, mais posés pour un futur besoin). Chaque bucket est maintenant un paramètre explicite des méthodes (`upload`/`download`/`getPresignedUrl`/`delete`/`exists`) plutôt qu'un champ privé du service — `MediaService` reçoit son bucket via un nouveau token `'MediaBucket'`. Suppression de `media.service.spec.ts` (déjà obsolète vis-à-vis de ce changement de signature, et les fichiers de test ne sont pas d'usage dans ce projet).

## 0.17.12 — 2026-09-07

- Correctif `SignatureDoesNotMatch` sur l'upload d'images via le MCP (`wiki_upload_image`) : `ConfigService.get<number>('MINIO_PUBLIC_PORT')` ne caste jamais réellement la valeur (`process.env` reste une string, le générique TypeScript est purement cosmétique). Le SDK `minio-js` compare le port à `443`/`80` avec `!==` strict pour décider d'ajouter le port au `Host` signé — une string `"443"` déclenchait donc un `Host: <hôte>:443` signé à tort, que Cloudflare Tunnel normalise sans le port en le forwardant à l'origine, d'où la signature invalide côté Minio. `storage.service.ts` caste désormais explicitement `MINIO_PORT`/`MINIO_PUBLIC_PORT` en nombre. L'upload lui-même (`putObject`) n'était jamais affecté (port 9000, jamais "par défaut" donc jamais concerné par ce bug) — seule la génération de l'URL présignée juste après l'upload cassait.

## 0.17.11 — 2026-09-07

- `MEDIA_PRESIGNED_URL_EXPIRY_SECONDS` passe de 1h à 7 jours (le maximum autorisé par une signature SigV4, imposé pareil par Minio) — les URLs présignées embarquées dans le markdown d'une page n'ont pas de mécanisme de rafraîchissement à l'affichage, donc 1h les rendait presque inutilisables pour du contenu durable. Reste une limite dure : au-delà de 7 jours sans ré-upload, l'image casse quand même.

## 0.17.10 — 2026-09-07

- `storage.service.ts` sépare désormais l'hôte Minio interne (`MINIO_ENDPOINT`, utilisé pour toutes les opérations backend→Minio) de l'hôte utilisé pour signer les URLs présignées données au navigateur (`MINIO_PUBLIC_ENDPOINT`, optionnel — retombe sur `MINIO_ENDPOINT` si absent). En prod, `MINIO_ENDPOINT` est typiquement un nom de service Docker interne (injoignable depuis un navigateur), donc sans `MINIO_PUBLIC_ENDPOINT` pointant vers un hôte Minio public (ex. tunnel Cloudflare dédié), aucune image uploadée n'était affichable côté client — bug découvert en migrant du contenu externe via le MCP. Doc mise à jour (README §6 + page wiki Déploiement + `.env.example`).

## 0.17.9 — 2026-09-07

- `backend/entrypoint.sh` lance désormais `pnpm run seed:content` à chaque démarrage de conteneur (donc à chaque déploiement), entre les migrations et le démarrage de l'app — la doc et les notes de version restent à jour automatiquement, y compris les modifications apportées au contenu de `content-seed.ts` lui-même (nouvelle `PageVersion` créée si le contenu ou le titre a changé, jamais de skip silencieux). Contrairement aux migrations, un échec du seed ne bloque pas le démarrage (`|| echo ...`) : sur le tout premier déploiement, aucun utilisateur n'existe encore pour servir d'auteur, le seed échoue silencieusement et repasse au déploiement suivant, une fois le premier admin créé à la main.

## 0.17.8 — 2026-09-07

- Déploiement continu : `.github/workflows/deploy.yml` bascule sur `docker compose -f docker-compose.external.yml` (au lieu de la version complète) — le serveur cible de la CD réutilise déjà un mariadb/minio existants, plus besoin d'en relancer une paire dédiée à chaque déploiement. Corrige au passage un bug de quoting : `DEPLOY_PATH` était entre guillemets simples dans la commande SSH distante, empêchant l'expansion de `~` (échec `cd: no such file or directory` même avec un chemin valide) — désormais non quoté côté distant.

## 0.17.7 — 2026-09-07

- Déploiement : nouveau `docker-compose.external.yml`, une version allégée (`backend`/`frontend` seulement) pour réutiliser un MariaDB/MySQL et un Minio déjà existants sur le serveur au lieu d'en relancer une paire dédiée — rejoint le réseau Docker externe `mariadb-network` plutôt que d'en créer un nouveau. `docker-compose.yml` reste la version complète (mysql + minio + backend + frontend) utilisée par le déploiement continu. Doc mise à jour (README §6 + page wiki Déploiement) avec la commande `docker run` pour lancer Minio en autonome sur ce même réseau.

## 0.17.6 — 2026-09-07

- Corrections CI post-merge : le service `minio` (`bitnami/minio:latest`) n'existe plus sur Docker Hub (catalogue Bitnami retiré) — remplacé par un démarrage manuel de `minio/minio` (`docker run` + attente sur `/minio/health/live`) dans le job `test-backend`. Le correctif `stream-json`/minio de la 0.17.5 (module resolve hook) ne s'appliquait qu'à l'entrypoint de production, pas aux tests Vitest eux-mêmes (qui n'y passent jamais) — les deux `vitest.config.ts` injectent maintenant le même hook via `NODE_OPTIONS` (`backend/vitest.node-options.ts`), vérifié sur Linux (conteneur) et Windows.
- Documentation : la page de wiki [Guide de démarrage](/pages/documentation/guide-demarrage) gagne une page [Déploiement](/pages/documentation/guide-demarrage/deploiement) (production, CI/CD, tunnel Cloudflare — même contenu que `README.md` §6) ; le `README.md` perd son ancien backlog de tickets (EPIC-01 à EPIC-22, ordre de développement suggéré) devenu obsolète une fois l'essentiel implémenté, ne garde que la référence technique (stack, architecture, modèle de données, endpoints, installation).

## 0.17.5 — 2026-09-07

- Migrations automatiques au déploiement : `backend/entrypoint.sh` (`pnpm run migration:run` puis `node dist/main.js`, `set -e` — le conteneur ne démarre pas si une migration échoue) ; `docker-compose.yml` gagne les services `backend`/`frontend`.
- Déploiement continu : `.github/workflows/deploy.yml`, déclenché uniquement après succès de la CI sur `main` (`workflow_run`, jamais sur une PR) — connexion SSH au serveur via tunnel Cloudflare (`cloudflared`), `git pull` puis `docker compose up -d --build`. Premier déploiement sur un serveur vierge : échec attendu (les `.env` ne sont pas commités) jusqu'à leur création manuelle une fois.
- `README.md` §9 : guide d'installation locale et de déploiement (prérequis, secrets GitHub, configuration du tunnel Cloudflare).
- Corrigé au passage : `minio@8.0.7` importe `stream-json/jsonl/Parser.js` (casse pré-3.x) alors que le `stream-json: 3.6.0` imposé par le correctif de sécurité Dependabot (OPS-010) a renommé ce fichier en minuscules — silencieusement toléré sur système de fichiers insensible à la casse (Windows/macOS, donc invisible en dev), mais faisait planter tout conteneur Docker (Linux) au démarrage. Corrigé par un hook de résolution de module Node natif (`backend/scripts/`, chargé via `node --import` dans l'entrypoint) plutôt qu'un patch pnpm sur la dépendance ou une rétrogradation.

## 0.17.4 — 2026-09-07

- Pipeline CI (`.github/workflows/ci.yml`) : lint backend/frontend en parallèle, tests backend (unitaires + e2e, services `mysql:8` et `bitnami/minio` — `minio/minio` seul n'est pas utilisable comme service container GitHub Actions, son CMD par défaut n'affiche que l'aide) et tests frontend sur chaque PR vers `main` ; build Docker (`backend/Dockerfile`, `frontend/Dockerfile`, tous deux ajoutés et testés localement) uniquement sur push vers `main`, après succès des jobs précédents. Pas de déploiement automatique dans ce pipeline.

## 0.17.3 — 2026-09-07

- Tests frontend (Vitest + Testing Library + jsdom, `frontend/src/**/*.test.tsx`) : soumission du formulaire de connexion (appel de `login()`, message d'erreur affiché en cas d'échec), auto-génération du slug depuis le titre dans le formulaire de métadonnées de page, rendu et surbrillance du nœud actif dans l'arborescence sur plusieurs niveaux. Les dépendances des composants (auth, arbre de pages) sont injectées directement via leurs contextes React plutôt que par un appel API réel.

## 0.17.2 — 2026-09-07

- Tests e2e backend (Vitest + Supertest, `backend/test/*.e2e-spec.ts`) sur une base MySQL de test dédiée (`openwiki_test`), migrée automatiquement avant la suite : inscription → connexion → profil, page créée → éditée → restaurée (historique de versions vérifié), et les cas d'erreur (email dupliqué, mauvais mot de passe, rôle insuffisant). Chaque test repart d'une base vidée (`TRUNCATE`).

## 0.17.1 — 2026-09-07

- Tests unitaires backend sur la logique métier critique (`pages.service.ts`, `media.service.ts`, `versions.service.ts`, `RolesGuard`, `JwtAuthGuard`), via Vitest + `@nestjs/testing` avec repositories mockés — couverture ≥ 70% sur ces fichiers.

## 0.16.10 — 2026-09-07

- Alertes de sécurité Dependabot traitées : `undici`, `tmp`, `decode-uri-component`, `qs`, `stream-json` (dépendances transitives) forcés vers leurs versions corrigées via `pnpm-workspace.yaml` (`overrides`). `.github/dependabot.yml` ajouté (npm, une seule entrée à la racine du monorepo pnpm — `pnpm-lock.yaml` et `pnpm-workspace.yaml` y vivent, une entrée par sous-dossier casse la mise à jour du lockfile partagé — hebdomadaire, groupé sur les mises à jour de sécurité) : couvre les *version updates* pnpm (scan hebdomadaire), GitHub ne proposant pas encore de *security updates* automatiques (PR déclenchée par une alerte) pour cet écosystème.

## 0.16.9 — 2026-09-07

- Page journal d'audit admin (`/admin/audit-log`, réservée admin) : historique paginé des actions admin sensibles (date, admin, action, cible), filtrable par admin et par type d'action.

## 0.16.8 — 2026-09-07

- Affichage dédié du verrouillage de compte (`423`) sur le formulaire de connexion : message explicite avec décompte jusqu'au déverrouillage (lu depuis le header `Retry-After`), plutôt que l'erreur générique de mauvais mot de passe. CORS expose désormais `Retry-After` (`exposedHeaders`) pour que le frontend puisse le lire.

## 0.16.7 — 2026-09-07

- Widget Cloudflare Turnstile sur les formulaires de connexion et d'inscription : le formulaire ne peut pas être soumis tant que le widget n'a pas produit de token valide, transmis dans le payload de soumission. Variable `VITE_TURNSTILE_SITE_KEY` (`frontend/.env`).
- `POST /auth/register` délivre désormais directement les cookies d'authentification (comme `/auth/login`) au lieu de nécessiter un second appel à `/auth/login` juste après l'inscription — un token Turnstile est à usage unique, le réutiliser pour une seconde vérification aurait échoué.

## 0.16.6 — 2026-09-07

- Politique de mot de passe renforcée sur `POST /auth/register` : en plus des 8 caractères minimum, le mot de passe doit contenir une majuscule, un chiffre et un caractère spécial (`400` sinon). Détection de fuite via l'API haveibeenpwned (k-anonymity, seul un préfixe SHA-1 à 5 caractères est transmis) — mot de passe déjà compromis → `400` ; API injoignable → inscription non bloquée (fail-open), erreur loguée côté serveur.

## 0.16.5 — 2026-09-07

- Journal d'audit des actions admin sensibles (`AdminAuditLog` : admin, action, cible, métadonnées bornées) : chaque changement de rôle et suppression d'utilisateur (REST `/admin/users` comme MCP `wiki_update_user_role`) crée une entrée. `GET /admin/audit-log` (admin, filtrable par `adminId`/`action`, paginé).

## 0.16.4 — 2026-09-07

- Headers de sécurité HTTP standard sur toutes les réponses via `helmet` (config par défaut : `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, etc.). CORS déjà strict (origine limitée à `FRONTEND_URL`, pas de wildcard).

## 0.16.3 — 2026-09-07

- Verrouillage de compte après échecs répétés : 5 échecs de connexion consécutifs verrouillent le compte 15 minutes (`POST /auth/login` → `423 Locked` avec header `Retry-After`), même avec le bon mot de passe une fois verrouillé. Une connexion réussie remet le compteur d'échecs à zéro.

## 0.16.2 — 2026-09-07

- Vérification Cloudflare Turnstile sur `POST /auth/login` et `POST /auth/register` : le token `turnstileToken` transmis dans le body est validé auprès de Cloudflare avant toute vérification d'email/mot de passe. Token manquant ou invalide → `400`, sans fuite d'information sur l'existence d'un compte. Nouvelle variable `TURNSTILE_SECRET_KEY` (`backend/.env`) — si absente, la vérification est ignorée (utile en dev tant que la clé n'est pas configurée).

## 0.16.1 — 2026-09-07

- Rate limiting dédié, plus strict que la limite globale, sur `POST /auth/register`, `POST /auth/login` et `POST /auth/refresh` : 5 requêtes/minute/IP.

## 0.16.0 — 2026-09-07

- Rate limiting global sur toute l'API : 100 requêtes/minute/IP (`@nestjs/throttler`), résolution de l'IP réelle derrière un proxy via `X-Forwarded-For`. Dépassement → `429 Too Many Requests` avec header `Retry-After`.

## 0.15.12 — 2026-09-05

- Page "Intégration MCP" : ajout d'un exemple de connexion via le CLI Claude Code (`claude mcp add --transport http ...`), en complément de l'exemple de configuration JSON générique.

## 0.15.11 — 2026-09-05

- Page de documentation "Intégration MCP" (`/pages/documentation/mcp`) : création de clé API, scopes disponibles, connexion d'un client MCP, référence des tools par domaine, lien vers le journal d'audit.

## 0.15.10 — 2026-09-05

- Page journal d'activité MCP (`/admin/mcp/audit-log`, réservée admin) : historique paginé des appels d'outils, filtrable par clé API (`?apiKeyId=`, conservé dans l'URL), détail complet (input/output JSON, message d'erreur) au clic sur une ligne.

## 0.15.9 — 2026-09-05

- Page de gestion des clés API MCP (`/admin/mcp/api-keys`, réservée admin) : création avec sélection des scopes, révélation unique de la clé en clair (confirmation demandée si fermeture sans avoir copié), révocation confirmée par boîte de dialogue (clé grisée plutôt que supprimée de la liste).

## 0.15.8 — 2026-09-05

- Journal d'audit des actions MCP : chaque appel de tool (succès ou échec) est tracé (`McpAuditLog` : clé API, tool, input/output tronqués à 500 car., succès, message d'erreur), via un wrapper générique autour du dispatch des tools — rien à ajouter dans chaque tool. `lastUsedAt` de la clé API est mis à jour à chaque appel réussi. `GET /admin/mcp/audit-log` (admin, filtrable par clé, paginé) alimente FE-071.

## 0.15.7 — 2026-09-05

- Tool MCP de recherche : `wiki_search` (scope `search:read` ou `pages:read`, l'un des deux suffit). Une clé avec uniquement `pages:write` (aucun scope de lecture) ne peut pas l'appeler.

## 0.15.6 — 2026-09-05

- Tool MCP d'upload de médias : `wiki_upload_image` (fichier transmis en base64, décodé puis validé avec la même logique que l'upload REST — taille, type MIME), `wiki_get_media_url` (scopes `media:read`/`media:write`). Un base64 malformé ou un fichier trop volumineux sont rejetés avant tout appel à Minio.
- La limite de taille du corps JSON de l'API est relevée à 30 Mo (`GET/POST /api/*`) pour permettre le transport d'images en base64 par MCP ; l'upload REST multipart (`/media/upload`) n'est pas concerné et reste inchangé.

## 0.15.5 — 2026-09-05

- Tools MCP de gestion des utilisateurs : `wiki_create_user`, `wiki_list_users`, `wiki_update_user_role` (scopes `users:read`/`users:write`). Le mot de passe temporaire généré à la création n'est jamais renvoyé. Ces tools sont invisibles dans `tools/list` pour une clé sans le scope requis, pas juste refusés à l'appel.

## 0.15.4 — 2026-09-05

- Tools MCP de gestion des tags : `wiki_create_tag`, `wiki_list_tags`, `wiki_tag_page`, `wiki_untag_page` (scopes `tags:read`/`tags:write`). `wiki_tag_page` avec un `tagId` inexistant renvoie une erreur explicite invitant à créer le tag d'abord.
- Correctif : `POST /pages/:id/tags` (REST et MCP) vérifiait l'accès à la page comme un visiteur anonyme et rejetait donc le tagging de ses propres pages privées/non publiées ; l'identité de l'appelant est maintenant transmise à la vérification.

## 0.15.3 — 2026-09-05

- Tools MCP de gestion des pages : `wiki_create_page`, `wiki_update_page`, `wiki_get_page`, `wiki_list_pages`, `wiki_delete_page`, `wiki_publish_page` (scopes `pages:read`/`pages:write`). Une clé avec un scope pages voit les pages privées/non publiées comme un éditeur, pas comme un visiteur anonyme.

## 0.15.2 — 2026-09-05

- Authentification MCP par clé API à scopes : entité `McpApiKey`, `POST/GET/DELETE /admin/mcp/api-keys` (admin uniquement). La clé en clair n'est affichée qu'à la création ; une clé révoquée (ou absente) est rejetée par le guard MCP avec une erreur JSON-RPC (`code: -32001`) plutôt qu'un `401` REST classique.

## 0.15.1 — 2026-09-05

- Socle du serveur MCP (`@modelcontextprotocol/sdk`) : `POST/GET/DELETE /mcp`, transport HTTP streamable avec gestion de session. Aucun tool enregistré à ce stade — un client MCP peut se connecter et lister les tools via `tools/list` (liste vide).

## 0.15.0 — 2026-09-05

- Entités `Tag`/`PageTag` + endpoints CRUD : `POST/GET /tags`, `DELETE /tags/:id` (cascade sur les associations), `POST/DELETE /pages/:id/tags`. Chaque tag a une couleur (hex) choisie à la création.

## 0.14.3 — 2026-09-05

- La langue de l'interface suit désormais le réglage global (`GET /settings`, sans authentification) au chargement de l'application, pour tous les visiteurs — aucune préférence par utilisateur, pas de `localStorage`.
- Depuis le panel admin, changer la langue (FE-064) retraduit désormais réellement l'UI de l'admin immédiatement ; les autres visiteurs l'appliquent à leur prochain chargement.

## 0.14.2 — 2026-09-05

- Intégration `react-i18next` : toute la chrome applicative (menus, formulaires, messages, dates relatives) passe désormais par `useTranslation()`/`t()`, avec des dictionnaires FR/EN complets — le contenu markdown des pages reste, lui, jamais traduit automatiquement.

## 0.14.1 — 2026-09-05

- `GET /settings` (public, sans authentification) : réglages système exposés à plat (ex. `{ "locale": "fr" }`), nécessaire pour les visiteurs non connectés.
- `PATCH /admin/settings/:key` (admin) : modifie un réglage, validation dépendant de la clé (`locale` limité à `fr`/`en` pour l'instant) → `400` sinon.

## 0.14.0 — 2026-09-05

- Entité `SystemSetting` (clé/valeur) + migration : socle des réglages système globaux, seedée avec `locale=fr`.

## 0.13.1 — 2026-09-05

- Sélecteur de langue FR/EN dans les paramètres d'administration (`/admin/settings`), appelle `PATCH /admin/settings/locale`. Réglage global, pas par utilisateur.
- ⚠️ Le socle i18n et l'endpoint `/admin/settings/:key` restent à livrer par EPIC-21 : ce sélecteur appellera un endpoint pas encore implémenté tant qu'EPIC-21 n'est pas posé.

## 0.13.0 — 2026-09-05

- Page d'administration des utilisateurs (`/admin/users`, réservée admin) : liste, changement de rôle inline et suppression (confirmée par boîte de dialogue) — un admin ne peut ni se rétrograder ni se supprimer lui-même (action désactivée sur sa propre ligne).
- Lien "Administration" du menu utilisateur relié à cette page.

## 0.12.4 — 2026-09-03

- Panneau "Droits d'édition" dans l'éditeur de page (réservé admin) : liste des éditeurs grantés explicitement sur la page, ajout via une recherche d'utilisateur, révocation confirmée par boîte de dialogue.

## 0.12.3 — 2026-09-03

- Révocation d'un droit d'édition (`DELETE /pages/:id/permissions/:userId`, admin) : `204` si un grant explicite existait sur cette page précise, `404` sinon — révoquer un droit hérité d'une page ancêtre (au lieu d'un grant explicite sur la page ciblée) échoue volontairement en `404`, sans effet sur l'héritage.

## 0.12.2 — 2026-09-03

- Création et consultation des droits d'édition explicites d'une page (`POST`/`GET /pages/:id/permissions`, admin) : un doublon `(pageId, userId)` renvoie `409`, la liste ne renvoie que les grants définis directement sur cette page (jamais les grants hérités). `PATCH /pages/:id` accepte désormais aussi un `reader` disposant d'un grant sur la page (la restriction éditeur/admin ne s'appliquait jusque-là qu'aux autres routes de mutation).

## 0.12.1 — 2026-09-03

- Résolution du droit d'édition effectif d'une page : un `reader` global avec un grant explicite sur une page hérite du droit d'édition sur toute sa sous-arborescence (le grant le plus proche dans l'arbre l'emporte), `editor`/`admin` globaux ne sont jamais bloqués. Appliqué avant modification, déplacement, suppression et publication d'une page.

## 0.12.0 — 2026-09-03

- Entité `PagePermission` + migration : modélise les grants d'édition par page (`pageId`, `userId`, `grantedById`), unique sur `(pageId, userId)`.

## 0.11.1 — 2026-09-03

- Page de résultats de recherche complète (`/search?q=&page=`) : pagination synchronisée avec l'URL (bookmarkable), terme recherché surligné dans le titre et l'extrait de chaque résultat.
- La recherche utilise désormais le mode booléen MySQL avec préfixe (`terme*`) plutôt que le mode langage naturel, pour que taper un début de mot (ex. "note") remonte aussi les mots qui le contiennent (ex. "Notes").

## 0.11.0 — 2026-09-03

- Barre de recherche globale (`Ctrl+K`/`Cmd+K` depuis n'importe quelle route, ou clic sur la barre dans la Topbar) : dialog de commande avec débounce de 300 ms, titre + extrait par résultat, navigation directe vers la page au clic.

## 0.10.1 — 2026-09-03

- Endpoint de recherche full-text (`GET /search?q=&page=&limit=`) : recherche `MATCH...AGAINST` sur le titre et le contenu de la version courante de chaque page, résultats triés par pertinence avec un extrait généré autour du terme trouvé. Authentification optionnelle : les lecteurs anonymes ou non-éditeurs ne voient que les pages publiques et publiées, les éditeurs/admins voient tout.

## 0.10.0 — 2026-09-03

- Index FULLTEXT MySQL sur `page_versions` (`title`, `content`) pour préparer la recherche full-text.

## 0.9.2 — 2026-09-02

- Action "Restaurer" sur chaque version de l'historique (`POST /pages/:id/versions/:versionId/restore`, éditeur+), confirmation via boîte de dialogue, puis rafraîchissement de la liste : la version restaurée apparaît en haut avec le résumé auto-généré côté backend.

## 0.9.1 — 2026-09-02

- Vue diff entre les deux versions sélectionnées dans l'historique : diff ligne à ligne (`POST /pages/:id/versions/diff`), lignes ajoutées/supprimées mises en couleur, lignes identiques non colorées, en-tête affichant la date de chaque version comparée.

## 0.9.0 — 2026-09-02

- Historique des versions d'une page (`/history/*`) : liste paginée (auteur, date relative, résumé), sélection de deux versions au maximum (cocher une 3e ligne décoche automatiquement la plus ancienne sélection), aperçu du contenu d'une version.
- Bouton "Historique" sur la vue d'une page, visible selon les mêmes droits de visibilité que la page elle-même.

## 0.8.4 — 2026-09-02

- Nouvelle direction artistique de l'éditeur de page (création et modification), alignée sur la maquette : vue plein écran sans navigation latérale, panneau de métadonnées permanent (titre, chemin, page parente, visibilité), barre d'outils markdown (gras, italique, code, lien, image, pièce jointe) et actions "Enregistrer le brouillon" / "Publier".
- En modification, le résumé de modification est désormais un champ permanent du panneau plutôt qu'une boîte de dialogue, et le déplacement de la page (page parente) s'applique immédiatement.

## 0.8.3 — 2026-09-02

- Boîte de dialogue de sauvegarde avec champ "résumé de modification" (optionnel), ouverte par le bouton Sauvegarder ou `Ctrl+S`/`Cmd+S` sur l'éditeur de page ; confirmation par toast une fois la sauvegarde effectuée.

## 0.8.2 — 2026-09-02

- Formulaire de métadonnées de page (titre, slug auto-généré et éditable, visibilité, sélection de la page parente via une recherche dans l'arborescence) et page "Nouvelle page" (`/new`), reliée au bouton de la barre latérale pour les éditeurs et admins.

## 0.8.1 — 2026-09-02

- Upload d'images depuis l'éditeur : bouton toolbar et glisser-déposer directement sur la zone d'édition, insertion automatique du markdown à la position du curseur.
- Notifications (toasts) pour les erreurs d'upload (fichier trop volumineux, type non supporté).

## 0.8.0 — 2026-09-02

- Éditeur markdown avec prévisualisation live (split view, bascule mobile édition/aperçu, debounce, raccourci `Ctrl+S`/`Cmd+S`, confirmation de sortie si modifications non sauvegardées).
- Page `/edit/*` (éditeur+) pour modifier une page existante, accessible via un bouton "Modifier" sur la vue d'une page.

## 0.7.4 — 2026-09-02

- `DELETE /media/:id` (éditeur+) : supprime un attachment (fichier Minio puis ligne en base, dans cet ordre).

## 0.7.3 — 2026-09-02

- `GET /media/:id/url` (selon visibilité) : génère une URL présignée pour un attachment existant.

## 0.7.2 — 2026-09-02

- `GET /media?pageId=` (selon visibilité) : liste les médias rattachés à une page, avec URL présignée pour chacun.

## 0.7.1 — 2026-09-02

- `POST /media/upload` (éditeur+, multipart/form-data) : upload d'un fichier vers Minio, clé `pages/{pageId}/{uuid}-{filename}`, enregistrement en `Attachment` et retour d'une URL présignée. Limite de 20 Mo et whitelist de types MIME (images + documents courants).

## 0.7.0 — 2026-09-02

- Entité `Attachment` + migration : modélise les fichiers stockés sur Minio (`pageId` nullable, `minioKey`, `filename`, `mimeType`, `size`, `uploadedById`), index sur `pageId` pour `GET /media?pageId=`.

## 0.6.6 — 2026-09-02

- Documentation interactive de l'API (`GET /api/docs`, `GET /api/docs-json`) générée depuis les décorateurs `@nestjs/swagger`.
- Page "Endpoints" reliée à cette documentation via un composant de référence intégré au rendu markdown.

## 0.6.5 — 2026-09-01

- `POST /pages/:id/versions/:versionId/restore` : rollback vers une ancienne version (crée une nouvelle version, l'historique reste intact).

## 0.6.4 — 2026-09-01

- `POST /pages/:id/versions/diff` : diff ligne à ligne entre deux versions (`from`/`to` en body plutôt qu'en query).

## 0.6.3 — 2026-09-01

- `GET /pages/:id/versions/:versionId` : détail d'une version précise, vérifie qu'elle appartient bien à la page.

## 0.6.2 — 2026-09-01

- `GET /pages/:id/versions` : historique paginé des versions d'une page, droits alignés sur sa visibilité.

## 0.6.1 — 2026-09-01

- Entité `PageVersion` + migration : index sur `pageId` pour accélérer l'historique des versions d'une page.

## 0.5.4 — 2026-09-01

- Icônes de dossier/page dans l'arborescence, alignées façon VS Code (chevron avant l'icône).
- En-tête pleine largeur avec logo OpenWiki.
- Barre de filtre et bouton "Nouvelle page" (aperçu) dans la barre latérale.

## 0.5.3 — 2026-09-01

- Page de visualisation d'une page : rendu markdown, coloration syntaxique des blocs de code, images.
- Résolution par chemin complet (arborescence), pas par simple slug.
- États de chargement, page introuvable (404) et accès refusé (403).

## 0.5.2 — 2026-09-01

- Fournisseur de contexte de l'arborescence des pages et composant fil d'ariane (breadcrumb).

## 0.5.1 — 2026-09-01

- Script de seed de développement et composants d'arborescence des pages côté frontend.

## 0.4.8 — 2026-09-01

- Module de gestion des pages : entité, migration, création, modification, déplacement, suppression (cascade), publication et arborescence.

## 0.3.5 — 2026-08-30

- Initialisation du frontend (React, Vite, TypeScript) et parcours d'authentification (connexion, inscription, cookies).

## 0.2.8 — 2026-08-30

- Authentification et gestion des utilisateurs : inscription, connexion JWT, rafraîchissement de token, profils, pagination.

## 0.1.4 — 2026-08-29

- Mise en place du monorepo pnpm (backend/frontend), Docker Compose (MySQL + Minio) et intégration du stockage d'objets.
