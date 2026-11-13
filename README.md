# Mabvazuva Market

The business and services directory for Mabvazuva. Residents search, open a listing and chat on WhatsApp. Business owners list themselves, add photos, prices and deals, and see their views and WhatsApp clicks. You approve listings, set plans, mark payments and choose featured businesses from the admin page.

## The files

| File | What it is | Do you edit it? |
|---|---|---|
| `index.html` | The page shell | No |
| `styles.css` | The design | No |
| `app.js` | How the site works | No |
| `data.js` | Your settings: database keys, WhatsApp number, prices | **Yes** |
| `schema.sql` | Builds the database. You paste it into Supabase once | No |

Until you add database keys, the site runs in **preview mode**: it shows 12 sample businesses and saves everything on your own device only. Open `index.html` on a computer to try it. In preview mode any email and password signs you in as admin, so you can click through every page. The sample businesses disappear the moment the database is connected.

---

## Part 1: Put the code on GitHub

1. Go to github.com and sign in (or create a free account).
2. Click the **+** at the top right, then **New repository**.
3. Repository name: `mabvazuva-market`. Choose **Public** (free publishing needs a public repository). Click **Create repository**.
4. On the next page click the link **uploading an existing file**.
5. Drag all six files in (`index.html`, `styles.css`, `app.js`, `data.js`, `schema.sql`, `README.md`). If you downloaded the zip, unzip it first and drag the files, not the zip.
6. Click **Commit changes**.

Your code is now saved on GitHub. Nothing is published yet.

## Part 2: Create the database (free)

1. Go to supabase.com, sign up, and click **New project**. Name it `mabvazuva-market`, set a database password (save it somewhere), pick the region closest to Zimbabwe, and wait a minute or two for it to finish.
2. In the left menu open **SQL Editor**, click **New query**, paste the whole of `schema.sql`, and click **Run**. It should say it succeeded.
3. Open **Authentication**, find the **Email** sign-in settings, and turn **Confirm email** off. Supabase's built-in email service only sends a few messages an hour, so leaving it on would block owners from signing up on a busy day. You can turn it back on later if you connect your own email service.
4. Open **Project Settings**, then **API** (or **API Keys**). Copy two things:
   - the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - the **anon** key, also called the **publishable** key

   Never use the `service_role` or `secret` key on the website. The anon key is designed to be public. The database rules in `schema.sql` are what protect your data.

## Part 3: Add your settings

1. In your GitHub repository click `data.js`, then the pencil icon to edit.
2. Fill in the values at the top:
   - `supabaseUrl` and `supabaseKey`: the two values from Part 2.
   - `adminWhatsApp`: your number, digits only, with the country code, for example `"263771234567"`.
   - `paymentNote`: how businesses pay you, for example `"EcoCash 0771 234 567 (T. Masimo)"`.
3. Change the plan prices in the same file if you want. They are currently Starter free, Growth $10 (founding $7), Premium $25 (founding $18).
4. Click **Commit changes**.

## Part 4: Publish

1. In the repository open **Settings**, then **Pages** in the left menu.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to `/ (root)`. Click **Save**.
4. Wait a minute or two and refresh the page. Your address appears at the top: `https://YOUR-USERNAME.github.io/mabvazuva-market/`
5. Back in Supabase, open **Authentication**, then **URL Configuration**, and set **Site URL** to that address.

Any later edit you commit on GitHub goes live by itself within a minute or two.

## Part 5: Make yourself the admin

1. On your live site click **Sign in**, then **create an account**, and register with your own email.
2. In Supabase open **SQL Editor** and run this, with your email:

   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```
3. Reload the site. An **Admin** link appears in the footer and in your account page.

---

## Running it day to day

- **A business applies.** It shows under *Waiting for approval* in Admin. Tap the WhatsApp link to check who they are, then Approve or Reject.
- **A business pays.** In *All businesses*, set their plan to Growth or Premium and switch **Paid** on. When a month lapses, switch it off or move them back to Starter.
- **Verified badge.** Switch **Verified** on once you have confirmed the owner lives in Mabvazuva.
- **Featured slots.** Only Premium listings can be featured, and only 6 at a time, so the scarcity on the pricing page is real.
- **Founding price.** The site counts paying businesses itself and stops showing founding prices after the 20th.
- **Events.** Add and remove community events from Admin.
- **Weekly digest.** The Deals page has a button that builds a "What's new in Mabvazuva" message. Post it in the estate WhatsApp groups every week.

## Before you announce it

- [ ] Sign up a test business from your phone, approve it, add a photo, and tap its WhatsApp button.
- [ ] Post a test request, then reply to it from the test business.
- [ ] List 5 to 10 real businesses you already know (with their permission) so nobody arrives to an empty directory.
- [ ] Delete your test listings from Admin.

## Good to know

- The site address is public, so anyone with the link can browse. What keeps it a Mabvazuva directory is that you approve every listing.
- Payments are manual (EcoCash, bank transfer, cash). The site tracks who has paid. It does not take card payments.
- Reviews and requests can be posted without an account, to keep it easy for residents. You can remove any of them in Admin.
- Supabase pauses free projects that get no visits for about a week. If the site ever shows an error after a quiet spell, open your Supabase dashboard and click restore.
- A custom address such as `mabvazuvamarket.co.zw` can be added later in GitHub under Settings, Pages, Custom domain.
