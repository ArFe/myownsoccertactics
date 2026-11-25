# Hosting for the tactics board: static files only, no server, no database.
#
#   browser ─► Route 53 alias ─► CloudFront (HTTPS, headers, cache)
#                                    │ Origin Access Control
#                                    ▼
#                                S3 (private, holds app/dist)
#
# Same AWS account as the tournament manager. Two things are shared with it
# and NOT created here:
#   - the Terraform state bucket (tm-tfstate-arfe-cacentral1), under its own key
#   - the GitHub OIDC provider (an account holds only one per URL)
#
# Applied locally, by hand. CI only uploads files (see deploy.yml).
#
#   cd infra/envs/prod
#   terraform init && terraform apply

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
  backend "s3" {
    bucket       = "tm-tfstate-arfe-cacentral1" # owned by myown_tournament_manager's bootstrap
    key          = "myowntactics/envs/prod/terraform.tfstate"
    region       = "ca-central-1"
    use_lockfile = true # native S3 state locking
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { app = "myowntactics", env = "prod" }
  }
}

# CloudFront only accepts certificates from us-east-1. Nothing else is
# created here.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { app = "myowntactics", env = "prod" }
  }
}

variable "region" {
  type    = string
  default = "ca-central-1"
}

locals {
  name_prefix = "tactics-prod"

  # GitHub's immutable OIDC subject: numeric ids survive a rename.
  #   gh api users/ArFe --jq .id
  #   gh api repos/ArFe/myownsoccertactics --jq .id
  #   gh api repos/ArFe/myownsoccertactics/actions/oidc/customization/sub
  # The repo must have use_immutable_subject = true, or GitHub sends the plain
  # "repo:ArFe/myownsoccertactics:..." form and the assume fails.
  github_subject = "repo:ArFe@12927701/myownsoccertactics@973381105:environment:production"
}

# ---- custom domain -----------------------------------------------------------
#
# The domain is registered at Web Hosting Canada and stays there; only DNS is
# delegated to the zone below. Standing it up is two applies, because ACM
# proves ownership by reading a record over public DNS, and until WHC's
# nameservers point here the world still asks WHC and finds nothing.
#
#   1. domain_active = false: creates the zone. Copy the four nameservers from
#      the `domain_nameservers` output into WHC's control panel, and wait for
#      them to take (usually minutes, up to 48h). Check with:
#        dig +short NS myowntactics.ca
#   2. domain_active = true: issues the certificate, puts the names in front of
#      CloudFront, and points the records at it.
#
# Until step 2 the site is served on its *.cloudfront.net name.
variable "domain_name" {
  type    = string
  default = "myowntactics.ca"
}

# true since 2026-11-20: .ca delegates to Route 53 and the certificate is issued.
variable "domain_active" {
  type    = bool
  default = true
}

resource "aws_route53_zone" "web" {
  name    = var.domain_name
  comment = "tactics board (prod) — registrar remains Web Hosting Canada"
}

locals {
  # apex and www both
  domain_aliases = var.domain_active ? [var.domain_name, "www.${var.domain_name}"] : []

  # Keyed by the names we already know, NOT by anything read back from the
  # certificate: for_each keys must be known at plan time.
  validation_by_domain = var.domain_active ? {
    for o in aws_acm_certificate.web[0].domain_validation_options : o.domain_name => o
  } : {}
}

