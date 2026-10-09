export const FORMATTING_GUIDE_TOOL_NAME = 'wiki_get_formatting_guide';

export const PAGE_CONTENT_SUMMARY = `Le contenu est du Markdown (GFM) enrichi : encadrés > [!NOTE], formules LaTeX entre $$ ... $$, diagrammes \`\`\`mermaid, HTML et <style> scopé à la page. Appeler ${FORMATTING_GUIDE_TOOL_NAME} pour le guide complet avant d'écrire une page.`;

export const PAGE_FORMATTING_GUIDE = `# Formatage du contenu des pages NestWiki

Le contenu d'une page (champ \`content\` de wiki_create_page / wiki_update_page) est du Markdown rendu côté navigateur. Tout ce qui suit est supporté ; ce qui n'est pas listé s'affiche tel quel.

## Structure
- Le titre de la page (champ \`title\`) n'est pas affiché dans le contenu : commencer le contenu par \`# <titre>\`, puis structurer avec \`##\` et \`###\`.
- Chaque titre reçoit une ancre dérivée de son texte, façon GitHub : minuscules, accents conservés, ponctuation retirée, espaces remplacés par \`-\`, doublons suffixés \`-1\`, \`-2\`. Ex. \`## Guide de démarrage\` → \`#guide-de-démarrage\`.
- Un sommaire en arborescence est généré automatiquement à partir des titres de niveau 1 à 3 (\`#\`, \`##\`, \`###\`) dès qu'il y en a deux : ne pas écrire de sommaire manuel.
- Ne pas mettre de HTML ni de badge dans un titre : il se retrouverait dans l'ancre et dans le sommaire.

## Markdown (GFM)
- Gras, italique, ~~barré~~, \`code en ligne\`, listes, listes numérotées, cases à cocher \`- [ ]\` / \`- [x]\`, citations, tableaux, notes de bas de page \`[^1]\`, liens automatiques, séparateurs \`---\`.
- Blocs de code : \`\`\`<langage> pour la coloration syntaxique (ts, js, json, bash, sql, python, yaml, html, css, etc.) ; sans langage, le bloc est affiché tel quel.

## Liens et médias
- Lien vers une autre page du wiki : chemin complet depuis la racine, ex. \`[Installation](/pages/documentation/guide-demarrage/installation)\`. Jamais le slug seul : une page non racine serait introuvable.
- Lien vers une section : \`[voir](#installation)\` dans la même page, ou \`/pages/<chemin>#<ancre>\` vers une autre page.
- Image : \`![texte alternatif](<embedUrl>)\` avec l'\`embedUrl\` renvoyée par wiki_upload_image (\`/api/media/<id>/raw\`). Ne jamais écrire l'\`url\` présignée : elle expire.
- Un lien vers un fichier \`.pdf\` est affiché comme un lecteur PDF intégré.

## Encadrés
Une citation dont la première ligne est un marqueur devient un encadré coloré (syntaxe GitHub) :

> [!NOTE]
> Information utile.

Marqueurs : \`[!NOTE]\` (remarque), \`[!TIP]\` (astuce), \`[!IMPORTANT]\`, \`[!WARNING]\` (attention), \`[!CAUTION]\` (danger). Un texte après le marqueur sur la même ligne remplace le titre par défaut : \`> [!WARNING] Migration requise\`.

## Formules mathématiques (LaTeX, KaTeX)
- Uniquement entre doubles dollars : \`$$e^{i\\pi} + 1 = 0$$\` en ligne, ou seul sur son paragraphe pour un bloc centré.
- Le dollar simple n'est pas interprété ($5 reste du texte).

## Diagrammes Mermaid
Un bloc de code de langage \`mermaid\` est dessiné comme un diagramme (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, timeline…) :

\`\`\`mermaid
flowchart LR
  A[Brouillon] --> B{Relu ?}
  B -- oui --> C[Publié]
  B -- non --> A
\`\`\`

Les diagrammes ne peuvent pas contenir de liens ni de JavaScript (mode strict). Une syntaxe invalide affiche l'erreur à la place du diagramme : vérifier la syntaxe.

## HTML et CSS
- Le HTML brut est accepté, y compris des balises personnalisées et \`<details><summary>…</summary>…</details>\` pour une section repliable. Laisser une ligne vide entre une balise HTML et du Markdown pour que ce dernier soit interprété.
- Retirés à l'affichage : \`<script>\`, \`<iframe>\`, \`<object>\`, \`<embed>\`, \`<form>\`, \`<base>\`, \`<link>\`, \`<meta>\`, tout attribut \`on*\` et les URLs \`javascript:\`.
- Un bloc \`<style>\` ne s'applique qu'au contenu de la page (scopé automatiquement) ; \`@import\` est retiré. Utiliser les variables du thème pour rester lisible en clair comme en sombre : \`var(--primary)\`, \`var(--primary-foreground)\`, \`var(--background)\`, \`var(--foreground)\`, \`var(--card)\`, \`var(--muted)\`, \`var(--muted-foreground)\`, \`var(--border)\`, \`var(--destructive)\`, \`var(--radius)\`.

## Commentaires
Les commentaires (non accessibles via le MCP) n'acceptent que le Markdown GFM et les encadrés : pas de HTML libre, de CSS, de LaTeX ni de Mermaid.`;
