#!/bin/bash

if [ ! -f .nvmrc ]; then
  echo "Error: No .nvmrc file found in current directory"
  exit 1
fi

nvmrc=$(cat .nvmrc)
if [ -z "$nvmrc" ]; then
  echo "Error: .nvmrc file is empty"
  exit 1
fi

if [ "$nvmrc" == "$(nvm current)" ]; then
  echo "Node.js version $nvmrc is already in use"
  exit 0
fi

if [ ! -x "$(command -v nvm)" ]; then
  echo "nvm is not installed. Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  source ~/.bashrc
fi

if ! nvm ls $nvmrc >/dev/null 2>&1; then
  echo "Node.js version $nvmrc is not installed. Installing..."
  nvm install $nvmrc
fi

nvm use $nvmrc
echo "Node.js version $nvmrc has been set"
