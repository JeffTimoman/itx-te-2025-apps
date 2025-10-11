#!/bin/sh
set -e

# Simple entrypoint to configure postfix as a send-only relay

POSTFIX_MYDOMAIN=${POSTFIX_MYDOMAIN:-te-itx-2025.site}
RELAY_HOST=${RELAY_HOST:-}
RELAY_PORT=${RELAY_PORT:-587}
RELAY_USER=${RELAY_USER:-}
RELAY_PASS=${RELAY_PASS:-}

echo "Configuring Postfix as send-only for domain: ${POSTFIX_MYDOMAIN}"

# Basic main.cf overrides
postconf -e "myhostname = ${POSTFIX_MYDOMAIN}"
postconf -e "myorigin = ${POSTFIX_MYDOMAIN}"
## In Docker we want Postfix to bind to the container network interface (not only loopback)
## so other containers can connect to it via the compose network. Binding only to
## loopback prevents remote containers from reaching port 25 and causes ECONNREFUSED.
postconf -e "inet_interfaces = all"
postconf -e "mydestination ="
postconf -e "relayhost = ${RELAY_HOST:+[${RELAY_HOST}]:}${RELAY_PORT}"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtp_use_tls = yes"
postconf -e "smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt"

if [ -n "${RELAY_USER}" ] && [ -n "${RELAY_PASS}" ] && [ -n "${RELAY_HOST}" ]; then
  echo "Configuring authenticated relay to ${RELAY_HOST}:${RELAY_PORT}"
  echo "${RELAY_HOST}:${RELAY_PORT} ${RELAY_USER}:${RELAY_PASS}" > /etc/postfix/sasl_passwd
  postmap /etc/postfix/sasl_passwd
  chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
  postconf -e "smtp_sasl_auth_enable = yes"
  postconf -e "smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd"
  postconf -e "smtp_sasl_security_options = noanonymous"
  postconf -e "smtp_sasl_mechanism_filter = plain,login"
fi

# Create a no-reply alias
echo "no-reply: postmaster" > /etc/aliases
newaliases || true

echo "Starting postfix..."
# Ensure runtime directories exist and have correct ownership (avoid host mount permission issues)
mkdir -p /var/spool/postfix /var/lib/postfix /var/log
chown -R postfix:postfix /var/spool/postfix /var/lib/postfix || true
chmod -R 700 /var/spool/postfix || true

# Start syslog daemon so Postfix has a place to write mail.log
echo "Starting rsyslog (rsyslogd) if available..."
# Ensure mail.log exists so tail won't fail if rsyslogd hasn't created it yet
touch /var/log/mail.log || true
chmod 644 /var/log/mail.log || true
if command -v rsyslogd >/dev/null 2>&1; then
  # Start rsyslog daemon in the background (non-blocking)
  rsyslogd || true
  echo "rsyslogd started"
else
  echo "rsyslogd not found; syslog output may not be available inside container"
fi

# Try to start postfix; on failure dump logs for debugging and keep the container alive
if ! service postfix start; then
  echo "Postfix failed to start. Dumping recent logs for debugging:" >&2
  echo "--- /var/log/mail.log (last 200 lines) ---" >&2
  if [ -f /var/log/mail.log ]; then
    tail -n 200 /var/log/mail.log >&2 || true
  else
    echo "(no /var/log/mail.log present)" >&2
  fi
  echo "--- /var/log/syslog (last 200 lines) ---" >&2
  if [ -f /var/log/syslog ]; then
    tail -n 200 /var/log/syslog >&2 || true
  else
    echo "(no /var/log/syslog present)" >&2
  fi

  echo "Postfix did not start successfully. Container will sleep for debugging. Fix configuration and restart the container." >&2
  # keep the container running so you can exec into it and inspect files
  sleep Infinity
fi

# Keep container running and stream mail log (follow even if file is created later)
tail -F /var/log/mail.log || sleep Infinity
