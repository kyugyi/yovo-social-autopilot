# Setup Guide — Yovo Social Autopilot

Step-by-step pour passer du dépôt vide à une routine qui publie sur Instagram chaque jour à 18h00 Europe/Zurich.

Il y a deux blocs indépendants :

- **Bloc A** — Code (déjà fait par Claude Code). Tu as juste à pousser le repo sur GitHub.
- **Bloc B** — Meta / Instagram (à faire toi-même côté Meta). C'est ce qui te bloque pour publier vraiment, mais ça ne bloque pas le dry-run.

Suis l'ordre. Tu peux faire le **Bloc B** pendant que tu fais tourner des dry-runs.

---

## Bloc A — Code + GitHub

### A.1 Pousser sur GitHub

```bash
cd /Users/gostoli/Desktop/code/yovo-social-autopilot
git init
git add .
git commit -m "Initial commit — Yovo social autopilot"

# Crée un repo privé sur github.com (par exemple: yovo-social-autopilot)
gh repo create yovo-social-autopilot --private --source=. --remote=origin --push
```

Si tu n'as pas `gh` installé, utilise l'UI GitHub pour créer le repo, puis :

```bash
git remote add origin git@github.com:<ton-handle>/yovo-social-autopilot.git
git branch -M main
git push -u origin main
```

### A.2 Activer GitHub Pages (pour héberger les images au moment de publier)

Instagram pull les images depuis une URL publique. Le plus simple = GitHub Pages.

