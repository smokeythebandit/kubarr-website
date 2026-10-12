#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  printf 'Kubarr installer: %s\n' "$*" >&2
  exit 1
}

[[ "$(uname -s)" == Linux ]] || die "Linux is required."
[[ "$(id -u)" -eq 0 ]] || die "Run this installer with sudo, as shown in the install command."

case "$(uname -m)" in
  x86_64|amd64) architecture=x86_64 ;;
  aarch64|arm64) architecture=aarch64 ;;
  *) die "Unsupported CPU architecture '$(uname -m)'. Supported architectures are x86_64 and aarch64." ;;
esac

for tool in curl tar install sha256sum awk; do
  command -v "$tool" >/dev/null 2>&1 || die "Required tool '$tool' is missing. Install it and run this command again."
done

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/kubarr-install.XXXXXX")"
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT

asset="kubarr-linux-${architecture}.tar.gz"
release_url="https://github.com/smokeythebandit/kubarr-website/releases/download/kubarr-cli-latest"
curl --fail --location --silent --show-error --retry 3 --output "$work_dir/$asset" "$release_url/$asset"
curl --fail --location --silent --show-error --retry 3 --output "$work_dir/$asset.sha256" "$release_url/$asset.sha256"

expected_hash="$(awk 'NR == 1 { print $1 }' "$work_dir/$asset.sha256")"
[[ "$expected_hash" =~ ^[[:xdigit:]]{64}$ ]] || die "The published CLI checksum is malformed."
printf '%s  %s\n' "$expected_hash" "$work_dir/$asset" | sha256sum --check --status || die "The downloaded CLI failed its SHA-256 check."

tar -xzf "$work_dir/$asset" --no-same-owner -C "$work_dir" kubarr
[[ -s "$work_dir/kubarr" ]] || die "The CLI archive does not contain the kubarr binary."
install -D -m 0755 "$work_dir/kubarr" /usr/local/bin/kubarr
printf '\nKubarr CLI installed at /usr/local/bin/kubarr. Starting the bootstrap wizard...\n\n'
/usr/local/bin/kubarr bootstrap
