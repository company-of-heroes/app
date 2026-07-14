#!/usr/bin/env python3
"""Fetch a URL without TLS verification (Relic API uses a legacy CN-only cert)."""
import ssl
import sys
import urllib.request


def main() -> None:
	if len(sys.argv) != 2:
		raise SystemExit('usage: fetch-insecure.py <url>')

	url = sys.argv[1]
	ctx = ssl.create_default_context()
	ctx.check_hostname = False
	ctx.verify_mode = ssl.CERT_NONE

	with urllib.request.urlopen(url, context=ctx, timeout=15) as response:
		sys.stdout.write(response.read().decode())


if __name__ == '__main__':
	main()
