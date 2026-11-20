# Hosting on AWS (plan, not built yet)

The app is static files only. No server, no database.

```
browser ─► CloudFront (HTTPS, cache, security headers)
               │  Origin Access Control
               ▼
           S3 bucket (private, holds app/dist)

GitHub Actions "Deploy" (run by hand)
   ├─ npm ci, npm run check
   ├─ assume the deploy role (OIDC)
   ├─ aws s3 sync app/dist s3://<bucket> --delete
   └─ CloudFront invalidation
```

## Terraform (to write)

- **State:** an S3 bucket with versioning and locking, in the personal
  AWS account.
- **Bucket:** private, block all public access, encryption on.
- **CloudFront:**
  - Origin Access Control to the bucket.
  - `index.html` as the default root object.
  - A response-headers policy: CSP, HSTS, `X-Content-Type-Options`.
  - Cache: long for `assets/*` (hashed names), short for `index.html`.
  - Google Fonts are loaded from `fonts.googleapis.com` and
    `fonts.gstatic.com`. The CSP must allow them, or the fonts must be
    self-hosted.
- **Custom domain (later):**
  - ACM certificate in `us-east-1`.
  - A Route 53 alias record.
  - Until then, use the CloudFront URL.
- **Deploy role for GitHub:**
  - Trusts `token.actions.githubusercontent.com`.
  - Uses the **immutable** subject with numeric ids. Get the prefix with:
    `gh api repos/ArFe/myownsoccertactics/actions/oidc/customization/sub`
  - Keep the context narrow: `...:environment:production`.
  - Permissions: `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject` on the
    bucket, and `cloudfront:CreateInvalidation` on the distribution only.

## Workflow (to write)

- `.github/workflows/deploy.yml` with `workflow_dispatch` only (manual).
- It uses the `production` GitHub environment.
