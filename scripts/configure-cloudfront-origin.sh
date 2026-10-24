#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$ROOT_DIR/infra/terraform"

for command in kubectl terraform aws; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

ALB_DNS="$(kubectl get ingress orbit-workspace -n orbit -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
if [[ -z "$ALB_DNS" ]]; then
  echo "The AWS load balancer is not ready yet. Check the ingress and load balancer controller logs." >&2
  exit 1
fi

echo "Creating CloudFront with ALB origin ${ALB_DNS}. Review and approve the Terraform plan when prompted."
terraform -chdir="$TF_DIR" apply -var="cloudfront_alb_dns_name=${ALB_DNS}"

CLOUDFRONT_DOMAIN="$(terraform -chdir="$TF_DIR" output -raw cloudfront_domain_name)"
echo "Setting the Orbit browser origin to https://${CLOUDFRONT_DOMAIN}. Review and approve the Terraform plan when prompted."
terraform -chdir="$TF_DIR" apply \
  -var="cloudfront_alb_dns_name=${ALB_DNS}" \
  -var="app_origin=https://${CLOUDFRONT_DOMAIN}"

BEFORE_VERSION="$(kubectl get secret orbit-runtime -n orbit -o jsonpath='{.metadata.resourceVersion}')"
kubectl annotate externalsecret orbit-runtime -n orbit "force-sync=$(date +%s)" --overwrite
SECRET_REFRESHED=false
for attempt in {1..90}; do
  AFTER_VERSION="$(kubectl get secret orbit-runtime -n orbit -o jsonpath='{.metadata.resourceVersion}')"
  if [[ "$AFTER_VERSION" != "$BEFORE_VERSION" ]]; then
    SECRET_REFRESHED=true
    break
  fi
  sleep 2
done
if [[ "$SECRET_REFRESHED" != true ]]; then
  echo "External Secrets did not update orbit-runtime. Check the SecretStore and controller logs before retrying." >&2
  exit 1
fi

kubectl rollout restart deployment/orbit-workspace -n orbit
kubectl rollout status deployment/orbit-workspace -n orbit --timeout=180s

echo "Orbit is available at https://${CLOUDFRONT_DOMAIN}."
