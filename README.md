# Khet2Ghar - Agricultural Marketplace

A static website (HTML + CSS + JS). No Node, no npm, no server. It runs on GitHub Pages.

## Put it online (GitHub Pages)
1. On github.com click **New repository**. Name it `khet2ghar`. Choose Public or Private, then **Create**.
2. Click **uploading an existing file** and drag in `index.html`, `style.css`, `script.js` and the
   `google-apps-script` folder. Click **Commit changes**.
   (The three website files must be at the top level of the repo, not inside another folder.)
3. Go to **Settings > Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**,
   Branch **main**, folder **/ (root)**, then **Save**.
4. Wait 1-2 minutes. Your site is at `https://YOUR-USERNAME.github.io/khet2ghar/`.

## Where are the records saved?
- **Default (no setup):** in each visitor's own browser. Good for demos and testing. Log in as the
  tester (below) and press **Download records (Excel)** at the bottom of the home page to get an .xlsx file.
- **Shared Google Sheet (all visitors, one database):**
  1. Create a blank Google Sheet, open **Extensions > Apps Script**, paste all of `google-apps-script/Code.gs`, Save.
  2. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. Deploy and copy the URL.
  3. In `script.js`, set `const CONFIG = { scriptUrl: 'PASTE_URL_HERE' };`, commit the change.
  4. Tabs Farmers, Buyers, Crops and Orders appear in your sheet automatically.
  If you edit Code.gs later, use Deploy > Manage deployments > Edit > New version.

## Real mandi prices
The "Mandi prices" box on the home page shows real prices from Agmarknet (Government of India, via data.gov.in),
for Tomato, Potato, Onion, Apple and Wheat in your state (default Gujarat). It shows the average modal price
per kg, the min to max range, the number of markets and the date. If there is no recent data, the box is not shown at all.
1. Create a free account at data.gov.in and copy your API key (My Account).
2. In `script.js`, set `mandiApiKey: 'YOUR_KEY'` (and `mandiState` if needed), then commit.
Without a key the box stays hidden.

## Tester account
Username `MARCOS` (works as both farmer and buyer). The password is stored only as a salted hash in the code.
