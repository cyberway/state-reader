#/bin/bash
set -euo pipefail

IMAGETAG="dev-${BUILDKITE_BRANCH}-${BUILDKITE_BUILD_NUMBER}"

ansible-vault view playbooks/configs/.npmrc.vault --vault-password-file ~/vault_pass > .npmrc

docker build -t cyberway/state-reader:${IMAGETAG} .
docker push cyberway/state-reader:${IMAGETAG}

rm .npmrc

docker login -u=$DHUBU -p=$DHUBP

if [[ "${BUILDKITE_TAG}" != "" ]]; then
    docker tag cyberway/state-reader:${IMAGETAG} cyberway/state-reader:${BUILDKITE_TAG}
    docker push cyberway/state-reader:${BUILDKITE_TAG}

    docker tag cyberway/state-reader:${IMAGETAG} cyberway/state-reader:latest
    docker push cyberway/state-reader:latest
fi