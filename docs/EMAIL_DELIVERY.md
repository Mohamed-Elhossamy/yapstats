# Yapstats Full Recap email delivery

Yapstats renders the images in the buyer’s browser. The buyer can choose email delivery from the Full Recap offer. Yapstats stores the generated PNG ZIP temporarily, creates a Polar checkout for the existing Full Recap product and sends a seven-day private download link to the email used at checkout. Checkout without email is also available.

A Cloudflare Durable Object checks Polar’s authenticated checkout status. When the checkout reports success, the download becomes available and an alarm sends the email even if the buyer has closed the tab. Resend gets the destination address and the download link. The original WhatsApp or Instagram export stays on the device.

## Prepare the services

1. In [Resend Domains](https://resend.com/domains), add `send.yapstats.tech`. Add the exact DNS records Resend shows for that subdomain in Cloudflare DNS and wait for Verified. In Resend API Keys, create a **Sending access** key restricted to this domain. The sender in this build is `Yapstats <recaps@send.yapstats.tech>` and replies go to `hello@yapstats.tech`.
2. In [Polar Settings](https://polar.sh/dashboard/yapstats/settings), open **Developers** and create an organisation access token with `checkouts:read` and `checkouts:write`. Under **Products → Catalogue**, open **Yapstats Full recap** and copy its product ID. Use a separate Polar Sandbox organisation, product ID and token for the test.
3. Open this project folder in Terminal and sign in to the Cloudflare account that already owns the `yapstats` Worker.

   ```sh
   npx wrangler login
   node --test test/delivery.test.mjs
   npx wrangler deploy --dry-run
   ```

Enter secrets into Wrangler’s prompt or Cloudflare’s **Worker → Settings → Variables and Secrets** as **Secret** values. Keep the two API keys out of source, ZIPs, chat and command-line arguments.

## Test checkout on a separate Worker

1. Copy `wrangler.jsonc` to `wrangler.sandbox.jsonc`. In the copy, change the Worker name to `yapstats-email-test`. Set `SITE_ORIGIN` to its exact HTTPS workers.dev origin with no trailing slash, `POLAR_PRODUCT_ID` to the sandbox product ID, `POLAR_SANDBOX` to the string `"true"`, and leave `RECAP_EMAIL_ENABLED` at `"false"`.
2. Deploy the test Worker, then set its two secrets. Use the Polar Sandbox token and the domain-restricted Resend key.

   ```sh
   npx wrangler deploy --config wrangler.sandbox.jsonc
   npx wrangler secret put POLAR_ACCESS_TOKEN --config wrangler.sandbox.jsonc
   npx wrangler secret put RESEND_API_KEY --config wrangler.sandbox.jsonc
   ```

3. Set `RECAP_EMAIL_ENABLED` to `"true"` in the sandbox config and redeploy. Use a synthetic chat export and a mailbox you control. Click the Full Recap offer, prepare the ZIP, open Polar and complete the purchase with a Polar Sandbox test card. Verify you receive one email even if you close the Yapstats tab after checkout opens. Download the ZIP from the email and check that it contains the full numbered PNG set and Chat Highlights. In a second run, verify the return page also unlocks the recap and offers the ZIP. [Polar Sandbox documentation](https://polar.sh/docs/integrate/sandbox)
4. Confirm that leaving a checkout unpaid sends no email and that the free recap works as before. Only the email checkout path uses the sandbox product. The secondary checkout link in this copy still points at the existing live checkout, so leave that link alone during the sandbox purchase test.

## Release on yapstats.tech

1. Check the existing Worker’s custom domain and retain the previous deployment for rollback. Verify the packaged public files against the currently deployed version if other site edits have been made since this build.
2. In `wrangler.jsonc`, the verified production Polar Full Recap product ID is already set. Keep the Worker name `yapstats` and `SITE_ORIGIN` as `https://yapstats.tech`. Omit `POLAR_SANDBOX`. Deploy once with email delivery disabled and add the **production** secrets.

   ```sh
   npx wrangler deploy
   npx wrangler secret put POLAR_ACCESS_TOKEN
   npx wrangler secret put RESEND_API_KEY
   ```

3. Confirm the homepage, free import and current Polar checkout still open. Enable `RECAP_EMAIL_ENABLED`, then run `npx wrangler deploy` again. Open `https://yapstats.tech/recap-email/available` and verify it returns `{"enabled":true}`. Check the opt-in dialog and verify a real purchase and its email from an owner-controlled mailbox before advertising the feature.
4. To pause new email checkouts, set `RECAP_EMAIL_ENABLED` to `"false"` and redeploy the same Worker. Keep the secrets and Durable Object class in place while existing orders finish and issued links expire. Existing archives are removed by their scheduled alarms.

## Operating details

- Upload limit is 16 MiB. Buyers with a larger recap can still buy through Polar and save their cards from the browser.
- Pending archives are deleted after Polar reports the checkout expired or failed. A temporary Polar outage can extend cleanup up to one day past the checkout’s recorded expiry.
- A paid download is valid for seven days after the Worker confirms payment. Resend retries use a stable key within its 24-hour window. Buyers can download directly from the verified return page if email delivery fails.
- The original storefront and historical browser unlock links remain compatible. The email archive requires its own private key and a verified checkout.
- This project uses a SQLite Durable Object migration. Deploy the Worker project with Wrangler. A static ZIP upload in the Cloudflare dashboard does not run the Worker or create the storage binding.
