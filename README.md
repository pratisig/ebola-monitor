# EBOLA-MONITOR v4.0

> Tableau de bord épidémique Ebola RDC 2026 — Architecture Next.js + Supabase
> Déployé sur Vercel avec mise à jour automatique des données toutes les 4h

## Sources officielles
- WHO DON603: https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603
- ECDC: https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda
- MSF: https://www.msf.org/ebola-disease-drc-msf-scales-response-rapidly-evolving-outbreak

## Stack technique
- **Frontend**: Next.js 14 (ISR — revalidation 4h)
- **API**: Vercel Serverless Functions
- **Base de données**: Supabase (PostgreSQL)
- **Déploiement**: Vercel (auto-deploy depuis GitHub)
- **Mise à jour données**: Cron Job Vercel (toutes les 4h)

## Structure
```
ebola-monitor/
├── pages/
│   ├── index.js          # Dashboard principal
│   └── api/
│       ├── ebola-data.js  # API principale (données actuelles)
│       └── cron-update.js # Cron Vercel (mise à jour auto)
├── lib/
│   ├── supabase.js        # Client Supabase
│   ├── historical-data.js # Données historiques 1976-2025
│   └── who-fetcher.js     # Scraper WHO/ECDC
├── public/
│   └── dashboard.html     # Shell du dashboard (Chart.js + D3)
├── vercel.json            # Config cron Vercel
└── .env.local.example     # Variables d'environnement
```

## Déploiement
Voir [DEPLOY.md](./DEPLOY.md) pour le guide pas à pas.
