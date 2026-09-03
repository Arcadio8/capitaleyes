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

## Variabili produzione account

La registrazione attuale e immediata: l'utente crea l'account, accetta i consensi e viene loggato senza conferma email.

## Database Supabase

Per salvare davvero account, sessioni e dati prodotto in produzione, l'app puo usare Supabase come database PostgreSQL esterno.

Il progetto Supabase creato e:

```text
https://jujznnewdylqnfrnkovu.supabase.co
```

Su Supabase apri `Project Settings` > `Database` > `Connection string` e copia la stringa PostgreSQL del pooler. Non usare la Project API Key nel frontend per questo flusso: il backend Python deve parlare direttamente con PostgreSQL.

Su DigitalOcean App Platform aggiungi al componente web una variabile ambiente runtime cifrata:

```text
DATABASE_URL=postgresql://...
```

La password deve restare solo su Supabase/DigitalOcean, non nel repository. Se la stringa Supabase non include gia `sslmode=require`, il backend lo aggiunge automaticamente per connessioni Supabase.

Con `DATABASE_URL` configurato, `main.py` crea e usa queste tabelle su Supabase:

```text
users
sessions
email_verification_tokens
product_data
```

Senza `DATABASE_URL`, in locale resta attivo SQLite con `capitaleyes.db`.

La conferma email e lasciata disattivata per il momento. Se in futuro viene riattivata con `CAPITALEYES_REQUIRE_EMAIL_CONFIRMATION=true`, impostare su DigitalOcean App Platform queste variabili ambiente:

```text
CAPITALEYES_PUBLIC_URL=https://www.capitaleyes.app
SMTP_HOST=...
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=...
```

`SMTP_PASSWORD` va salvata come secret. Senza questa riattivazione esplicita, SMTP non e necessario per creare account.

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
