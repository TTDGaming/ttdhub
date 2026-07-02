#!/usr/bin/env bash
# Mo Cloudflare Tunnel tam thoi toi MS Hub (URL doi moi lan chay).
# Tunnel co dinh + ten mien rieng: xem docs/cloudflare-tunnel.md
exec cloudflared tunnel --url "http://localhost:${PORT:-3689}"
