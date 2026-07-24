# Conversazione deploy CapitalEyes

Data: 2026-06-29

## Obiettivo

Pubblicare il sito CapitalEyes online usando:

- dominio acquistato/gestito su GoDaddy;
- hosting applicativo su DigitalOcean App Platform;
- repository GitHub per deploy automatico.

## Progetto locale

Cartella progetto:

```text
C:\Users\vari\PycharmProjects\PythonProject9capita
```

Il progetto non e solo statico:

- `static/` contiene HTML, CSS, JavaScript e asset;
- `main.py` serve il sito e gli endpoint API:
  - `/api/health`
  - `/api/search`
  - `/api/backtest`

Per questo e stato sconsigliato GoDaddy come hosting principale: GoDaddy va bene per dominio/DNS, ma DigitalOcean App Platform e piu adatto per eseguire il backend Python.

## Modifiche fatte per DigitalOcean

Sono stati aggiunti o modificati questi file:

- `main.py`
- `requirements.txt`
- `runtime.txt`
- `Procfile`
- `.gitignore`
- `DEPLOY_DIGITALOCEAN.md`

Modifica importante in `main.py`:

```python
CLOUD_HOST = "0.0.0.0"
host = os.environ.get("HOST", CLOUD_HOST if "PORT" in os.environ else DEFAULT_HOST)
```

Questo permette all'app di ascoltare correttamente su DigitalOcean quando viene impostata la variabile `PORT`.

File di deploy:

```text
Procfile:
web: python main.py
```

```text
runtime.txt:
python-3.11.15
```

`requirements.txt` e vuoto perche il progetto usa solo librerie standard Python.

## Verifiche locali eseguite

Compilazione Python:

```powershell
.venv\Scripts\python.exe -m py_compile .\main.py
```

Test server con porta cloud-like:

```text
http://127.0.0.1:18080/api/health
```

Risposta ottenuta:

```json
{"ok": true, "app": "CapitalEyes"}
```

## GitHub

Repository creato/usato:

```text
https://github.com/Arcadio8/capitaleyes
```

Configurazione Git locale:

```text
user.name = Arcadio8
user.email = arcadio.pasqual@outlook.com
```

Commit iniziale:

```text
bf917a9 Prepare DigitalOcean deployment
```

Branch:

```text
main
```

Remote:

```text
origin https://github.com/Arcadio8/capitaleyes.git
```

Push completato correttamente:

```text
main -> origin/main
```

## DigitalOcean

App creata su DigitalOcean App Platform.

URL provvisorio attivo:

```text
https://lionfish-app-otjx9.ondigitalocean.app/
```

Endpoint test:

```text
https://lionfish-app-otjx9.ondigitalocean.app/api/health
```

Risposta attesa:

```json
{"ok": true, "app": "CapitalEyes"}
```

Configurazione consigliata su DigitalOcean:

```text
Resource type: Web Service
Branch: main
Source directory: /
Build command: vuoto
Run command: python main.py
HTTP port: 8080
```

Variabili ambiente consigliate:

```text
HOST = 0.0.0.0
PORT = 8080
```

Piano consigliato:

```text
Shared CPU
512 MiB RAM
1 instance
Autoscaling off
No database
```

Il piano da circa 24 euro/mese era probabilmente troppo alto per questo progetto. Per partire basta il piano piccolo da circa 5 dollari/mese.

## Dominio GoDaddy

Dominio configurato:

```text
capitaleyes.app
```

Sottodominio configurato:

```text
www.capitaleyes.app
```

Su DigitalOcean e stato aggiunto:

```text
www.capitaleyes.app
```

Su GoDaddy il record corretto per `www` e:

```text
Type: CNAME
Name: www
Value: lionfish-app-otjx9.ondigitalocean.app
TTL: Default
```

Verifica DNS eseguita:

```text
www.capitaleyes.app canonical name = lionfish-app-otjx9.ondigitalocean.app
```

Verifica HTTPS eseguita:

```text
https://www.capitaleyes.app/api/health
```

Risposta ottenuta:

```json
{"ok": true, "app": "CapitalEyes"}
```

Quindi `www.capitaleyes.app` punta gia correttamente all'app DigitalOcean.

## Stato dominio root

Il dominio senza `www`:

```text
capitaleyes.app
```

al momento risultava puntare ancora altrove:

```text
13.248.243.5
76.223.105.230
```

Per far funzionare anche:

```text
https://capitaleyes.app
```

ci sono due opzioni:

1. Aggiungere `capitaleyes.app` come dominio su DigitalOcean e copiare in GoDaddy gli `A record` indicati da DigitalOcean.
2. Impostare su GoDaddy un redirect da `capitaleyes.app` verso `https://www.capitaleyes.app`.

Opzione piu semplice: redirect del dominio root verso `www`.

## Dove guardare su DigitalOcean

La UI attuale usa:

```text
App Platform -> app -> Networking -> Domains -> Add domain
```

Non sempre si trova sotto `Settings -> Domains`.

## Prossimi passi

1. Attendere che DigitalOcean tolga lo stato `Pending` da `www.capitaleyes.app`.
2. Verificare nel browser:

```text
https://www.capitaleyes.app
```

3. Decidere se configurare anche:

```text
https://capitaleyes.app
```

4. Se si vuole il root domain, aggiungerlo su DigitalOcean e impostare gli `A record` su GoDaddy oppure fare redirect verso `www`.

## Comandi utili

Controllare stato Git:

```powershell
git status --short --branch
```

Fare commit e push di future modifiche:

```powershell
git add .
git commit -m "Messaggio modifica"
git push
```

Verificare DNS:

```powershell
nslookup www.capitaleyes.app
nslookup -type=CNAME www.capitaleyes.app
nslookup capitaleyes.app
```