resource "aws_acm_certificate" "web" {
  count                     = var.domain_active ? 1 : 0
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = toset(local.domain_aliases)

  zone_id         = aws_route53_zone.web.zone_id
  name            = local.validation_by_domain[each.key].resource_record_name
  type            = local.validation_by_domain[each.key].resource_record_type
  records         = [local.validation_by_domain[each.key].resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

# Blocks until ACM has read the records back, so CloudFront never gets a
# certificate that is still PENDING_VALIDATION.
resource "aws_acm_certificate_validation" "web" {
  count                   = var.domain_active ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.web[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Alias records, not CNAMEs: a CNAME is illegal at the apex, and alias
# queries to CloudFront are free.
resource "aws_route53_record" "web_a" {
  for_each = toset(local.domain_aliases)
  zone_id  = aws_route53_zone.web.zone_id
  name     = each.key
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_aaaa" {
  for_each = toset(local.domain_aliases)
  zone_id  = aws_route53_zone.web.zone_id
  name     = each.key
  type     = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

# ---- S3 bucket ------------------------------------------------------------------

resource "aws_s3_bucket" "web" {
  bucket_prefix = "${local.name_prefix}-web-"
  # only build output lives here, rebuildable from the repo
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SSE-S3 is the default since 2023; stated so it is visible here.
resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.web.arn } }
    }]
  })
}

# ---- CloudFront -----------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name_prefix}-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

locals {
  # AWS managed policy. It honours the Cache-Control the deploy sets on each
  # object: a year for hashed assets/*, no-cache for index.html.
  cache_optimized_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized

  # Google Fonts are loaded from index.html, so the CSP allows them.
  # 'unsafe-inline' for styles only: Vue and Konva set style attributes.
  # data: and blob: images: PNG export goes through canvas.toDataURL and blobs.
  csp = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ])
}

resource "aws_cloudfront_response_headers_policy" "web" {
  name = "${local.name_prefix}-security-headers"

  security_headers_config {
    content_security_policy {
      content_security_policy = local.csp
      override                = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
}

# The app reads the sport from the address (`/soccer`), but S3 has no file
# there. An address with no file extension gets index.html instead; files
# (`/assets/x.js`, `/favicon.svg`) pass through as they are. The app sends
# `/` and unknown addresses to the default sport's route.
resource "aws_cloudfront_function" "routes" {
  name    = "${local.name_prefix}-routes"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for app routes such as /soccer"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var last = request.uri.split('/').pop();
      if (last.indexOf('.') === -1) request.uri = '/index.html';
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  comment             = "myowntactics (prod)"

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # Sport routes (`/soccer`) are served index.html by the function below.
  default_cache_behavior {
    target_origin_id           = "s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_optimized_id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.web.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.routes.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  aliases = local.domain_aliases

  # With no certificate of our own CloudFront serves its default one (and only
  # answers to *.cloudfront.net); with one, it answers to the aliases above.
  # sni-only is the free option.
  viewer_certificate {
    cloudfront_default_certificate = var.domain_active ? null : true
    acm_certificate_arn            = var.domain_active ? aws_acm_certificate_validation.web[0].certificate_arn : null
    ssl_support_method             = var.domain_active ? "sni-only" : null
    minimum_protocol_version       = var.domain_active ? "TLSv1.2_2021" : null
  }
}

# ---- GitHub deploy role ---------------------------------------------------------
#
# Narrow on purpose: CI uploads files and clears the cache, nothing else.
# Infra changes are applied locally.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "deploy" {
  name = "${local.name_prefix}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # immutable form only, and only the production environment
          "token.actions.githubusercontent.com:sub" = local.github_subject
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "deploy" {
  name = "${local.name_prefix}-deploy"
  role = aws_iam_role.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.web.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.web.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
        Resource = aws_cloudfront_distribution.web.arn
      },
    ]
  })
}

# ---- outputs --------------------------------------------------------------------

output "web_url" {
  value = var.domain_active ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.web.domain_name}"
}

# These three go into the GitHub "production" environment as variables.
output "web_bucket" { value = aws_s3_bucket.web.bucket }
output "distribution_id" { value = aws_cloudfront_distribution.web.id }
output "deploy_role_arn" { value = aws_iam_role.deploy.arn }

# Paste these four into Web Hosting Canada's nameserver settings for the domain.
output "domain_nameservers" { value = aws_route53_zone.web.name_servers }
