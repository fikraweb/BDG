# BDG — Acheteur public

Private purchasing portal with a shared password access gate, buyer email/password accounts, remise calculation, document requests, PDF downloads, and a dashboard for purchase rebate transfers.

## Cloudflare Workers deployment

Use `pnpm run build` for the build command. The build generates
`dist/server/wrangler.json` for the `bdg` Worker with its `DB` binding.
The generated configuration enables `keep_vars` so variables set in the
Cloudflare dashboard survive Git deploys.
For a new database, run the migrations before serving requests:

```sh
pnpm exec wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json
pnpm exec wrangler deploy --config dist/server/wrangler.json
```

For Workers Builds, these commands can be joined with `&&` in the deploy command
when the build token has D1 write access. Otherwise apply migrations separately
with a Cloudflare account that can write to D1.

## Runtime configuration

Before using this public checkout in production, enter the supplier details in the admin dashboard, update the PDF footer with approved legal information, and replace the example Gmail relay recipients if using that integration.

Configure secrets with Sites environment settings. Never commit live credentials.

- `ACCESS_PASSWORD_HASH`: SHA-256 of the shared entry password. The password is checked on the server; sessions are stored in D1 and use an HttpOnly cookie. HTTPS sessions use `SameSite=None; Secure; Partitioned` so the access and registration flow works when the Site is embedded in ChatGPT as well as when opened directly. Local HTTP previews use `SameSite=Lax`.
- `ACCOUNT_PASSWORD_PEPPER`: a stable, random secret (at least 32 characters) configured in Sites. Personal account passwords use per-account salts and server-side HMAC + PBKDF2-SHA256 (100,000 iterations, compatible with Workers). Do not rotate this secret without a password migration.
- `SITE_ORIGIN`: the deployed Site origin.
- `NOTIFICATION_EMAIL_REMISE`: inbox for remise de prix requests only.
- `NOTIFICATION_EMAIL_MOBILIER`: inbox for furniture orders only.
- `RESEND_API_KEY`: Resend API credential stored as a secret.
- `EMAIL_FROM`: a sender address verified with the email provider.
- `GMAIL_RELAY_URL`: optional Google Apps Script production Web app URL ending in `/exec`, restricted to `https://script.google.com/macros/s/<deployment-id>/exec`.
- `GMAIL_RELAY_SECRET`: independent 32-byte random setup key, stored as a secret in Sites and in the owner's script properties.

Order requests are saved in D1 before email is attempted. Each request uses only the recipient configured for its kind; it never falls back to the other inbox. A configured Gmail relay takes precedence; otherwise Resend is used. Without a complete sender configuration, notification status stays `pending_configuration`. After the sender is configured, verify delivery to both inboxes before using the portal for live orders. Failed email attempts retain their order and notification status; there is no automatic retry service in this version and providers are never retried through a different service.

### Gmail without a company domain

`integrations/tawzala-gmail.gs` is the credential-free Google Apps Script template. The private installation copy has a random setup key matching the Site secret. Use the company's Google account, paste the private copy into a new Apps Script project, run `initialiserTawzala` once to store the key and grant MailApp's sending permission, and deploy a Web app that executes as its owner with access set to Anyone. Return its production `/exec` URL for `GMAIL_RELAY_URL`; the Site remains unconfigured until that URL is installed and deployed. Neither the installation function nor the public health response sends mail. No Gmail password or inbox-reading permission is needed.

Each server request is HMAC-SHA256 signed, valid for five minutes, and carries the saved-order PDF. The relay validates the signature and keeps the two fixed company inboxes and sends a separate confirmation to the signed order’s contact email, with a script lock and seven-day delivery records to suppress duplicates. Failed/unfinished sends are marked uncertain and are not replayed. Redirect handling permits only Google's ContentService response host and performs a GET without reposting the order. Consumer Gmail currently allows 100 email recipients per day through Apps Script; exhaustion preserves the order/PDF and reports email failure. Real Google authorization and delivered-inbox checks are still required; offline adapter tests do not establish delivery.

## Catalogue and identity

The ten office products and three Moroccan products in `lib/catalog.ts` are demonstration data. The Moroccan catalogue has a salon, an octagonal coffee table and a console, with generated illustrative photos. Both catalogues use the same persistent cart, validated catalogue prices and furniture notification inbox. Replace these models and prices with the company's approved offer before live use. The gold crown emblem is a clean transparent rendition of the user's supplied company logo; it appears on the entry and registration pages, navigation, footer and browser icon. Furniture submissions are explicitly marked as demonstration requests and do not take payment.

## Calculation

The initial remise is 5%: 1,000 DH gives a 50 DH discount and a final price of 950 DH. The owner can change it between 0 and 100% with up to two decimals in `/admin`. Settings and products are stored in D1. The API prices each request from the current catalogue and rate, ignoring submitted prices and rates; displayed quotes are checked for changes before acceptance. Historical requests keep their saved company, item and pricing snapshots.

