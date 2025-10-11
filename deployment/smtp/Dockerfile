FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  postfix \
  rsyslog \
  sasl2-bin \
  libsasl2-modules \
  ca-certificates \
  procps \
  && rm -rf /var/lib/apt/lists/*

COPY start.sh /usr/local/bin/start-postfix.sh
RUN chmod +x /usr/local/bin/start-postfix.sh

EXPOSE 25

VOLUME ["/var/spool/postfix","/var/lib/postfix"]

CMD ["/usr/local/bin/start-postfix.sh"]
