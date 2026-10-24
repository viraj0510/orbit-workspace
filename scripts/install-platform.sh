#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$ROOT_DIR/infra/terraform"

for command in aws kubectl helm terraform python3; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

AWS_REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"
CLUSTER_NAME="$(terraform -chdir="$TF_DIR" output -raw cluster_name)"
VPC_ID="$(terraform -chdir="$TF_DIR" output -raw vpc_id)"
LBC_ROLE_ARN="$(terraform -chdir="$TF_DIR" output -raw load_balancer_controller_role_arn)"
EXTERNAL_SECRETS_ROLE_ARN="$(terraform -chdir="$TF_DIR" output -raw external_secrets_role_arn)"
AUTOSCALER_ROLE_ARN="$(terraform -chdir="$TF_DIR" output -raw cluster_autoscaler_role_arn)"
APP_RUNTIME_SECRET_ARN="$(terraform -chdir="$TF_DIR" output -raw app_runtime_secret_arn)"
GRAFANA_SECRET_ARN="$(terraform -chdir="$TF_DIR" output -raw grafana_secret_arn)"

aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
kubectl get nodes

helm repo add eks https://aws.github.io/eks-charts
helm repo add external-secrets https://charts.external-secrets.io
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo add argo https://argoproj.github.io/argo-helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace orbit --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout status deployment/ebs-csi-controller -n kube-system --timeout=180s
kubectl apply -f "$ROOT_DIR/deploy/monitoring/gp3-storageclass.yaml"

helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system --version 3.6.1 --wait --timeout 10m \
  --set clusterName="$CLUSTER_NAME" \
  --set region="$AWS_REGION" \
  --set vpcId="$VPC_ID" \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set-string 'serviceAccount.annotations.eks\.amazonaws\.com/role-arn'="$LBC_ROLE_ARN"

helm upgrade --install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace --version 2.13.0 --wait --timeout 10m \
  --set installCRDs=true \
  --set serviceAccount.create=true \
  --set serviceAccount.name=external-secrets \
  --set-string 'serviceAccount.annotations.eks\.amazonaws\.com/role-arn'="$EXTERNAL_SECRETS_ROLE_ARN"

kubectl wait --for=condition=Established crd/clustersecretstores.external-secrets.io --timeout=180s

AWS_REGION="$AWS_REGION" \
APP_RUNTIME_SECRET_ARN="$APP_RUNTIME_SECRET_ARN" \
GRAFANA_SECRET_ARN="$GRAFANA_SECRET_ARN" \
python3 - "$ROOT_DIR/deploy/external-secrets.yaml" <<'PY' | kubectl apply -f -
import os
import pathlib
import sys

manifest = pathlib.Path(sys.argv[1]).read_text()
for key in ("AWS_REGION", "APP_RUNTIME_SECRET_ARN", "GRAFANA_SECRET_ARN"):
    manifest = manifest.replace("${" + key + "}", os.environ[key])
print(manifest, end="")
PY

kubectl wait --for=condition=Ready externalsecret/orbit-runtime -n orbit --timeout=180s
kubectl wait --for=condition=Ready externalsecret/orbit-grafana-auth -n monitoring --timeout=180s

helm upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler \
  --namespace kube-system --version 9.51.0 --wait --timeout 10m \
  --set cloudProvider=aws \
  --set awsRegion="$AWS_REGION" \
  --set autoDiscovery.clusterName="$CLUSTER_NAME" \
  --set rbac.serviceAccount.create=true \
  --set rbac.serviceAccount.name=cluster-autoscaler \
  --set-string 'rbac.serviceAccount.annotations.eks\.amazonaws\.com/role-arn'="$AUTOSCALER_ROLE_ARN"

helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace kube-system --version 3.14.0 --wait --timeout 10m \
  --set replicas=2

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --version 92.11.0 --wait --timeout 20m \
  --values "$ROOT_DIR/deploy/monitoring/values.yaml"
kubectl apply -f "$ROOT_DIR/deploy/monitoring/orbit-alerts.yaml"

helm upgrade --install argo-cd argo/argo-cd \
  --namespace argocd --create-namespace --version 10.10.2 --wait --timeout 20m

echo "Platform add-ons are installed. Next: run scripts/apply-gitops-app.sh with your GitHub owner/repository."
