# Connexion directe à l'ESP8266

1. Modifiez `AP_PASSWORD` et `API_KEY` dans `SAMS_ESP8266/SAMS_ESP8266.ino` avant le déploiement.
2. Téléversez le firmware, puis connectez le téléphone ou l'ordinateur au Wi-Fi **SAMS-PORTAIL-001**. Son mot de passe initial est `ChangezMoi8266`.
3. L'ESP est toujours accessible sur `http://192.168.4.1` ; Internet n'est pas nécessaire.
4. Ouvrez l'interface SAMS, ajoutez l'appareil avec l'adresse `192.168.4.1` et saisissez la même clé d'association que `API_KEY` (valeur initiale : `123456`).

L'interface teste immédiatement `GET /api/status`, puis la relit toutes les 1,5 secondes. Les commandes utilisent `POST /api/open` et `POST /api/close`, avec l'en-tête `X-SAMS-Key`. En cas de perte de liaison, les délais de reconnexion passent progressivement de 1 à 15 secondes.

Le point d'accès reste actif lorsque le firmware reçoit un SSID via `POST /api/config`. Cela prépare le futur mode STA, sans interrompre l'accès local AP.

## Actionneurs et radar

La partie réseau n'est pas modifiée par ces ajouts. Le firmware utilise les broches suivantes sur un NodeMCU ESP8266 :

- D2 / GPIO4 : signal du servo 360° qui ouvre et ferme la porte ;
- D7 / GPIO13 : signal du servo 180° qui fait balayer le HC-SR04 ;
- D5 / GPIO14 : `TRIG` du HC-SR04 ;
- D6 / GPIO12 : `ECHO` du HC-SR04, **avec diviseur de tension 5 V → 3,3 V obligatoire**.

Alimentez les deux servos avec une alimentation 5 V externe capable de fournir leur courant de pointe et reliez impérativement toutes les masses (GND alimentation, ESP8266, HC-SR04). N'alimentez pas un servo depuis la sortie 3,3 V du NodeMCU.

`GATE_TRAVEL_MS` règle le temps de rotation complet du servo 360° (2,5 s au départ). Ajustez cette valeur après des essais mécaniques. Si le servo tourne dans le sens inverse, échangez les valeurs de `SERVO_OPEN_US` et `SERVO_CLOSE_US`. Le servo s'arrête ensuite sur l'impulsion neutre `SERVO_STOP_US`.

> Un navigateur n'est pas autorisé à connecter lui-même un appareil à un réseau Wi-Fi ni à scanner les SSID. Cette étape doit être faite par l'utilisateur ou l'application système. Une fois le Wi-Fi AP rejoint, la détection HTTP à `192.168.4.1` est automatique.