The third page opens directly on Remise, Mobilier de bureaux and Mobilier de bureaux marocain. The calculator initially shows 0 DH; the rate is managed by the owner. Both furniture catalogues include a side calculator which follows the shared saved cart; without articles, it accepts a manual amount. All requests require a maître d’ouvrage, devis reference, objet, phone, contact email and client city. Furniture requests also require a delivery city, with an optional desired deadline. Cart-based remise requests save their priced article snapshot without clearing the cart. Furniture requests apply the discount once, save the final price, and clear the cart after submission. The final price also appears in the cart, checkout and confirmation.

## Request PDFs and email attachments

`lib/order-pdf.ts` generates the PDF from each saved request. Furniture requests retain their paginated A4 layout, photographs, dimensions, quantities and TTC prices, without remise details. Remise requests use `lib/remise-pdf.ts`: one measured page with the prominent remise amount, devis total, remaining price, request details, payment service, customer details, crown/company-name seal and minimal company footer. Normal and long French requests fit A4; exceptionally dense maximum-length fields use one A3 page to retain all text at a readable size. Supplier information is snapshotted in each order. These documents are demonstration requests requiring TAWZALA validation.

The receipt offers a PDF download through `/api/tawzala?pdf=<orderId>`. The endpoint requires the owning buyer's session, never trusts supplied pricing or request details, and returns a private, non-cached document. Legacy orders retain their stored prices and remain downloadable. No public document URLs or storage buckets are introduced.

Configured email notifications include the same saved-request PDF as a Base64 attachment, reply to the submitted contact email, and route only to the appropriate existing remise or furniture inbox. PDF generation and download work without an email service. Delivery requires either the owner's authorized Gmail relay or a Resend API key with a verified sender; saving a request does not claim it was emailed. The embedded DejaVu font license is in `lib/LICENSE-pdf-fonts.txt`.

## Development

Use the checked-in package manager lockfile. `npm run dev` starts the configured Vite/Vinext development profile. `npm run build` creates the Cloudflare Worker and static assets. Generate D1 migrations with `npm run db:generate` after schema changes. `.env.example` documents local configuration names without values.

## Buyer accounts

The access and account pages use a full blue background with centered forms. The first page shows the **Stè🕸TAWZALA🕸SARL** crown and name at the top left and only the password entry form in the center. The account page retains its registration and sign-in choices.

Stage two offers **Créer un compte** and **Se connecter**. New accounts require a name, phone, normalized email, city, maître d’ouvrage, a personal password of 8–128 characters and its confirmation. The maître d’ouvrage is saved with the buyer and prefilled in remise and furniture request forms, where it remains editable. Cities are saved and prefilled as well. Older accounts can still sign in, and complete a missing city in their first request. An email can belong to only one credential record. Returning buyers first pass the shared access gate, then sign in using their account email and password; their saved cart follows their buyer ID. Successful account registration and sign-in rotate the session cookie. Password hashes, salts and the pepper are never returned to the browser; login attempts are limited by IP and email.

**Every new visit** starts at the shared code, followed by customer email/password or account registration. Refreshing the current tab preserves its valid customer session, current service URL and saved cart. `lib/client-visit.ts` uses a credential-free, tab-local marker and browser navigation information to distinguish a reload from a new visit; the server still validates its HttpOnly session cookie before returning customer data. Closing/leaving the site clears private UI and attempts a keepalive session revocation. A new tab, direct entry or return from browser cache starts at the code again. Session cookies have no persistent lifetime. Normal SPA navigation stays within the current visit. A one-use internal admin handoff preserves the current buyer only for the explicitly chosen admin round trip; admin itself still requires its own credentials on every opening, including refresh.

**Se déconnecter** and **Revenir à l’accès** revoke both access and buyer authentication and return to `/`. Both stages must be completed again. Saved carts, accounts and orders remain stored for the next authenticated login.

The hub and navigation have six independent cinematic service icons: remise d’achat, imported furniture, Moroccan furniture, facture, bon de livraison and bon de livraison des échantillons. Each document icon opens its own form via `/demandes?type=…`. The combined document hub card and duplicated lower furniture panels have been removed.

Profiles created before email/password accounts have no personal password. A buyer with their existing session can activate credentials for that same buyer ID and retain their cart and orders. A fresh session may create a new account, but it cannot claim historical profiles or carts by knowing an email address. Email verification and password recovery are not part of this version.

## Company notification and customer confirmation

Every new request has two independent delivery results in D1. The company receives a “Nouvelle commande” subject including the devis and generated order references; the contact email receives an acknowledgment from the TAWZALA sender name. Both messages include all client/request details, the registered or supplied client city, products, fixed 5% calculation, optional delivery information and the same saved-order PDF. Customer replies go to the appropriate company inbox. The receipt only claims a confirmation was sent when the relay/provider explicitly confirms that specific customer message.

