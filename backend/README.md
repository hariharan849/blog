# Daily Dose backend (AWS SAM)

Serverless backend for the **Daily Dose**: every night at 2 AM it checks the Medium, Substack and RSS
authors you follow, saves new posts, emails you a digest and refreshes the site.

```
EventBridge Scheduler (02:00, your time zone)
        │
        ▼
IngestFunction ──► author feeds (Medium / Substack / RSS)
        │  dedupe, keep posts from the last 48h
        ├──► DynamoDB (sources, items, days)
        ├──► SES digest email
        └──► POST <site>/api/revalidate

HTTP API ──► ApiFunction ──► DynamoDB
  GET  /feed[?day=]      GET /feed/days            (public)
  GET/POST /sources  PATCH/DELETE /sources/{id}  POST /ingest   (admin: Bearer token)
```

| Path | What |
|---|---|
| `src/dailydose/feeds.py` | Turns a Medium username / Substack name / URL into a feed URL; RSS + Atom parser (defusedxml) |
| `src/dailydose/ingest.py` | Scheduled job |
| `src/dailydose/api.py` | HTTP API (Lambda Powertools router) |
| `src/dailydose/store.py` | DynamoDB single-table access |
| `src/dailydose/digest.py` | SES email |
| `template.yaml` | SAM / CloudFormation |
| `scripts/local_api.py` | Run the API locally with an in-memory AWS mock |

## Local development

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
python scripts/local_api.py          # http://127.0.0.1:8787, admin token "dev-token"
```

Point the frontend at it with `FEED_API_URL=http://127.0.0.1:8787` and `FEED_ADMIN_TOKEN=dev-token`.
Locally, **Run now** in /admin runs the job synchronously.

## First deploy

Prerequisites: an AWS account, the [AWS CLI](https://docs.aws.amazon.com/cli/) and
[SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

1. **Create the two secrets** (SSM SecureString, no extra cost):
   ```bash
   aws ssm put-parameter --name /dailydose/admin-token      --type SecureString --value "$(openssl rand -hex 32)"
   aws ssm put-parameter --name /dailydose/revalidate-secret --type SecureString --value "$(openssl rand -hex 32)"
   ```
2. **Verify your email in SES** (sender and, while SES is in sandbox mode, the recipient too):
   ```bash
   aws ses verify-email-identity --email-address you@example.com
   ```
   Click the link AWS emails you.
3. **Deploy:**
   ```bash
   sam build
   sam deploy --guided
   ```
   Answer the prompts. Set `ScheduleTimezone` to your IANA zone (e.g. `Asia/Kolkata`) so the job runs at 2 AM *your* time.
   `DigestTo`/`DigestFrom` are your verified email. `SiteUrl` is the frontend URL, and `RevalidateUrl` is `<SiteUrl>/api/revalidate`.
4. **Wire up the frontend:** copy the `ApiUrl` output into `FEED_API_URL`, and the two SSM values into
   `FEED_ADMIN_TOKEN` and `REVALIDATE_SECRET` (see `frontend/.env.example`).

## Deploys from GitHub Actions

`.github/workflows/deploy-backend.yml` deploys on every push to `main` that touches `backend/`. It stays
switched off until you set the repository variables below (Settings → Secrets and variables → Actions → Variables):

| Variable | Example |
|---|---|
| `AWS_ROLE_ARN` | IAM role GitHub can assume via OIDC ([guide](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)); trust `repo:hariharan849/blog:ref:refs/heads/main` |
| `AWS_REGION` | `us-east-1` |
| `SCHEDULE_TIMEZONE` | `Asia/Kolkata` |
| `DIGEST_TO`, `DIGEST_FROM` | your verified SES address |
| `SITE_URL` | `https://your-domain.com` |

## Cost

At this size (one nightly run, a handful of API calls) Lambda, DynamoDB on-demand, API Gateway, SES and
SSM standard parameters typically stay within the AWS free tier or cost cents per month.
Check current pricing for your region.

## Notes

- **Medium** feeds only include each author's ~10 most recent posts, and Substack about 20. Nightly runs never miss anything, but the archive only starts from the day you follow someone.
- A newly added author only contributes posts from the last `LookbackHours` (48 by default), so following someone doesn't flood the digest with their back catalogue.
- One broken feed never stops the run: its error is saved on the source and shown in /admin.
- The table has `DeletionPolicy: Retain`, so deleting the stack keeps your data.
