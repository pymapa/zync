# GCP Deployment with Terraform

Deploy Zync to a GCP e2-micro instance using the Always Free Tier. No Redis, no load balancer — single instance running the API, static files, and webhook worker in one process.

**Expected cost: $0/month** (within free tier limits)

---

## Architecture

```
Internet
   │
   ▼ HTTPS (443)
┌─────────────────────────┐
│  Static External IP     │  ← Free while attached
│  Firewall (80, 443, 22) │
│                         │
│  nginx (reverse proxy)  │  ← SSL via Let's Encrypt
│   ├─ /        → static  │     (React SPA from /app/public)
│   └─ /api/*   → proxy   │     → localhost:3001
│                         │
│  Node.js (systemd)      │  ← Express API
│   ├─ API server         │     + webhook processor
│   └─ Webhook worker     │     (same process)
│                         │
│  Persistent Disk 30GB   │  ← Free tier
│   └─ /data/zync.db      │     SQLite database
└─────────────────────────┘
  GCE e2-micro, us-central1  ← Free tier eligible
```

---

## Free Tier Constraints

Stay within these limits to pay $0:

| Resource | Free Tier Limit | What We Use |
|----------|-----------------|-------------|
| Instance | 1× e2-micro | 1× e2-micro |
| Region | us-central1, us-west1, or us-east1 | us-central1 |
| Persistent disk | 30 GB (standard) | 30 GB |
| Outbound transfer | 1 GB/month (after 200 GB regional) | Minimal |
| Static IP | Free while attached to running instance | 1 |

---

## Files to Create

```
zync/
├── terraform/
│   ├── main.tf                  # All GCP resources
│   ├── variables.tf             # Input variables
│   ├── outputs.tf               # Outputs (IP, SSH command, etc.)
│   ├── terraform.tfvars.example # Variable template (committed)
│   └── files/
│       ├── startup.sh           # VM bootstrap script
│       ├── nginx.conf           # Reverse proxy config
│       └── zync.service         # systemd unit file
├── scripts/
│   ├── deploy.sh                # Full deploy (build → upload → restart)
│   └── build.sh                 # Build frontend + backend
├── .env.production.example      # Production env template
└── .gitignore                   # Updated with terraform exclusions
```

---

## terraform/variables.tf

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (must be free-tier eligible)"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "instance_name" {
  description = "Compute instance name"
  type        = string
  default     = "zync-app"
}

variable "machine_type" {
  description = "Machine type (e2-micro is always free)"
  type        = string
  default     = "e2-micro"
}

variable "disk_size_gb" {
  description = "Persistent disk size in GB (30 GB max for free tier)"
  type        = number
  default     = 30
}

variable "ssh_pub_key_path" {
  description = "Path to your SSH public key file"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH (your IP/32)"
  type        = string
}

# --- Application secrets ---

variable "strava_client_id" {
  description = "Strava OAuth client ID"
  type        = string
  sensitive   = true
}

variable "strava_client_secret" {
  description = "Strava OAuth client secret"
  type        = string
  sensitive   = true
}

variable "strava_webhook_verify_token" {
  description = "Token used to verify Strava webhook subscriptions"
  type        = string
  sensitive   = true
  default     = "STRAVA"
}

variable "cookie_secret" {
  description = "Secret for signing session cookies (min 32 chars). Generate: openssl rand -hex 32"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Custom domain (optional). If empty, app is reachable by IP only."
  type        = string
  default     = ""
}
```

---

## terraform/main.tf

```hcl
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  required_version = ">= 1.8"
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ---------------------------------------------------------------------------
# Static external IP
# ---------------------------------------------------------------------------
resource "google_compute_address" "static_ip" {
  name   = "${var.instance_name}-ip"
  region = var.region
}

# ---------------------------------------------------------------------------
# Firewall rules
# ---------------------------------------------------------------------------
resource "google_compute_firewall" "allow_http_https" {
  name    = "${var.instance_name}-http-https"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server"]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.instance_name}-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = [var.allowed_ssh_cidr]
  target_tags   = ["ssh-server"]
}

# ---------------------------------------------------------------------------
# Compute instance
# ---------------------------------------------------------------------------
resource "google_compute_instance" "app" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["http-server", "ssh-server"]

  boot_disk {
    initialize_params {
      image       = "debian-cloud/debian-12"
      size        = var.disk_size_gb
      type        = "pd-standard"  # standard = free tier; pd-ssd is NOT free
    }
  }

  network_interface {
    network = "default"

    access_config {
      nat_ip = google_compute_address.static_ip.address
    }
  }

  # Startup script bootstraps the VM on first boot
  metadata = {
    startup-script = templatefile("${path.module}/files/startup.sh", {
      strava_client_id            = var.strava_client_id
      strava_client_secret        = var.strava_client_secret
      strava_webhook_verify_token = var.strava_webhook_verify_token
      cookie_secret               = var.cookie_secret
      frontend_url                = var.domain_name != "" ? "https://${var.domain_name}" : "http://${google_compute_address.static_ip.address}"
      nginx_conf                  = file("${path.module}/files/nginx.conf")
      service_file                = file("${path.module}/files/zync.service")
    })

    ssh-keys = "deploy:${file(var.ssh_pub_key_path)}"
  }

  # Allow gcloud to stop the instance for maintenance events
  scheduling {
    on_host_maintenance = "MIGRATE"
  }

  # Lifecycle: don't replace the instance if only the startup script changes
  # (we re-deploy via deploy.sh, not by recreating the VM)
  lifecycle {
    ignore_changes = [metadata["startup-script"]]
  }
}
```

---

## terraform/outputs.tf

```hcl
output "instance_ip" {
  description = "Static external IP of the instance"
  value       = google_compute_address.static_ip.address
}

