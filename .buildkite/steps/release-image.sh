#/bin/bash
set -euo pipefail

IMAGETAG="dev-${BUILDKITE_BRANCH}-${BUILDKITE_BUILD_NUMBER}"

if [[ "${BUILDKITE_TAG}" != "" ]]; then
    docker login -u=$DHUBU -p=$DHUBP
    docker pull cyberway/state-reader:${IMAGETAG}
    docker tag cyberway/state-reader:${IMAGETAG} cyberway/state-reader:${BUILDKITE_TAG}
    docker push cyberway/state-reader:${BUILDKITE_TAG}
fi