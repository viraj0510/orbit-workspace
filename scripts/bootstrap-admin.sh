#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=orbit
SECRET_NAME=orbit-bootstrap-admin
JOB_NAME=orbit-bootstrap-admin
TEMP_ENV="$(mktemp)"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""

cleanup() {
  kubectl delete job "$JOB_NAME" -n "$NAMESPACE" --ignore-not-found >/dev/null 2>&1 || true
  kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE" --ignore-not-found >/dev/null 2>&1 || true
  rm -f "$TEMP_ENV"
  unset ADMIN_PASSWORD
}
trap cleanup EXIT

read -r -p "Administrator email: " ADMIN_EMAIL
read -r -s -p "Set a unique administrator password (12+ characters): " ADMIN_PASSWORD
printf '\n'

if [[ ${#ADMIN_PASSWORD} -lt 12 ]]; then
  echo "Password must contain at least 12 characters." >&2
  exit 2
fi

printf 'SEED_ADMIN_EMAIL=%s\nSEED_ADMIN_PASSWORD=%s\n' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" > "$TEMP_ENV"
chmod 600 "$TEMP_ENV"
kubectl create secret generic "$SECRET_NAME" -n "$NAMESPACE" \
  --from-env-file="$TEMP_ENV" --dry-run=client -o yaml | kubectl apply -f -

APP_IMAGE="$(kubectl get deployment orbit-workspace -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')"
if [[ -z "$APP_IMAGE" ]]; then
  echo "The Orbit deployment is not running yet; no administrator was created." >&2
  exit 1
fi

kubectl apply -f - <<YAML
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
  namespace: ${NAMESPACE}
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 180
  template:
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
      containers:
        - name: seed-admin
          image: ${APP_IMAGE}
          command: ["node", "prisma/seed.js"]
          env:
            - name: NODE_ENV
              value: production
          envFrom:
            - secretRef:
                name: orbit-runtime
            - secretRef:
                name: ${SECRET_NAME}
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
YAML

kubectl wait --for=condition=complete "job/${JOB_NAME}" -n "$NAMESPACE" --timeout=180s
kubectl logs "job/${JOB_NAME}" -n "$NAMESPACE"
echo "Administrator bootstrap finished. The temporary Kubernetes secret and job will be removed."
