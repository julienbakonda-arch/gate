// Serveur optionnel de fichiers statiques pour développer l'interface sur un
// ordinateur. Il ne joue aucun rôle dans la communication avec l'ESP8266 :
// app.js appelle directement l'API locale de l'ESP (192.168.4.1 en mode AP).
const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname)));

app.listen(4000, () => {
  console.log("Interface SAMS disponible sur http://localhost:4000");
  console.log("Connectez l'ordinateur au Wi-Fi de l'ESP puis l'interface joindra directement http://192.168.4.1.");
});
