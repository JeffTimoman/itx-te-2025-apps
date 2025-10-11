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
service postfix start

# Keep container running
tail -f /var/log/mail.log || sleep Infinity
