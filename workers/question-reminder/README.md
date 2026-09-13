# Question reminder Worker

This tiny Cloudflare Worker wakes once per day at 11:30 in Asia/Bangkok and
calls the app's protected reminder endpoint. It does not contain database or
Resend credentials.

## Production setup

1. In Vercel, create a random `QUESTION_REMINDER_SECRET` environment variable.
2. From this directory, authenticate and set the same value as a Cloudflare
   Worker secret:

   ```sh
   npx wrangler login
   npx wrangler secret put QUESTION_REMINDER_SECRET
   npx wrangler deploy
   ```

3. Confirm the cron trigger appears in Cloudflare Workers & Pages.

The Worker sends `Authorization: Bearer <secret>` to
`https://ours.htetkooo.dev/api/jobs/question-reminder`. The app verifies that
secret, checks which verified couple members have not answered yesterday's
question, sends each eligible member one email, and records the delivery to
make duplicate scheduler runs harmless.

`wrangler.toml` assumes the couple timezone remains Asia/Bangkok. If it
changes, update the UTC cron expression too.