output "ssh_command" {
  description = "SSH command to connect as the deploy user"
  value       = "ssh deploy@${google_compute_address.static_ip.address}"
}

output "app_url" {
  description = "URL where the app will be reachable"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${google_compute_address.static_ip.address}"
}
```

---

## terraform/files/startup.sh

Runs once when the VM boots for the first time. Responsibilities:

1. Update system packages
2. Install Node.js 20 LTS (from NodeSource), nginx, certbot, and build tools (python3, g++, make — required by better-sqlite3)
3. Create `/app` (application) and `/data` (SQLite) directories, owned by the `deploy` user
4. Write the `.env` file to `/app/.env` with the secrets injected via `templatefile()` from Terraform
5. Write `nginx.conf` to `/etc/nginx/sites-enabled/zync`
6. Write `zync.service` to `/etc/systemd/system/` and enable it (don't start — no code yet)
7. Enable and configure UFW: allow 22, 80, 443; deny everything else

```bash
#!/usr/bin/env bash
set -euo pipefail

# --- 1. System updates ---
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get upgrade -yqq

# --- 2. Dependencies ---
# Node.js 20 LTS
curl -sL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -yqq nodejs

# nginx, certbot, build tools
apt-get install -yqq nginx certbot python3-certbot-nginx \
  git build-essential python3 g++ make

# --- 3. Directory structure ---
useradd -m -s /bin/bash deploy || true
mkdir -p /app /data
chown -R deploy:deploy /app /data

# --- 4. Environment file ---
cat <<EOF > /app/.env
PORT=3001
NODE_ENV=production
TRUST_PROXY=1
STRAVA_CLIENT_ID=${strava_client_id}
STRAVA_CLIENT_SECRET=${strava_client_secret}
STRAVA_WEBHOOK_VERIFY_TOKEN=${strava_webhook_verify_token}
FRONTEND_URL=${frontend_url}
COOKIE_SECRET=${cookie_secret}
EOF
chmod 600 /app/.env
chown deploy:deploy /app/.env

# --- 5. nginx ---
rm -f /etc/nginx/sites-enabled/default
cat <<'NGINX' > /etc/nginx/sites-enabled/zync
${nginx_conf}
NGINX
nginx -t && systemctl enable nginx && systemctl restart nginx

# --- 6. systemd service ---
cat <<'SERVICE' > /etc/systemd/system/zync.service
${service_file}
SERVICE
systemctl daemon-reload
systemctl enable zync
# Don't start yet — application code hasn't been deployed

