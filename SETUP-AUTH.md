# Auth & Shared Backend — One-Time Setup

Folge dieser Liste **in der Reihenfolge**. Insgesamt ~20 Minuten.

---

## 1. Supabase-Projekt anlegen

1. https://supabase.com → **Start your project** → mit GitHub/Google einloggen.
2. **New Project**
   - Name: `ai-ofm`
   - Database Password: irgendwas Starkes (du brauchst es danach nicht mehr direkt)
   - Region: **Frankfurt (eu-central-1)** (oder eine, die dir nahe liegt)
3. Warten bis Projekt provisioniert ist (~1 Min).

## 2. Schema einspielen

1. Im Supabase Dashboard links: **SQL Editor**.
2. Inhalt von [`supabase-schema.sql`](./supabase-schema.sql) reinpasten.
3. **Die Mail in der letzten Zeile** überprüfen — soll dein Admin-Account sein (default: `benkaufmann.eu@gmail.com`).
4. **Run** drücken. Sollte ohne Fehler durchlaufen.

## 3. Keys kopieren

Supabase Dashboard → **Project Settings** → **API**:

| Wert auf Supabase | Du brauchst's als ENV-Variable in Vercel |
|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon public** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** key (🚨 secret) | `SUPABASE_SERVICE_ROLE_KEY` |

## 4. Gmail SMTP konfigurieren

### 4a. Gmail App-Passwort erzeugen

1. https://myaccount.google.com/security
2. **2-Step Verification** muss an sein. Wenn nicht: erst aktivieren.
3. Dann zu https://myaccount.google.com/apppasswords
4. App: **Mail**, Device: **Other** → Name `AI OFM Supabase` → **Generate**
5. 16-stelliges Passwort kopieren (Leerzeichen werden ignoriert).

### 4b. Supabase Auth → Email-Versand

Supabase Dashboard → **Authentication** → **Settings** (oder Email Templates → Settings).

Im Abschnitt **SMTP Settings** → **Enable Custom SMTP**:

| Feld | Wert |
|---|---|
| Sender email | `benkaufmann.eu@gmail.com` |
| Sender name | `AI OFM` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `benkaufmann.eu@gmail.com` |
| Password | das 16-stellige App-Passwort von oben |
| Min interval | `0` |

**Save**.

### 4c. Magic-Link-Template etwas friendlier (optional)

Supabase → **Authentication** → **Email Templates** → **Magic Link**:

```html
<h2>Login bei AI OFM</h2>
<p>Hier ist dein Login-Link. Er ist 1 Stunde gültig.</p>
<p><a href="{{ .ConfirmationURL }}">Klick mich → Login</a></p>
```

### 4d. Redirect-URLs whitelisten

Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: `https://ai-ofm-eta.vercel.app` (oder deine Custom Domain)
- **Redirect URLs** (alle hinzufügen, eine pro Zeile):
  - `https://ai-ofm-eta.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `https://ai-ofm-eta.vercel.app/**` (für Vercel-Preview-URLs)

## 5. Vercel ENV-Variablen setzen

Vercel Dashboard → dein `ai-ofm` Projekt → **Settings** → **Environment Variables**:

| Name | Wert | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | aus Schritt 3 | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | aus Schritt 3 | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | aus Schritt 3 (🚨 nicht commiten, nirgendwo posten) | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | `https://ai-ofm-eta.vercel.app` (oder Custom Domain) | Production, Preview, Development |

**Save**. Vercel deployed danach automatisch neu.

## 6. Erster Login

1. https://ai-ofm-eta.vercel.app öffnen → wirst auf `/login` weitergeleitet.
2. Deine Admin-Mail (die aus dem SQL-Schema) eintragen → **Login-Link senden**.
3. Check Gmail → Klick auf den Link in der Magic-Link-Mail.
4. Du landest auf `/content-research`. 🎉

## 7. Daten aus localStorage übernehmen

Beim ersten Login nach Cloud-Setup:
- Wenn deine alten Daten (Bella-Projekt etc.) noch im Browser-`localStorage` sind, werden sie **automatisch in die Cloud hochgeladen**.
- Danach sehen alle eingeladenen Teammitglieder dieselben Daten.
- Wenn das nicht greift: **Settings → Backup importieren** mit einer JSON-Datei, die du vorher exportiert hast.

## 8. Leute einladen

Settings → **Team-Zugriff** → Mail eintragen → **Einladen**.
Die Person bekommt sofort einen Magic-Link per Mail und kann sich danach einloggen.

---

## Troubleshooting

- **"Diese E-Mail-Adresse ist nicht freigeschaltet"** beim Login → Admin muss dich erst einladen, ODER deine Mail ist nicht in `allowed_users`. Im SQL-Editor: `select * from allowed_users;`.
- **Mail kommt nicht** → SMTP-Settings checken. Test direkt in Supabase: Authentication → Users → "Send magic link" zu einer Test-Mail.
- **404 auf `/auth/callback`** → Vercel-Deploy ist noch der alte Stand. Warte bis Vercel den neuen Build fertig hat.
- **Live-Sync funktioniert nicht** → Supabase → Database → Replication → `app_state` sollte unter "supabase_realtime" gelistet sein. Falls nicht, das SQL-Schema nochmal laufen lassen.
