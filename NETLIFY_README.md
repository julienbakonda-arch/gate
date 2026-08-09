Déployer l'interface SAMS sur Netlify

Fichiers à publier (placer à la racine du site) :
- index.html
- styles.css
- app.js
- dossier d'assets (images, polices) s'il existe

Méthode 1 — Drag & Drop (rapide)
1. Aller sur https://app.netlify.com/drop
2. Glisser/déposer le dossier contenant `index.html` dans l'interface.
3. Netlify héberge immédiatement le site et fournit une URL.

Méthode 2 — Déployer depuis GitHub
1. Initialiser un dépôt Git local et pousser sur GitHub si nécessaire :

```bash
git init
git add .
git commit -m "Initial commit: SAMS UI"
git branch -M main
git remote add origin <votre-repo-url>
git push -u origin main
```

2. Aller sur Netlify → New site → Import from Git → connectez votre repo GitHub. Choisir la branche `main`.
3. Puis, dans "Build settings", laisser le champ build command vide et mettre "Publish directory" sur `.` (ou `./` si demandé).
4. Déployer.

Remarques importantes
- L'interface appelle directement l'API locale de l'ESP à `http://192.168.4.1` depuis le navigateur. Si l'utilisateur accède au site Netlify depuis un appareil connecté au réseau Wi‑Fi de l'ESP, les requêtes HTTP vers `192.168.4.1` seront effectuées depuis le navigateur client (pas depuis Netlify). Assurez-vous que l'ESP autorise les requêtes (CORS) si nécessaire.
- Ne modifiez pas les URLs d'API côté client sauf si vous avez un proxy local.

Besoin d'aide
- Je peux créer un repo GitHub prêt à être connecté à Netlify, ou adapter `server.js` si vous préférez déployer une instance Node (hébergement différent). Dites-moi ce que vous préférez.