# --- 7. Firewall ---
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
echo "y" | ufw enable
```

---

## terraform/files/nginx.conf

```nginx
server {
    listen 80;
    listen [::]:80;

    # Replace with your domain after SSL is configured.
    # certbot will rewrite this block automatically.
    server_name _;

    root /app/public;
    index index.html;

    # --- Static assets (React SPA) ---
    # Long cache for hashed asset files (JS/CSS bundles)
    location ~* \.(js|css|png|jpg|gif|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback: any non-file path serves index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # --- API proxy ---
    location /api/ {
        proxy_pass        http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header  Host              $host;
        proxy_set_header  X-Real-IP         $remote_addr;
        proxy_set_header  X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header  X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
    }

    # --- Security headers ---
    add_header X-Frame-Options        "SAMEORIGIN"  always;
    add_header X-Content-Type-Options "nosniff"     always;

    # --- Compression ---
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1024;
}
```

---

## terraform/files/zync.service

```ini
[Unit]
Description=Zync — Strava Activity Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/app
EnvironmentFile=/app/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

# --- Hardening ---
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/app /data
PrivateTmp=true

# --- Logging ---
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zync

[Install]
WantedBy=multi-user.target
```

---

## terraform/terraform.tfvars.example

Committed to the repo. The actual `terraform.tfvars` is gitignored.

```hcl
project_id                  = "your-gcp-project-id"
allowed_ssh_cidr            = "0.0.0.0/32"   # Replace with your IP/32
ssh_pub_key_path            = "~/.ssh/id_ed25519.pub"

strava_client_id            = ""
strava_client_secret        = ""
strava_webhook_verify_token = "STRAVA"
cookie_secret               = ""             # openssl rand -hex 32
domain_name                 = ""             # optional
```

---

## scripts/build.sh

Builds frontend and backend, assembles the deployable artifact in `deploy/`.

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Building frontend ==="
npm ci --ignore-scripts
npm run build
# Output: dist/

echo "=== Building backend ==="
cd server
npm ci --ignore-scripts
npm run build
# Output: dist/

echo "=== Assembling deploy package ==="
cd "$REPO_ROOT"
rm -rf deploy
mkdir -p deploy/public

# Backend: compiled code + package files
cp -r server/dist          deploy/
cp   server/package.json   deploy/
cp   server/package-lock.json deploy/

# Frontend: static build → served by nginx
cp -r dist/*               deploy/public/

echo "=== Done: deploy/ is ready ==="
```

---

## scripts/deploy.sh

Full deployment: build → upload → install deps → migrate → restart → verify.

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# --- Resolve instance IP from Terraform output ---
INSTANCE_IP=$(terraform -chdir=terraform output -raw instance_ip)
echo "Deploying to $INSTANCE_IP"

# --- 1. Build ---
bash scripts/build.sh

# --- 2. Upload ---
# rsync the deploy/ directory; delete files on remote that no longer exist locally
rsync -avz --delete deploy/ "deploy@${INSTANCE_IP}:/app/"

# --- 3. Install production dependencies on remote ---
ssh "deploy@${INSTANCE_IP}" "cd /app && npm ci --omit=dev"

# --- 4. Run database migrations ---
ssh "deploy@${INSTANCE_IP}" "cd /app && node -e \"
  require('dotenv').config();
  require('./dist/scripts/migrate');
\""

# --- 5. Restart service ---
ssh "deploy@${INSTANCE_IP}" "sudo systemctl restart zync"

# --- 6. Verify ---
sleep 3
echo "--- Health check ---"
curl -s "http://${INSTANCE_IP}/api/health" && echo
echo "--- Webhook processor ---"
curl -s "http://${INSTANCE_IP}/api/health/webhook-processor" && echo

echo "=== Deployment complete ==="
```

> **Note:** Step 4 (migrations) assumes the compiled migration script is callable via the path shown.
> Adjust the `node -e` invocation after verifying where `migrate.ts` compiles to in `server/dist/`.

---

## .env.production.example

Reference for what ends up in `/app/.env` on the VM (populated by Terraform).

```bash
PORT=3001
NODE_ENV=production
TRUST_PROXY=1

STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_WEBHOOK_VERIFY_TOKEN=STRAVA
FRONTEND_URL=

COOKIE_SECRET=
```

---

## .gitignore additions

```
# Terraform state and secrets
terraform/.terraform/
terraform/.terraform.lock.hcl
terraform/terraform.tfstate
terraform/terraform.tfstate.backup
terraform/terraform.tfvars

# Build / deploy artifact
deploy/
```

---

## Deployment Workflow

### Prerequisites (install once)

```bash
# Terraform
brew install terraform          # or https://developer.hashicorp.com/terraform/downloads

# gcloud CLI + auth
brew install google-cloud-sdk
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### First deployment

```bash
# 1. Copy example tfvars and fill in real values
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# edit terraform/terraform.tfvars

# 2. Generate cookie secret (paste into tfvars)
openssl rand -hex 32

# 3. Get your public IP for the SSH firewall rule
curl -s https://api.ipify.org
# paste into allowed_ssh_cidr as x.x.x.x/32

# 4. Initialise + plan + apply
terraform -chdir=terraform init
terraform -chdir=terraform plan
terraform -chdir=terraform apply   # creates VM, firewall, static IP

# 5. Wait ~2 min for startup script to finish, then deploy the app
bash scripts/deploy.sh

# 6. (Optional) Set up SSL — only if you have a custom domain
ssh deploy@$(terraform -chdir=terraform output -raw instance_ip)
sudo certbot --nginx -d yourdomain.com
# certbot rewrites nginx config automatically; auto-renewal is enabled by default
```

### Subsequent deployments

```bash
bash scripts/deploy.sh
```

### Tear down

```bash
terraform -chdir=terraform destroy
```

---

## Monitoring & Maintenance

| What | How |
|------|-----|
| App logs | `ssh deploy@IP "journalctl -u zync -f"` |
| nginx logs | `ssh deploy@IP "tail -f /var/log/nginx/error.log"` |
| Health | `curl https://yourdomain.com/api/health` |
| Webhook worker | `curl https://yourdomain.com/api/health/webhook-processor` |
| DB backup | `ssh deploy@IP "cp /data/zync.db /data/zync.db.$(date +%Y%m%d)"` |
| SSL renewal check | `ssh deploy@IP "sudo certbot renew --dry-run"` |

---

## Disaster Recovery

If the VM is lost, the database is gone unless you have backups.

1. Re-run `terraform apply` — recreates the VM with the same static IP.
2. Restore the latest SQLite backup to `/data/zync.db`.
3. Run `scripts/deploy.sh`.

Consider automating daily backups of `/data/zync.db` to a GCS bucket as a follow-up.
