#!/usr/bin/env bash
set -e

# ==============================================================================
# OrbX Sapphire - Automated Let's Encrypt SSL Registration Script
# ==============================================================================

# Read domain and email from environment or parameters
DOMAIN="${1:-nexus.orbx.in}"
EMAIL="${2:-admin@orbx.in}"

echo "=============================================================="
echo " Starting SSL Certificate Registration for: $DOMAIN"
echo " Contact Email: $EMAIL"
echo "=============================================================="

# Ensure certbot directories exist
mkdir -p ./certbot/conf
mkdir -p ./certbot/www/.well-known/acme-challenge

# 1. Start Nginx to serve the HTTP-01 ACME challenge
echo "[1/4] Ensuring Nginx is running and listening on port 80..."
docker compose up -d nginx

# 2. Run Certbot via Docker to request the certificate
echo "[2/4] Requesting SSL certificate from Let's Encrypt..."
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    -d $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email" certbot

# 3. Generate nginx/conf.d/ssl.conf from template
echo "[3/4] Activating SSL HTTPS configuration in Nginx..."
if [ -f "./nginx/conf.d/ssl.conf.template" ]; then
  sed "s/\${DOMAIN}/$DOMAIN/g" ./nginx/conf.d/ssl.conf.template > ./nginx/conf.d/ssl.conf
else
  echo "Template ./nginx/conf.d/ssl.conf.template not found!"
  exit 1
fi

# 4. Reload Nginx to apply SSL certificate
echo "[4/4] Reloading Nginx with HTTPS enabled..."
docker compose exec nginx nginx -s reload || docker compose restart nginx

echo ""
echo "=============================================================="
echo " SUCCESS! SSL Certificate successfully installed!"
echo " Your application is now secured at: https://$DOMAIN"
echo "=============================================================="
