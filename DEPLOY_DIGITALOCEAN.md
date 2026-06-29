# Deploy su DigitalOcean App Platform

## File gia predisposti

- `requirements.txt`: permette a DigitalOcean di rilevare il progetto come Python.
- `runtime.txt`: blocca Python a `3.11.15`.
- `Procfile`: avvia il servizio con `python main.py`.
- `main.py`: in cloud ascolta su `0.0.0.0` quando DigitalOcean imposta `PORT`.

## Passi

1. Crea un repository GitHub e carica questi file.
2. In DigitalOcean vai su `Apps` > `Create App`.
3. Scegli GitHub e seleziona il repository.
4. Tipo risorsa: `Web Service`.
5. Build command: lascia vuoto.
6. Run command: se non viene letto dal `Procfile`, inserisci `python main.py`.
7. HTTP port: lascia quello rilevato o usa la variabile `PORT`.
8. Deploy.
9. Verifica:

```text
https://nome-app.ondigitalocean.app/api/health
```

La risposta attesa e:

```json
{"ok": true, "app": "CapitalEyes"}
```

## Dominio GoDaddy

1. In DigitalOcean apri l'app.
2. Vai su `Settings` > `Domains` > `Add Domain`.
3. Inserisci il dominio o sottodominio, ad esempio `www.tuodominio.com`.
4. Scegli `You manage your domain`.
5. Copia il CNAME indicato da DigitalOcean.
6. In GoDaddy apri DNS del dominio e crea/modifica:

```text
Type: CNAME
Name: www
Value: valore-fornito.ondigitalocean.app
TTL: default
```

Per il dominio root (`tuodominio.com`) usa gli A record indicati da DigitalOcean, oppure gestisci il DNS direttamente su DigitalOcean cambiando i nameserver in GoDaddy.
