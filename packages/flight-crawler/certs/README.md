`globalsign-rsa-ov-ssl-ca-2018.pem` — public GlobalSign intermediate (issued by
GlobalSign Root CA R3, expires 2028-11-21, SHA-256
`B6:76:FF:A3:…:93:76:4A`). `integration-middleware-website.vietnamairlines.com`
omits it from its TLS chain, so Node can't verify the leaf. Loaded via
`NODE_EXTRA_CA_CERTS` in the `crawl` script; TLS verification stays on.
Source: http://secure.globalsign.com/cacert/gsrsaovsslca2018.crt
