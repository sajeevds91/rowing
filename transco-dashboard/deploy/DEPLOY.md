# Deploying to a new server

These steps set up the dashboard on a fresh **Ubuntu 24.04** server (any cloud VM: AWS Lightsail, DigitalOcean, Azure, Hetzner, or a local host). The smallest size (1 CPU, 1 GB RAM) is enough to start.

You need:
- the server's IP address and SSH access as a user with `sudo`
- a domain or subdomain for the portal, e.g. `track.yourcompany.com`
- your SMTP email details (and, when you have them, the track & trace feed and MarineTraffic key)

## 1. Point the domain at the server
At your domain's DNS provider, add an **A record**: `track` → the server's IP address. It can take a few minutes to work.

## 2. Install the software
```bash
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git sqlite3 caddy ufw
node -v   # must be 22.13 or newer
```
(If `caddy` is not found, install it with the steps at https://caddyserver.com/docs/install#debian-ubuntu-raspbian.)

## 3. Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

## 4. Get the code
```bash
sudo useradd --system --create-home --home-dir /opt/transco --shell /usr/sbin/nologin transco
sudo -u transco git clone https://github.com/sajeevds91/rowing.git /opt/transco
cd /opt/transco/transco-dashboard
sudo -u transco npm ci --omit=dev
```
If the repository is private, `git clone` asks you to sign in: use a GitHub **personal access token** (read-only access to this repository) as the password, or add a deploy key.

## 5. Settings
```bash
sudo -u transco cp .env.example .env
sudo -u transco nano .env
sudo chmod 600 .env
```
Set at least:
```
NODE_ENV=production
HOST=127.0.0.1
APP_URL=https://track.yourcompany.com
SESSION_SECRET=<paste the output of: openssl rand -hex 32>
SUPPORT_EMAIL=customerservice@yourcompany.com
SIGNUP_CODE=<a code you give customers, so strangers cannot sign up>
SMTP_HOST=...  SMTP_PORT=587  SMTP_USER=...  SMTP_PASS=...
MAIL_FROM="Transco Consolidation <tracking@yourcompany.com>"
```
Leave `TRACKING_PROVIDER=demo` until your track & trace feed is ready (see the main README).

**Do not run `npm run seed` on the live server.** It creates a demo account with a publicly known password.

## 6. Run it as a service
```bash
sudo -u transco mkdir -p data
sudo cp deploy/transco.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now transco
sudo systemctl status transco      # should say "active (running)"
```
The service starts the app when the server boots and restarts it if it stops.

## 7. HTTPS
```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/track.example.com/track.yourcompany.com/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
Caddy gets a free HTTPS certificate and renews it automatically. Open `https://track.yourcompany.com`, create an account, add a shipment and press **Send me one now** to check email works.

## 8. Backups
```bash
sudo mkdir -p /var/backups/transco && sudo chown transco /var/backups/transco
sudo -u transco crontab -e
# add this line:
15 2 * * * /opt/transco/transco-dashboard/deploy/backup.sh
```
Every night this copies the database and settings to `/var/backups/transco`, keeping 30 days. Copy that folder off the server too (or turn on your cloud provider's disk snapshots), so a lost server doesn't lose customer accounts.

## Updating to a new version
```bash
sudo /opt/transco/transco-dashboard/deploy/update.sh
```

## When something is wrong
| Check | Command |
|---|---|
| App logs | `sudo journalctl -u transco -n 100 --no-pager` |
| Follow logs live | `sudo journalctl -u transco -f` |
| HTTPS / Caddy logs | `sudo journalctl -u caddy -n 100 --no-pager` |
| Restart the app | `sudo systemctl restart transco` |
| Emails failing | look for `[mail] failed` in the app logs, and check the SMTP settings in `.env` |
