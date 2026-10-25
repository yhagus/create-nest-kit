#!/bin/sh
# Installer for create-nest-kit: checks the requirements, downloads the CLI from the GitHub Release,
# verifies its checksum and runs it. Arguments are passed on to the CLI:
#
#   curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh -s -- my-api --yes
#
# Environment:
#   NEST_KIT_VERSION       release tag to install, e.g. v0.1.0 (default: the latest release)
#   NEST_KIT_DOWNLOAD_URL  base URL of the release assets, replacing GitHub (used by tests; file:// works)
#
# Everything runs inside main(), called on the last line, so a truncated download runs nothing.

set -eu

REPO="yhagus/create-nest-kit"
MIN_NODE="24.15.0"
ARCHIVE="create-nest-kit.tar.gz"

say() {
  printf '%s\n' "$*" >&2
}

has() {
  command -v "$1" >/dev/null 2>&1
}

# True when version $1 (e.g. v24.15.0, 24.15.0 or 25.0.0-nightly) is at least version $2 (X.Y.Z).
version_at_least() {
  found=${1#v}
  found_major=${found%%.*}
  found=${found#*.}
  found_minor=${found%%.*}
  found=${found#*.}
  found_patch=${found%%[!0-9]*}

  min_major=${2%%.*}
  min_rest=${2#*.}
  min_minor=${min_rest%%.*}
  min_patch=${min_rest#*.}

  for part in "$found_major" "$found_minor" "$found_patch"; do
    case $part in
      '' | *[!0-9]*) return 1 ;;
    esac
  done

  if [ "$found_major" -ne "$min_major" ]; then
    [ "$found_major" -gt "$min_major" ]
  elif [ "$found_minor" -ne "$min_minor" ]; then
    [ "$found_minor" -gt "$min_minor" ]
  else
    [ "$found_patch" -ge "$min_patch" ]
  fi
}

# Prints a problem for each missing requirement; returns non-zero when there was any.
check_requirements() {
  problems=0

  if has node; then
    node_version=$(node --version 2>/dev/null || echo unknown)
    if version_at_least "$node_version" "$MIN_NODE"; then
      say "  node      $node_version"
    else
      say "  node      $node_version: create-nest-kit needs Node.js 24.15 or newer."
      problems=1
    fi
  else
    say "  node      not found: create-nest-kit needs Node.js 24.15 or newer."
    problems=1
  fi
  if [ "$problems" -ne 0 ]; then
    say "            Install Node.js 24 from https://nodejs.org, or with \`fnm install 24\` or \`nvm install 24\`."
  fi

  if has curl; then
    say "  download  curl"
  elif has wget; then
    say "  download  wget"
  else
    say "  download  neither curl nor wget found: install one of them."
    problems=1
  fi

  if has tar; then
    say "  extract   tar"
  else
    say "  extract   tar not found: install tar."
    problems=1
  fi

  if has sha256sum; then
    say "  checksum  sha256sum"
  elif has shasum; then
    say "  checksum  shasum"
  elif has openssl; then
    say "  checksum  openssl"
  else
    say "  checksum  no SHA-256 tool found: install sha256sum (coreutils), shasum (perl) or openssl."
    problems=1
  fi

  return "$problems"
}

# download URL FILE
download() {
  if has curl; then
    curl -fsSL -o "$2" "$1"
  else
    wget -q -O "$2" "$1"
  fi
}

# Prints the SHA-256 of FILE as lowercase hex.
sha256_of() {
  if has sha256sum; then
    sum=$(sha256sum "$1")
    printf '%s\n' "${sum%% *}"
  elif has shasum; then
    sum=$(shasum -a 256 "$1")
    printf '%s\n' "${sum%% *}"
  else
    sum=$(openssl dgst -sha256 "$1")
    printf '%s\n' "${sum##* }"
  fi
}

release_url() {
  if [ -n "${NEST_KIT_DOWNLOAD_URL:-}" ]; then
    printf '%s\n' "${NEST_KIT_DOWNLOAD_URL%/}"
  elif [ -n "${NEST_KIT_VERSION:-}" ]; then
    printf '%s\n' "https://github.com/$REPO/releases/download/$NEST_KIT_VERSION"
  else
    printf '%s\n' "https://github.com/$REPO/releases/latest/download"
  fi
}

main() {
  case ${NEST_KIT_VERSION:-} in
    '' | v[0-9]*) ;;
    *)
      say "NEST_KIT_VERSION must be a release tag like v0.1.0 (got \"$NEST_KIT_VERSION\")."
      exit 1
      ;;
  esac

  say "create-nest-kit installer"
  say "Checking requirements:"
  if ! check_requirements; then
    say "Nothing was downloaded. Fix the problems above and run the installer again."
    exit 1
  fi

  base_url=$(release_url)
  work_dir=$(mktemp -d)
  trap 'rm -rf "$work_dir"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  say "Downloading $base_url/$ARCHIVE"
  if ! download "$base_url/$ARCHIVE" "$work_dir/$ARCHIVE" ||
    ! download "$base_url/$ARCHIVE.sha256" "$work_dir/$ARCHIVE.sha256"; then
    say "Download failed. Check the release exists: https://github.com/$REPO/releases"
    exit 1
  fi

  read -r expected_sum _ <"$work_dir/$ARCHIVE.sha256" || true
  actual_sum=$(sha256_of "$work_dir/$ARCHIVE")
  if [ "$actual_sum" != "${expected_sum:-}" ]; then
    say "Checksum mismatch for $ARCHIVE: expected ${expected_sum:-nothing}, got $actual_sum. Aborting."
    exit 1
  fi
  say "Checksum verified."

  tar -xzf "$work_dir/$ARCHIVE" -C "$work_dir"
  cli="$work_dir/create-nest-kit/dist/cli.js"
  say ""

  # Under `curl | sh` stdin is this script, not the terminal: give the wizard the terminal instead.
  # Opening /dev/tty fails without a controlling terminal (CI, containers), so try it first.
  if [ ! -t 0 ] && (: </dev/tty) 2>/dev/null; then
    node "$cli" "$@" </dev/tty
  else
    node "$cli" "$@"
  fi
}

main "$@"
