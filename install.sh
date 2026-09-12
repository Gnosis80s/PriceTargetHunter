#!/usr/bin/env bash
# Install Price Target Hunter into the Omarchy Apps menu / launcher.
#
# Adds:
#   ~/.local/bin/price-target-hunter                       launcher
#   ~/.local/share/applications/price-target-hunter.desktop desktop entry
#   ~/.local/share/icons/hicolor/scalable/apps/price-target-hunter.svg
#   ~/.config/price-target-hunter/home                     repo location
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"

install -Dm755 "$root/bin/price-target-hunter" "$HOME/.local/bin/price-target-hunter"

# Remember where this checkout lives so the launcher can find it.
install -d "$HOME/.config/price-target-hunter"
printf '%s\n' "$root" >"$HOME/.config/price-target-hunter/home"

install -d "$HOME/.local/share/icons/hicolor/scalable/apps"
install -m644 "$root/omarchy/price-target-hunter.svg" \
  "$HOME/.local/share/icons/hicolor/scalable/apps/price-target-hunter.svg"

install -d "$HOME/.local/share/applications"
install -m644 "$root/omarchy/price-target-hunter.desktop" \
  "$HOME/.local/share/applications/price-target-hunter.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo "Installed. Launch \"Price Target Hunter\" from the Omarchy Apps menu."
echo "Command: price-target-hunter   (stop with: price-target-hunter --stop)"
if ! command -v price-target-hunter >/dev/null 2>&1; then
  echo "note: ~/.local/bin is not on PATH for this shell; the desktop entry still works."
fi
