#/bin/bash
set -euo pipefail

IMAGETAG="dev-${BUILDKITE_BRANCH}-${BUILDKITE_BUILD_NUMBER}"

ansible-vault view playbooks/configs/.npmrc.vault --vault-password-file ~/vault_pass > .npmrc
docker build -t cyberway/state-reader:${IMAGETAG} .
rm .npmrc

docker login -u=$DHUBU -p=$DHUBP
docker push cyberway/state-reader:${IMAGETAG}