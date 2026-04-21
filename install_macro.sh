#!/bin/bash

echo "========================================"
echo " SMA Strategy Dashboard Macro Installer"
echo "========================================"

# Detect absolute path of the directory where the script is located
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Identify the shell configuration file (defaults to bashrc, supports zsh for Mac/Linux)
if [ "$(basename "$SHELL")" = "zsh" ]; then
    RC_FILE="$HOME/.zshrc"
else
    RC_FILE="$HOME/.bashrc"
fi

echo "Installing 'smastrat' macro into $RC_FILE..."
echo "Targeting Project Directory: $REPO_DIR"

# Append the macro definition to the profile config
cat << EOF >> "$RC_FILE"

# === SMA Strategy Dashboard Macro (Installed from $REPO_DIR) ===
smastrat() {
  echo "[SMA] Terminating background dashboard instances..."
  kill -9 \$(lsof -t -i:3000) 2>/dev/null
  
  echo "[SMA] Switching to dashboard directory..."
  cd "$REPO_DIR" || return
  
  echo "[SMA] Booting up Vite..."
  # Fully detach the Vite server strictly surviving terminal exit
  (nohup ./node_modules/.bin/vite --port 3000 --strictPort > /dev/null 2>&1 & disown)
  
  echo "[SMA] Opening browser..."
  sleep 2
  if command -v xdg-open > /dev/null; then
      xdg-open "http://localhost:3000"
  elif command -v open > /dev/null; then
      open "http://localhost:3000"
  fi
  
  exit
}
EOF

echo ""
echo "Installation Success!"
echo "--------------------------------------------------------"
echo "To finalize the installation, either restart your terminal"
echo "or simply run this command:"
echo ""
echo "  source $RC_FILE"
echo ""
echo "--------------------------------------------------------"
echo "You can now effortlessly type 'smastrat' from ANY folder on your"
echo "computer to instantly boot up and view the backtester dashboard!"
