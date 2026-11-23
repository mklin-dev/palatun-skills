# Le PATH de node et pnpm, quand un éditeur lance un hook sans celui du terminal : PNPM_HOME, puis
# fnm, puis nvm. Sourcé par les hooks (`. …/hooks/env.sh`), jamais lancé seul.
case "$(uname -s)" in Darwin) pnpm_home="$HOME/Library/pnpm" ;; *) pnpm_home="$HOME/.local/share/pnpm" ;; esac
export PNPM_HOME="${PNPM_HOME:-$pnpm_home}"
case ":$PATH:" in *":$PNPM_HOME:"*) ;; *) export PATH="$PNPM_HOME:$PATH" ;; esac
if ! command -v node >/dev/null 2>&1; then
  for fnm in "$(command -v fnm)" "$HOME/.local/share/fnm/fnm" /opt/homebrew/bin/fnm; do
    [ -x "$fnm" ] && eval "$("$fnm" env --shell bash)" && break # des export, lisibles par sh
  done
fi
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091 # nvm.sh vit sur le poste, pas dans le dépôt
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
