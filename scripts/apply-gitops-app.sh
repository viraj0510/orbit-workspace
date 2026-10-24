#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Usage: $0 GITHUB_OWNER/GITHUB_REPOSITORY" >&2
  exit 2
fi

REPOSITORY="$1"
REPOSITORY_URL="https://github.com/${REPOSITORY}.git"

kubectl apply -f - <<YAML
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: orbit-workspace
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: ${REPOSITORY_URL}
    targetRevision: main
    path: deploy/chart
    helm:
      valueFiles:
        - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: orbit
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
YAML

echo "Argo CD is watching ${REPOSITORY_URL} on main."
