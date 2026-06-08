# Fix Bandeau Staleness — v4.7.0

## Problème

Le bandeau `⚠ DONNÉES STATIQUES — il y a 64h` comparait `data_as_of` (date du SitRep INSP, figée entre publications) à `Date.now()`. Comme `data_as_of = 2026-06-03` et qu'on était le 05/06 → 64h calculées correctement, mais le bandeau était **toujours faux** : il s'affiche même quand l'API fonctionne parfaitement.

## Cause

```js
// ❌ AVANT — comparait la date du SitRep (figée)
const hoursOld = (Date.now() - new Date(data.data_as_of)) / 3600000;
if (hoursOld > 48) showBanner();
```

`data_as_of` est **voulu figé** : c'est la date du dernier SitRep INSP (quotidien). Même si l'API répond en temps réel, `data_as_of` ne change qu'à chaque nouveau SitRep (~24h). Le seuil de 48h était trop court.

## Correction

```js
// ✅ APRÈS — compare generated_at (timestamp temps réel de la réponse API)
const hoursOld = (Date.now() - new Date(data.generated_at)) / 3600000;
if (hoursOld > 72) showBanner(); // 72h = tolérance week-end
```

**`generated_at`** est le timestamp `new Date().toISOString()` injecté à chaque requête dans l'API. Il représente l'heure réelle de la dernière réponse serveur. Si l'API tourne, `generated_at` est toujours frais (< quelques secondes).

## Nouveau comportement

| Situation | Avant (❌) | Après (✅) |
|---|---|---|
| API up, SitRep de J-1 | Bandeau après 48h | Pas de bandeau (generated_at = maintenant) |
| API up, week-end (J-2) | Bandeau permanent | Pas de bandeau (generated_at = maintenant) |
| API down depuis 3j | Bandeau | Bandeau ✓ (generated_at stale) |
| Vrai problème données | Bandeau | Bandeau ✓ |

## Champs ajoutés dans la réponse API

```json
"staleness": {
  "check_field": "generated_at",
  "threshold_hours": 72,
  "data_as_of_iso": "2026-06-07T00:00:00Z",
  "data_age_hours": 48,
  "note": "SitReps INSP quotidiens. Délai normal = 24h. Week-end possible 48h. Alerte si generated_at > 72h."
}
```

## Sources externes auto-refresh

L'API appelle maintenant à chaque requête (non cachée) :
- **ReliefWeb API** — rapports RDC Ebola (JSON libre)
- **WHO AFRO RSS** — dernière publication outbreak

Ces données enrichissent `external_sources` dans la réponse JSON. Le cache TTL passe de 1h à 30min pour en profiter.

## À faire (next)

- [ ] Dans `dashboard.html` (bundle complet) : remplacer `data.data_as_of` par `data.generated_at` dans `checkStaleness()`
- [ ] Utiliser `data.staleness.threshold_hours` au lieu de la constante hardcodée
- [ ] Edge Function `insp-scraper` : parser automatiquement le PDF INSP quand publié sur `insp.cd/blog-2/`
