# Hosting on AWS

The app is static files only. No server, no database.
It lives at **myowntactics.ca**, in the same AWS account as the tournament
manager.

```
browser ─► myowntactics.ca / www ─► Route 53 alias
                                         │
                                         ▼
                                    CloudFront (HTTPS, ACM cert, headers)
                                         │  Origin Access Control
                                         ▼
                                    S3 bucket (private, holds app/dist)

GitHub Actions "Deploy" (run by hand)
   ├─ npm ci, npm run check
   ├─ assume the deploy role (OIDC, immutable subject)
   ├─ upload app/dist to S3
   └─ CloudFront invalidation
```

## What is where

All in [envs/prod/main.tf](envs/prod/main.tf).

| Piece | Region | Notes |
|---|---|---|
| S3 bucket | ca-central-1 | private, encrypted, only CloudFront reads it |
| CloudFront | global | `PriceClass_100`, CSP + HSTS + nosniff headers |
| Route 53 zone | global | registrar stays Web Hosting Canada (WHC) |
| ACM certificate | us-east-1 | apex + `www`; CloudFront needs us-east-1 |
| Deploy role | global | S3 upload + invalidation only |

Shared with the tournament manager, **not** created here:

- Terraform state bucket `tm-tfstate-arfe-cacentral1`, key `myowntactics/envs/prod/...`.
- The GitHub OIDC provider (one per account).

Infra is applied locally. CI only uploads files.

## First setup

```
apply 1 ─► 4 nameservers ─► paste into WHC ─► wait ─► apply 2 ─► GitHub variables ─► Deploy
```

1. **Switch the repo to the immutable OIDC subject** (once):
   ```
   gh api -X PUT repos/ArFe/myownsoccertactics/actions/oidc/customization/sub \
     -F use_default=true -F use_immutable_subject=true
   gh api repos/ArFe/myownsoccertactics/actions/oidc/customization/sub
   ```
   `sub_claim_prefix` must read `repo:ArFe@12927701/myownsoccertactics@973381105`.
2. **Apply 1**, with AWS admin credentials:
   ```
   cd infra/envs/prod
   terraform init
   terraform apply            # domain_active = false
   terraform output domain_nameservers
   ```
   The site is now up on its `*.cloudfront.net` name (empty until a deploy).
3. **At WHC**, set the domain's nameservers to those four. Wait until
   `dig +short NS myowntactics.ca` shows them.
4. **Apply 2:**
   ```
   terraform apply -var domain_active=true
   ```
   Then set `default = true` for `domain_active` in `main.tf`, so a later
   plain apply does not take the domain off.
5. **GitHub:** create the `production` environment and add three variables
   from `terraform output`:
   - `AWS_DEPLOY_ROLE_ARN` ← `deploy_role_arn`
   - `WEB_BUCKET` ← `web_bucket`
   - `DISTRIBUTION_ID` ← `distribution_id`
6. **Deploy:** Actions → Deploy → Run workflow.

## Caching

- `assets/*` have hashed names: cached for a year (`immutable`).
- `index.html` and `favicon.svg`: `no-cache`, so a deploy shows at once.
- The deploy uploads new assets first, then `index.html`, then deletes old
  assets. A page loaded mid-deploy never points at a missing file.

## Security headers

- CSP allows Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`).
- `style-src` has `'unsafe-inline'`: Vue and Konva set style attributes.
- `img-src` allows `data:` and `blob:` for the PNG export.
- Tested 2026-11-19: the built app under this CSP has no violations, fonts
  load and PNG export works.

## Cost

- Route 53 zone: $0.50 a month.
- S3, CloudFront, ACM: cents, or free.
