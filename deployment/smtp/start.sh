#!/bin/sh
# POSIX /bin/sh compatible (no pipefail)
set -eu

# --- Config (env with defaults) ---
POSTFIX_MYDOMAIN="${POSTFIX_MYDOMAIN:-te-itx-2025.site}"

# Trust loopback + your Docker network (adjust CIDR if needed)
POSTFIX_MYNETWORKS="${POSTFIX_MYNETWORKS:-127.0.0.0/8 [::1]/128 172.18.0.0/16}"

# Optional authenticated smarthost (leave RELAY_HOST empty for direct delivery)
RELAY_HOST="${RELAY_HOST:-}"
RELAY_PORT="${RELAY_PORT:-587}"
RELAY_USER="${RELAY_USER:-}"
RELAY_PASS="${RELAY_PASS:-}"

echo "Configuring Postfix send-only for domain: $POSTFIX_MYDOMAIN"

# --- Minimal dirs; do NOT mass-chown Postfix chroot ---
mkdir -p /var/spool/postfix /var/lib/postfix /var/log
: > /var/log/mail.log || true
chmod 0644 /var/log/mail.log || true

# --- Base identity / network / policy ---
postconf -e "compatibility_level = 3.6"
postconf -e "myhostname = $POSTFIX_MYDOMAIN"
postconf -e "myorigin = $POSTFIX_MYDOMAIN"
postconf -e "inet_interfaces = all"
postconf -e "mydestination ="
postconf -e "mynetworks = $POSTFIX_MYNETWORKS"

# Allow our own network to relay, block others
postconf -e "smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination"

# TLS (inbound/outbound) permissive for send-only
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtp_use_tls = yes"
postconf -e "smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt"
postconf -e "inet_protocols = ipv4"

# --- relayhost (only when set) ---
if [ -n "$RELAY_HOST" ]; then
  echo "Using authenticated relay: $RELAY_HOST:$RELAY_PORT"
  postconf -e "relayhost = [$RELAY_HOST]:$RELAY_PORT"

  # SASL auth for outbound to the relay
  echo "[$RELAY_HOST]:$RELAY_PORT $RELAY_USER:$RELAY_PASS" > /etc/postfix/sasl_passwd
  postmap hash:/etc/postfix/sasl_passwd
  chmod 0600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db

  postconf -e "smtp_sasl_auth_enable = yes"
  postconf -e "smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd"
  postconf -e "smtp_sasl_security_options = noanonymous"
  postconf -e "smtp_sasl_mechanism_filter = plain,login"
else
  echo "No relayhost provided; direct delivery via MX lookups."
  postconf -e "relayhost ="
fi

# --- Local aliases (optional) ---
echo "no-reply: postmaster" > /etc/aliases
newaliases || true

# --- Fix permissions safely ---
if command -v postfix >/dev/null 2>&1; then
  postfix set-permissions || true
fi

# --- Syslog (so /var/log/mail.log gets written) ---
echo "Starting rsyslogd..."
if command -v rsyslogd >/dev/null 2>&1; then
  rsyslogd || true
else
  echo "WARNING: rsyslogd not found; mail logs may be limited."
fi

# --- Start Postfix ---
echo "Starting Postfix..."
if ! service postfix start; then
  echo "Postfix failed to start. Recent logs:" >&2
  if [ -f /var/log/mail.log ]; then tail -n 200 /var/log/mail.log >&2; fi
  if [ -f /var/log/syslog ]; then tail -n 200 /var/log/syslog >&2; fi
  echo "Postfix did not start successfully; sleeping for debug." >&2
  sleep infinity
fi

# --- Health info ---
postconf myhostname myorigin mynetworks relayhost smtpd_recipient_restrictions | sed 's/^/INFO: /'

# --- Keep container alive & stream logs ---
exec tail -F /var/log/mail.log
