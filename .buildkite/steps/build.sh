#/bin/bash
set -euo pipefail

IMAGETAG="${BUILDKITE_BRANCH}-${BUILDKITE_BUILD_NUMBER}"

docker build -t cyberway/state-reader:${IMAGETAG} .

docker login -u=$DHUBU -p=$DHUBP

if [[ "${BUILDKITE_TAG}" != "" ]]; then
    docker tag cyberway/state-reader:${IMAGETAG} cyberway/state-reader:${BUILDKITE_TAG}
    docker tag cyberway/state-reader:${IMAGETAG} cyberway/state-reader:latest
    docker push cyberway/state-reader:${BUILDKITE_TAG}
    docker push cyberway/state-reader:latest
fi