Verificare API:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://www.capitaleyes.app/api/health"
```

## Note

- Non sono state salvate password o token.
- GitHub CLI (`gh`) non e stato installato: l'installazione era stata annullata.
- Il push e stato fatto con Git e Git Credential Manager.

## Aggiornamento 2026-07-20 - Personal Financial Life Plan

### Richieste fatte

E stato chiesto di rivedere l'applicativo `cycle-life-budgeting` e semplificarlo molto rispetto alla versione precedente.

La versione precedente gestiva:

- profilo finanziario;
- budget per categorie;
- patrimonio, debiti e liquidita;
- obiettivi e milestone;
- fondo emergenza;
- score piano;
- scenari economici multipli.

La nuova richiesta e stata:

- lavorare su base mensile;
- dividere semplicemente entrate e uscite;
- calcolare automaticamente il delta come risparmio mensile;
- sommare il risparmio mensile a un patrimonio iniziale inserito come input;
- applicare un tasso annuo ipotetico inserito come input;
- mostrare come varia il patrimonio nei prossimi anni fino a 90 anni;
- mantenere la stessa grafica generale dell'app.

Successivamente e stato chiesto di cambiare il nome visibile dell'app da `Cycle Life Budgeting` / `Monthly Wealth Plan` a:

```text
Personal Financial Life Plan
```

Infine e stato segnalato che il titolo compariva duplicato nella pagina. La causa era la presenza di due versioni responsive dello stesso titolo (`title-desktop` e `title-mobile`). La correzione finale ha lasciato un solo `h1`, cosi il titolo non puo piu duplicarsi.

### Modifiche locali

File modificati per la nuova app:

- `static/cycle-life-budgeting.html`
- `static/cycle-life-budgeting.js`
- `static/cycle-life-budgeting.css`
- `static/index.html`
- `static/platform.html`
- `static/backtest.html`

Il percorso tecnico e rimasto invariato:

```text
/cycle-life-budgeting
```

Questo e stato mantenuto per non rompere link, routing e deploy esistenti.

La nuova app ora funziona cosi:

1. L'utente inserisce valuta, eta attuale, patrimonio iniziale e tasso annuo ipotetico.
2. L'utente inserisce una o piu entrate mensili.
3. L'utente inserisce una o piu uscite mensili.
4. Il sistema calcola automaticamente:
   - entrate mensili totali;
   - uscite mensili totali;
   - risparmio mensile;
   - saving rate;
   - risparmio annuo;
   - risparmio cumulato;
   - capitale versato;
   - rendimento cumulato;
   - patrimonio stimato a 90 anni.
5. Ogni mese il risparmio viene aggiunto al patrimonio e poi il patrimonio aggiornato viene capitalizzato al tasso mensile equivalente.
6. L'output principale e un grafico del patrimonio fino a 90 anni.
7. Sono presenti anche:
   - grafico entrate/uscite/risparmio;
   - tabella annuale dei checkpoint;
   - esportazione CSV;
   - salvataggio automatico nel browser tramite `localStorage`.

La chiave `localStorage` usata dalla nuova versione e:

```text
capitaleyes-cycle-life-budgeting-v2
```

Il file CSV esportato ora si chiama:

```text
capitaleyes-personal-financial-life-plan.csv
```

### Commit GitHub

Durante questo aggiornamento sono stati creati e pushati su `origin/main` questi commit:

```text
4293c58 Simplify cycle life budgeting projection
82cfcaa Rename financial planning app
cbdef49 Fix duplicated financial plan title
```

Durante il primo push era presente un commit remoto non ancora locale:

```text
935b95a Update platform CTA wording
```

E stato fatto:

```powershell
git fetch origin
git rebase origin/main
git push origin main
```

Il rebase e andato a buon fine senza conflitti.

Stato finale prima di questo aggiornamento del file:

```text
main allineato a origin/main
HEAD: cbdef49 Fix duplicated financial plan title
```

### Verifiche eseguite

Verifiche locali:

```powershell
.venv\Scripts\python.exe -m py_compile .\main.py
```

Server locale usato per smoke test:

```text
http://127.0.0.1:18080/cycle-life-budgeting
```

Verifiche HTTP locali:

```text
http://127.0.0.1:18080/api/health
http://127.0.0.1:18080/cycle-life-budgeting
http://127.0.0.1:18080/cycle-life-budgeting.js
http://127.0.0.1:18080/cycle-life-budgeting.css
```

Risposta health attesa/ottenuta:

```json
{"ok": true, "app": "CapitalEyes"}
```

Verifiche browser:

- Chrome headless desktop;
- Chrome headless mobile;
- controllo DOM per confermare il nuovo nome;
- controllo screenshot per evitare overflow e titolo duplicato.

Verifiche live su dominio pubblico:

```text
https://www.capitaleyes.app/api/health
https://www.capitaleyes.app/cycle-life-budgeting
```

Risultato finale:

- pagina pubblica aggiornata;
- nuovo nome presente: `Personal Financial Life Plan`;
- vecchi nomi non presenti nella pagina pubblica:
  - `Cycle Life Budgeting`
  - `Monthly Wealth Plan`
- markup duplicato rimosso:
  - non sono piu presenti `title-desktop` e `title-mobile`;
- health live ok:

```json
{"ok": true, "app": "CapitalEyes"}
```

### Stato operativo

La versione online aggiornata e disponibile qui:

```text
https://www.capitaleyes.app/cycle-life-budgeting
```

Il deploy automatico DigitalOcean ha richiesto circa 1-2 minuti dopo i push su GitHub prima che il dominio pubblico iniziasse a servire la nuova build.

## Aggiornamento 2026-07-23 - Account utenti e salvataggio dati

### Richiesta fatta

E stato chiesto di permettere a ogni utente di creare un account con email e password, come nei normali siti web, per salvare informazioni personali sui prodotti presenti nella suite CapitalEyes.

### Soluzione implementata nel codice

E stata implementata una prima versione funzionale di autenticazione usando solo librerie standard Python:

- registrazione con email e password;
- login;
- logout;
- sessione tramite cookie HttpOnly;
- password salvate come hash PBKDF2-SHA256 con salt;
- database SQLite locale;
- tabella utenti;
- tabella sessioni;
- tabella dati prodotto per utente.

Endpoint backend aggiunti in `main.py`:

```text
GET  /api/auth/me
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/user-data?product=...
PUT  /api/user-data
```

Prodotti supportati dallo storage:

```text
personal-financial-life-plan
backtest
portfolio-tracker
e-learning
```

File aggiunti:

```text
static/account.css
static/account.js
```

File modificati:

```text
.gitignore
main.py
static/backtest.html
static/backtest.js
static/cycle-life-budgeting.html
static/cycle-life-budgeting.js
static/e-learning.html
static/index.html
static/platform.html
static/portfolio-tracker.html
CONVERSAZIONE_DEPLOY.md
```

Il widget account e stato collegato a tutte le pagine della suite.

### Salvataggio per prodotto

`Personal Financial Life Plan`:

- continua a salvare in `localStorage` quando l'utente non e loggato;
- quando l'utente e loggato, carica il piano dal database dell'account;
- se non esiste ancora un piano remoto, carica quello locale e lo salva sull'account;
- salva sul database utente le modifiche a profilo, entrate e uscite.

`Backtest`:

- salva per utente la configurazione del laboratorio:
  - modalita PIC/PAC;
  - asset;
  - pesi;
  - date;
  - capitale iniziale;
  - valuta;
  - contributo PAC;
  - frequenza;
  - rebalance;
  - benchmark;
  - fee.

`Portfolio Tracker` ed `E-Learning`:

- hanno gia il widget account disponibile;
- lo storage backend supporta gia le loro chiavi prodotto;
- al momento non hanno ancora dati applicativi specifici da salvare perche sono placeholder.

### Database locale

Percorso default:

```text
capitaleyes.db
```

Variabile ambiente opzionale:

```text
CAPITALEYES_DB_PATH
```

File SQLite ignorati da Git:

```text
*.db
*.db-shm
*.db-wal
```

### Verifiche locali eseguite

Compilazione backend:

```powershell
.venv\Scripts\python.exe -m py_compile .\main.py
```

Server locale testato:

```text
http://127.0.0.1:18081
```

Verificati:

- `/api/health`;
- registrazione account test;
- `/api/auth/me`;
- salvataggio dati su `personal-financial-life-plan`;
- rilettura dati salvati;
- logout;
- accesso negato ai dati dopo logout;
- caricamento widget account su `Personal Financial Life Plan`;
- caricamento widget account su `Backtest`.

### Nota importante produzione

La versione implementata funziona con SQLite locale. Su DigitalOcean App Platform il filesystem dell'app e temporaneo/ephemeral: DigitalOcean raccomanda di usare Managed Databases o Spaces per dati persistenti e indica che App Platform non supporta volumi persistenti.

Con l'attuale hosting App Platform, gli account online possono funzionare durante la vita dell'istanza, ma non vanno considerati ancora una soluzione definitiva per dati personali persistenti. Per produzione reale serve il passaggio successivo:

1. creare un database gestito su DigitalOcean;
2. collegarlo all'app;
3. migrare lo storage da SQLite locale al database gestito;
4. configurare backup e policy dati.

## 2026-07-23 - Registrazione account professionale

### Chiarimento utente

L'utente ha segnalato che il primo MVP account non era abbastanza professionale per dati personali. Richiesto un flusso piu serio con:

- pagina di registrazione dedicata;
- email e password;
- doppia validazione password;
- consensi espliciti per trattamento dati;
- conferma email prima dell'attivazione account.

### Modifiche locali

Backend `main.py`:

- registrazione non crea piu una sessione immediata;
- nuovo stato utente `pending` fino alla conferma email;
- login bloccato finche `status` non e `active` e `email_verified_at` non e valorizzato;
- nuova tabella `email_verification_tokens` con scadenza 24 ore;
- endpoint `GET /verify-email?token=...` per attivare l'account;
- endpoint `POST /api/auth/resend-verification` per reinviare il link;
- colonne di consenso su `users`: `privacy_consent_at`, `terms_consent_at`, `marketing_consent_at`, `consent_version`;
- password minima 10 caratteri con almeno 3 categorie tra minuscole, maiuscole, numeri e simboli;
- supporto SMTP tramite variabili ambiente.

Frontend:

- aggiunta pagina `/account` con tab `Accedi`, `Crea account`, `Conferma email`;
- registrazione con email, password, ripeti password, consenso privacy, consenso condizioni e consenso marketing opzionale;
- aggiunta pagina `/privacy`;
- widget account nelle pagine prodotto lasciato come login rapido con link alla pagina account;
- stile mantenuto coerente con la grafica CapitalEyes, con layout verificato su desktop e mobile.

File aggiunti:

```text
static/account.html
static/account-page.js
static/privacy.html
```

File modificati:

```text
main.py
static/account.css
static/account.js
DEPLOY_DIGITALOCEAN.md
CONVERSAZIONE_DEPLOY.md
```

### Verifiche locali eseguite

Compilazione:

```powershell
.venv\Scripts\python.exe -m py_compile .\main.py
```

Server locale testato:

```text
http://127.0.0.1:18082
```

Verificati via richieste HTTP reali:

- consenso privacy mancante rifiutato con `400`;
- password e ripeti password diverse rifiutate con `400`;
- registrazione valida crea account `pending_verification` con `202`;
- SMTP configurato ma non raggiungibile gestito senza errore `500`, con `emailSent=false`;
- login prima della conferma email rifiutato con `403`;
- link `/verify-email` attiva account e imposta cookie sessione;
- `/api/auth/me` restituisce utente `active` e `emailVerified=true`;
- salvataggio e rilettura dati su `personal-financial-life-plan`;
- email duplicata rifiutata con `409`;
- `/account` serve i campi richiesti e lo script dedicato.

Verifiche visive:

- screenshot desktop della pagina `/account?tab=register`;
- screenshot mobile/coerente del layout registrazione.

### Nota produzione

Per completare il flusso online con email reali, su DigitalOcean vanno configurate queste variabili:

```text
CAPITALEYES_PUBLIC_URL=https://www.capitaleyes.app
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
SMTP_FROM
```

Senza SMTP configurato, la produzione puo creare account pending ma non puo inviare agli utenti il link di attivazione. Per dati personali persistenti resta valido anche il passaggio a database gestito, perche SQLite su App Platform non e sufficiente come storage definitivo.

## 2026-07-23 - Conferma email disattivata temporaneamente

### Nuova richiesta

L'utente ha chiesto di evitare per il momento l'email di conferma, cosi da non bloccare la registrazione in produzione finche non viene configurato un servizio SMTP.

### Modifiche locali

- la registrazione crea account subito `active`;
- `email_verified_at` viene valorizzato alla creazione account per indicare che non c'e blocco di verifica attivo;
- viene creata subito la sessione utente e impostato il cookie di login;
- il login non blocca piu gli account pending quando `CAPITALEYES_REQUIRE_EMAIL_CONFIRMATION` non e attivo;
- eventuali account pending esistenti vengono sbloccati automaticamente all'avvio o al login;
- la pagina `/account` mostra solo `Accedi` e `Crea account`;
- rimossi dalla UI i riferimenti a `Conferma email`;
- `DEPLOY_DIGITALOCEAN.md` chiarisce che SMTP ora e opzionale/futuro.

### Nota tecnica

Il codice di verifica email resta disponibile dietro flag:

```text
CAPITALEYES_REQUIRE_EMAIL_CONFIRMATION=true
```

Di default questo flag non e impostato, quindi oggi il sito non richiede conferma email.

### Verifiche locali eseguite

- compilazione `main.py`;
- consenso privacy mancante rifiutato con `400`;
- password e ripeti password diverse rifiutate con `400`;
- registrazione valida restituisce `201`, crea account `active` e imposta cookie sessione;
- `/api/auth/me` funziona subito dopo registrazione;
- salvataggio e rilettura dati su `personal-financial-life-plan`;
- endpoint di reinvio verifica risponde che la conferma email e disattivata;
- account `pending` esistente viene sbloccato al login;
- `/account` non mostra piu la scheda `Conferma email`;
- screenshot desktop verificato per la pagina registrazione.

## 2026-07-23 - Accesso suite solo con account

### Nuova richiesta

L'utente ha chiarito che per accedere alla suite bisogna per forza registrarsi o fare login.

### Modifiche locali

- protette lato backend le pagine `/platform`, `/backtest`, `/portfolio-tracker`, `/cycle-life-budgeting`, `/e-learning`;
- protetti anche gli accessi diretti ai rispettivi file `.html`;
- gli utenti non loggati vengono reindirizzati a `/account?next=...`;
- dopo login o registrazione, la pagina account riporta l'utente alla pagina richiesta tramite parametro `next`;
- protette le API operative `/api/search` e `/api/backtest`;
- home, pagina account, privacy e asset statici restano pubblici.

### Verifiche locali eseguite

- `/platform` senza cookie restituisce redirect a `/account?next=%2Fplatform`;
- accesso diretto a `/backtest.html` senza cookie restituisce redirect a `/account?next=%2Fbacktest`;
- richiesta `HEAD` a una pagina prodotto senza cookie restituisce redirect;
- `/api/search` senza cookie restituisce `401`;
- `/account?next=/backtest` resta pubblico;
- registrazione valida crea sessione;
- con cookie valido `/platform` e `/cycle-life-budgeting` sono accessibili;
- con cookie valido `/api/search` risponde correttamente.

## 2026-07-24 - Cache telefono e asset non aggiornati

### Problema segnalato

L'utente ha segnalato che dal telefono il modulo `Personal Financial Life Plan` sembrava non aggiornato al nuovo prodotto.

### Diagnosi

Il sito online risultava gia aggiornato lato server: con sessione valida `/cycle-life-budgeting` conteneva `Personal Financial Life Plan`, campi mensili `Entrate`/`Uscite` e nessun vecchio nome del prodotto.

La causa probabile era cache del browser mobile: gli asset statici venivano serviti senza versionamento esplicito nei link HTML e con header cache non abbastanza rigidi per un'app in sviluppo.

### Modifiche locali

- aggiunti header anti-cache per file `.html`, `.css` e `.js`:
  - `Cache-Control: no-store, max-age=0, must-revalidate`;
  - `Pragma: no-cache`;
  - `Expires: 0`;
- aggiunto versionamento query sugli asset statici principali:
  - `?v=20260724-1`;
- aggiornate home, account, privacy, platform e pagine prodotto.

### Obiettivo

Forzare browser desktop/mobile a scaricare HTML, CSS e JavaScript aggiornati dopo i deploy, evitando che il telefono continui a mostrare vecchie versioni della suite.
