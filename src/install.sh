#!/usr/bin/env bash
set -Eeuo pipefail

cyan='' green='' dim='' reset=''
if [[ -t 1 && -z "${NO_COLOR+x}" && "${TERM:-}" != dumb ]]; then
  cyan=$'\033[36m' green=$'\033[32m' dim=$'\033[2m' reset=$'\033[0m'
fi

status() {
  printf '  %s%s%s  %s' "$1" "$2" "$reset" "$3"
  if [[ -n "${4:-}" ]]; then
    printf ' %s· %s%s' "$dim" "$4" "$reset"
  fi
  printf '\n'
}

die() {
  printf 'Kubarr installer: %s\n' "$*" >&2
  exit 1
}

[[ "$(uname -s)" == Linux ]] || die "Linux is required."
[[ -n "${HOME:-}" && "$HOME" == /* ]] || die "HOME must be set to an absolute path."
install_path="$HOME/.local/bin/kubarr"

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
release_url="https://github.com/smokeythebandit/kubarr-cli/releases/latest/download"
printf '\n'
status "$cyan" '↓' 'Downloading Kubarr CLI' "linux/$architecture"
curl --fail --location --silent --show-error --retry 3 --output "$work_dir/$asset" "$release_url/$asset"
curl --fail --location --silent --show-error --retry 3 --output "$work_dir/$asset.sha256" "$release_url/$asset.sha256"

expected_hash="$(awk 'NR == 1 { print $1 }' "$work_dir/$asset.sha256")"
[[ "$expected_hash" =~ ^[[:xdigit:]]{64}$ ]] || die "The published CLI checksum is malformed."
printf '%s  %s\n' "$expected_hash" "$work_dir/$asset" | sha256sum --check --status || die "The downloaded CLI failed its SHA-256 check."
status "$green" '✓' 'Download verified' 'SHA-256'

tar -xzf "$work_dir/$asset" --no-same-owner -C "$work_dir" kubarr
[[ -s "$work_dir/kubarr" ]] || die "The CLI archive does not contain the kubarr binary."
bootstrap_help="$("$work_dir/kubarr" bootstrap --help)" || die "The downloaded CLI could not run."
[[ "$bootstrap_help" == *"--web-port"* ]] || die "The published CLI is outdated and does not support the web installer. Updated CLI binaries must be published before retrying."
install -D -m 0755 "$work_dir/kubarr" "$install_path"
status "$green" '✓' 'CLI installed' "$install_path"
if [[ "$(command -v kubarr || true)" != "$install_path" ]]; then
  printf '\n  %s\n' 'To use kubarr from your shell, add this to your shell profile:'
  printf '  %s\n' 'export PATH="$HOME/.local/bin:$PATH"'
fi

# Launch the installed binary as the current user, retaining their kubeconfig.
cleanup
trap - EXIT
exec "$install_path" bootstrap --web