Google relay v2 adds a separate idempotency record for the customer while retaining the v1 company record keys. An uncertain send is never replayed; quota exhaustion does not undo the other message. Each request uses two recipient deliveries from the account’s quota. MailApp needs the same send-mail permission as before.

To upgrade the existing owner relay, paste the updated private TAWZALA-Gmail.txt into the same Apps Script project, save, then use Déployer → Gérer les déploiements → modifier → Nouvelle version → Déployer. Keep the existing /exec URL and secret. The v2 public health response reports version 2 and customerConfirmation: true. Until that update, the current v1 relay continues sending the company notification; the site records customer confirmation as pending_configuration and never falsely claims it was emailed. Existing historical requests are not emailed again.

## Administration

`/admin` is restricted server-side to the verified account email supplied by Sites dispatch that equals the `ADMIN_OWNER_EMAIL` runtime value. The same check protects the admin page and every admin API. Private workspace dispatch can supply the verified email without a user-id header; administration does not require a second sign-in flow. Buyer profiles, claimed roles, buyer cookies and the company contact email cannot grant admin access. The owner link appears in the portal. No shared buyer password authorizes administration.

Manage all eight company fields, the remise percentage, and both catalogues. Product changes include name, category, price, photo, description, specifications, catalogue, display order, visibility and demonstration status. JPG, PNG and WebP uploads (5 MiB maximum) are stored in the `CATALOGUE_IMAGES` R2 binding. Updates use optimistic revisions. Deleting or hiding a product removes it from active carts without changing saved requests. The initial thirteen examples are seeded once outside migrations; an empty catalogue stays empty.


## Client city and individual document forms — version 30

Each document icon opens only its own request form. The old grouped document chooser is removed. Request history appears after submission or closing the form. Registration, account details, request snapshots, administrative document drafts, emails and new PDFs use the customer’s city rather than a postal address.

The Ville field suggests Moroccan cities with accent-insensitive French search, Arabic search and common spelling aliases. A customer may type any city (up to 120 characters), close the suggestions and submit without selecting an item. City selections invalidate a pending request key just like other form edits. Company postal-address settings and the small legal footer stay unchanged.

Migration 0010 adds a nullable buyers.city column, preserving existing buyers, credentials, carts, orders and private postal addresses. The Netlify adapter adds the same column to existing snapshots. A previous postal address is never presented as a city; existing customers enter their city in their next request. Legacy draft contact addresses are omitted from the exposed contact data. Already-issued PDF bytes stay immutable. City list provenance is documented in integrations/moroccan-cities-source.md.


## Mise à jour V34 — formulaires, références et galeries

- Le montant total du devis TTC dispose d’un champ contrasté, avec sélection de la valeur au focus. Le calcul et le taux restent vérifiés côté serveur.
- Le libellé « Objet de la prestation » est partagé par tous les formulaires, les nouveaux PDF et les emails. Les notes complémentaires et observations sont retirées des formulaires et des nouveaux documents. Les anciennes pièces déjà émises restent immuables.
- Les éditeurs de facture, bon de livraison et bon de livraison des échantillons utilisent un seul maître d’ouvrage, sans champ Client ni Ville. La ville du compte acheteur reste utilisée par les demandes client.
- La référence par défaut suit 1/2026, 2/2026… indépendamment par type de document et par année. Elle est réservée au premier enregistrement dans la même opération SQLite que le brouillon. Une contrainte unique protège les numéros saisis à la main; les aperçus ne consomment pas de numéro.
- Les galeries affichent la photo principale, un compteur, les vues supplémentaires et leurs miniatures. 18 photos réelles provenant des galeries des mêmes ensembles ont été intégrées; l’administration permet d’ajouter jusqu’à 12 vues, de modifier leurs légendes et de les retirer. Une galerie vide est conservée explicitement.
- Validation : formulaires React, références concurrentes et idempotence, persistance des galeries et validation des liens, aperçus PDF, extraction et revue de toutes les pages produites. Les tests d’envoi utilisent uniquement des relais simulés.

## V35 — Références TW et documents professionnels

- L’éditeur des trois documents compose le préfixe TW, un numéro modifiable et une année sélectionnable, par exemple TW 5/2026. Les références automatiques tiennent compte des numéros historiques sans préfixe et restent réservées par type et année.
- Un seul champ Client / Maître d’ouvrage, avec référence du devis, objet de la prestation et email de réception. Une création administrative peut se faire sans référence de bon de commande ou marché.
- Les factures et bons reprennent une mise en page commune : en-tête, date en haut à droite, tableau lisible, référence visible et espace libre Cachet et signature.
- Les coordonnées légales fournies par TAWZALA figurent en bas de toutes les pages des nouveaux PDF, avec www.tawzala.gov.ma. Aucun cachet numérique n’est dessiné. Les PDF déjà émis restent immuables.
- Validation : contrôles interactifs de la saisie du numéro et du choix de l’année ; réservations concurrentes et références historiques ; génération, extraction et rendu des factures, bons, commandes et remises, y compris une remise dense sur une seule page.
