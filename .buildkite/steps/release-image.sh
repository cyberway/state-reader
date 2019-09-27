#/bin/bash
set -euo pipefail

IMAGETAG="dev-${BUILDKITE_BRANCH}-${BUILDKITE_BUILD_NUMBER}"

docker login -u=$DHUBU -p=$DHUBP
docker pull cyberway/state-reader:${IMAGETAG}

if [[ "${BUILDKITE_TAG}" != "" ]]; then
    docker tag cyberway/state-reader:${IMAGETAG} cyberway/state-reader:${BUILDKITE_TAG}
    docker push cyberway/state-reader:${BUILDKITE_TAG}
fi