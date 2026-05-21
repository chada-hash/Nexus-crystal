# NEXUS · Cristal de HU
### Sceau de Salomon · 28 Lettres · 99 Noms · Oracle phonosémantique · Mode Nafar

---

## DÉPLOIEMENT LOCAL (test)

```bash
# 1. Installer les dépendances
npm install

# 2. Build du frontend
npm run build

# 3. Lancer le serveur
node server.js
```
→ Ouvrir http://localhost:3001

---

## DÉPLOIEMENT RENDER.COM (gratuit, public)

### Étape 1 — Préparer GitHub

1. Créer un compte GitHub si tu n'en as pas
2. Créer un nouveau repo (ex: `nexus-crystal`)
3. Upload tous les fichiers du dossier dans ce repo

### Étape 2 — Déployer sur Render

1. Aller sur https://render.com → Sign up gratuit
2. New → **Web Service**
3. Connecter ton repo GitHub
4. Configurer :
   - **Name** : nexus-crystal (ou ce que tu veux)
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `node server.js`
   - **Instance Type** : Free
5. Cliquer **Create Web Service**
6. Attendre ~3 minutes → tu reçois une URL publique ex: `https://nexus-crystal.onrender.com`

### Étape 3 — Domaine personnalisé (optionnel, ~10€/an)

Dans Render → Settings → Custom Domain → ajouter `nexus-hu.app` ou similaire.

---

## PARTAGE D'UNE INTENTION

Quand tu actives un mot via KUN, l'URL se met à jour automatiquement :
```
https://ton-app.onrender.com/?kun=سلام
```
→ Copier et envoyer ce lien. L'autre personne ouvre le cristal déjà activé sur ce mot.

Pour partager un Nom divin :
```
https://ton-app.onrender.com/?name=5
```
(index 0-98 dans la liste des 99 Noms)

---

## MODE NAFAR (collectif)

Quand plusieurs personnes activent le **même mot** ou un mot du **même archétype** (même chiffre réduit 1-9), elles entrent dans la même room sur le serveur.

- L'indicateur NAFAR s'allume en haut : "X âmes vibrent · [mot]"
- L'orbe central pulse à l'unisson sur tous leurs écrans
- Aucune configuration requise — automatique dès que 2 personnes activent le même archétype

---

## VARIABLES D'ENVIRONNEMENT

Aucune requise. Le PORT est détecté automatiquement par Render.

Si tu veux restreindre l'API Anthropic à ton propre backend (recommandé en production) :
- Ajouter `ANTHROPIC_API_KEY` dans Render → Environment
- Adapter `server.js` pour proxifier les appels API

---

## STRUCTURE DES FICHIERS

```
nexus-crystal/
  server.js          → Backend Express + socket.io (Nafar)
  package.json
  vite.config.js
  index.html
  src/
    main.jsx         → Entry React
    App.jsx          → Le Cristal complet
  dist/              → Généré par npm run build (ne pas éditer)
```

---

*بِسْمِ اللهِ الرَّحْمَٰنِ الرَّحِيمِ*
