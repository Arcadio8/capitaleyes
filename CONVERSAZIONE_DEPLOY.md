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