1. Sur le repo GitHub → **Settings → Pages**
2. **Source** = `Deploy from a branch`
3. **Branch** = créer une branche `gh-pages` (vide pour l'instant)
4. La routine y poussera les PNG chaque jour avant publication

Tu verras les images publiées à `https://<ton-handle>.github.io/yovo-social-autopilot/posts/2026-05-12/01-hook.png` etc.

---

## Bloc B — Meta / Instagram

### B.1 Page Facebook "Yovo"

1. Va sur [facebook.com/pages/create](https://www.facebook.com/pages/create)
2. Nom : `Yovo`
3. Catégorie : `App page` ou `Software`
4. Crée la page (le formulaire est minimal)
5. Note quelque part le **Page ID** (Settings → About → Page ID)

### B.2 Switch `@yovo_app` en Business / Creator

Dans l'app Instagram mobile :

1. Profil → Menu (☰) → **Settings and privacy**
2. **Account type and tools** → **Switch to professional account**
3. Choisis **Business**
4. Lie la page Facebook `Yovo` créée à l'étape B.1

### B.3 Meta Developer Account

1. Va sur [developers.facebook.com](https://developers.facebook.com/) → Get Started
2. Vérifie ton compte (téléphone + email)
3. **My Apps → Create App** → Type : **Business**
4. Nom de l'app : `Yovo Social Autopilot`

### B.4 Ajouter le produit "Instagram Graph API"

1. Dans ton app Meta → **Add Product**
2. Trouve **Instagram Graph API** → Set Up

### B.5 Générer un long-lived access token

Le plus simple via le **Graph API Explorer** :

1. [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)
2. Sélectionne ton app
3. **Get Token** → **Get User Access Token**
4. Coche au minimum ces permissions :
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
5. Generate Access Token → autorise dans la popup
6. Tu obtiens un **short-lived token** (1h). Échange-le contre un long-lived (60 jours) :

```bash
curl "https://graph.facebook.com/v22.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=<TON_APP_ID>&\
client_secret=<TON_APP_SECRET>&\
fb_exchange_token=<SHORT_TOKEN>"
```

Tu reçois `{"access_token": "<LONG_TOKEN>", ...}`. **C'est ce token que tu paste dans la routine.**

### B.6 Trouver ton `IG_BUSINESS_ACCOUNT_ID`

```bash
curl "https://graph.facebook.com/v22.0/me/accounts?access_token=<LONG_TOKEN>"
# → trouve l'entrée Page "Yovo", note son id (= FB_PAGE_ID)

curl "https://graph.facebook.com/v22.0/<FB_PAGE_ID>?fields=instagram_business_account&access_token=<LONG_TOKEN>"
# → réponse: {"instagram_business_account":{"id":"178..."}, ...}
# C'est ton IG_BUSINESS_ACCOUNT_ID.
```

À ce stade tu as les 3 valeurs :

- `META_LONG_LIVED_TOKEN`
- `IG_BUSINESS_ACCOUNT_ID`
- `FB_PAGE_ID`

---

## Bloc C — Créer la routine sur claude.ai/code/routines

### C.1 Nouvelle routine

1. Va sur [claude.ai/code/routines](https://claude.ai/code/routines)
2. **New routine**
3. **Name** : `yovo-daily-18h`
4. **Repository** : sélectionne `<ton-handle>/yovo-social-autopilot`
5. **Branch** : `main`
6. **Trigger** : `Scheduled` → `Daily at 18:00 Europe/Zurich`

### C.2 Secrets

Ajoute exactement ces clés dans le **Secrets** panel de la routine :

| Clé | Valeur |
|---|---|
| `META_LONG_LIVED_TOKEN` | (depuis B.5) |
| `IG_BUSINESS_ACCOUNT_ID` | (depuis B.6) |
| `FB_PAGE_ID` | (depuis B.6) |
| `DRY_RUN` | `true` ← commence par true |
| `TIMEZONE` | `Europe/Zurich` |
| `APP` | `yovo` |

⚠️ **Ne mets PAS ton `ANTHROPIC_API_KEY`** dans la routine — Claude y est déjà authentifié.

### C.3 Prompt

```
Run the daily Yovo Instagram post per CLAUDE.md instructions.
Today's date: {{today}}.
```

### C.4 Test manuel

Depuis le CLI Claude Code :

```bash
/schedule run yovo-daily-18h
```

Ou depuis l'UI : **Run now**.

→ Ça doit produire un commit sur la branche `claude/yovo-{date}` avec les 2 PNG + `meta.json` + `caption.txt`. **Ne publie rien** (DRY_RUN=true).

### C.5 Validation 3 jours

Pendant 3 jours, vérifie chaque matin la branche `claude/yovo-{date}` :

- Le hook est-il bien dans l'esprit Yovo ?
- La résolution est-elle correcte ?
- La caption + hashtags sont OK ?
- Le visuel est brand-fidèle ?

Si oui pendant 3 jours d'affilée → passe à C.6.

### C.6 Passer en production

Sur claude.ai/code/routines, change le secret :

```
DRY_RUN=false
```

À partir de la prochaine exécution (18h00 Europe/Zurich), la routine publiera vraiment sur `@yovo_app`.

---

## Bloc D — Ajouter `@reco4u_app` plus tard

1. Duplique `data/brand.json` → `data/brand.reco4u.json` (couleurs/voice spécifiques)
2. Duplique `data/content-angles.json` → `data/content-angles.reco4u.json`
3. Update `src/lib/context.js` pour charger `data/brand.{APP}.json`
4. Crée une 2e routine sur claude.ai/code/routines :
   - Name : `reco4u-daily-18h`
   - Même repo
   - Schedule : `Daily at 18:03 Europe/Zurich` (décalé pour éviter overlap)
   - Secrets : nouveau token Meta lié à `@reco4u_app`, `APP=reco4u`

---

## Troubleshooting

**"Image URL not accessible" en publishing**
→ GitHub Pages n'est pas encore actif ou la branche `gh-pages` est mal configurée. Ouvre l'URL dans un onglet privé pour vérifier qu'elle se charge sans login.

**"Invalid OAuth access token"**
→ Le long-lived token expire au bout de 60 jours. Régénère-le (B.5) et update le secret de la routine.

**Le carousel s'affiche en bas qualité**
→ Vérifie que les PNG font bien 1080×1350. Si Puppeteer fait du devicePixelRatio>1, baisse `deviceScaleFactor` à 1 dans `src/lib/render.js`.

**Le hook revient trop souvent**
→ Vérifie `data/posted-history.json`. Le blocage est de 14 jours. Si tu veux plus de variété, augmente à 21 dans `src/lib/history.js`.
