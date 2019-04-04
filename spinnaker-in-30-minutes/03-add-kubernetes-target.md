# Webinar - Add Kubernetes Deployment Target

Here's what we started with:

* Two EKS Clusters (with two EKS nodes) - one to install Spinnaker in, one to deploy to
* Kubeconfig with full access to each cluster
* Nginx ingress controller installed in the Spinnaker EKS cluster, set up with the following:
  * Certificate for *.webinar.spinnaker.io
  * DNS pointing at *.webinar.spinnaker.io

Here's what we've done so far:
* Installed Spinnaker in our Kubernetes cluster, and exposed it at  https://spinnaker.webinar.armory.io, with an API endpoint at https://gate.webinar.armory.io

Next, we'll add a second Kubernetes cluster as a deployment target to Spinnaker

## Create kubeconfig for source (binary)
* Get binary from https://github.com/armory/spinnaker-tools/releases
* OSX: https://github.com/armory/spinnaker-tools/releases/download/0.0.1/spinnaker-tools-darwin
* Linux: https://github.com/armory/spinnaker-tools/releases/download/0.0.1/spinnaker-tools-linux

Download and run like this:
```bash
./spinnaker-tools create-service-account --kubeconfig kubeconfig-webinar -o kubeconfig-spinnaker-sa
# Choose source kubernetes cluster, new namespace, kubeconfig
```

## Add the second cluster (manual)
From the machine with access to the primary kubeconfig (outside of Halyard):
```bash
export KUBECONFIG=kubeconfig-webinar

CONTEXT=webinar-eks-target
SA_NAMESPACE="spinnaker-system"
SERVICE_ACCOUNT_NAME="spinnaker-target-sa"
ROLE_NAME="spinnaker-role"
ACCOUNT_NAME="kubernetes-target"

tee ${SA_NAMESPACE}-${SERVICE_ACCOUNT_NAME}-service-account.yml <<-EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ${SA_NAMESPACE}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${SERVICE_ACCOUNT_NAME}
  namespace: ${SA_NAMESPACE}
EOF

# Create the service account
kubectl --context ${CONTEXT} apply -f ${SA_NAMESPACE}-${SERVICE_ACCOUNT_NAME}-service-account.yml

# Create a manifest containing the ClusterRoleBinding
tee ${SA_NAMESPACE}-${SERVICE_ACCOUNT_NAME}-rbac.yml <<-EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${SERVICE_ACCOUNT_NAME}-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: ${SERVICE_ACCOUNT_NAME}
  namespace: ${SA_NAMESPACE}
EOF

# Create the ClusterRoleBinding
kubectl --context ${CONTEXT} apply -f ${SA_NAMESPACE}-${SERVICE_ACCOUNT_NAME}-rbac.yml

NEW_CONTEXT=${SA_NAMESPACE}-sa
KUBECONFIG_FILE="kubeconfig-target-sa"

SECRET_NAME=$(kubectl get serviceaccount ${SERVICE_ACCOUNT_NAME} \
  --context ${CONTEXT} \
  --namespace ${SA_NAMESPACE} \
  -o jsonpath='{.secrets[0].name}')
TOKEN_DATA=$(kubectl get secret ${SECRET_NAME} \
  --context ${CONTEXT} \
  --namespace ${SA_NAMESPACE} \
  -o jsonpath='{.data.token}')

# This is necessary to handle both OSX and bash base64, which have different flags
case "$(uname -s)" in
  Darwin*) TOKEN=$(echo ${TOKEN_DATA} | base64 -D);;
  Linux*) TOKEN=$(echo ${TOKEN_DATA} | base64 -d);;
  *) TOKEN=$(echo ${TOKEN_DATA} | base64 -d);;
esac

echo $TOKEN | head -c30; echo ""

kubectl config view --raw > ${KUBECONFIG_FILE}.full.tmp
# Switch working context to correct context
kubectl --kubeconfig ${KUBECONFIG_FILE}.full.tmp config use-context ${CONTEXT}
# Minify
kubectl --kubeconfig ${KUBECONFIG_FILE}.full.tmp \
  config view --flatten --minify > ${KUBECONFIG_FILE}.tmp
# Rename context
kubectl config --kubeconfig ${KUBECONFIG_FILE}.tmp \
  rename-context ${CONTEXT} ${NEW_CONTEXT}
# Create token user
kubectl config --kubeconfig ${KUBECONFIG_FILE}.tmp \
  set-credentials ${CONTEXT}-${SA_NAMESPACE}-token-user \
  --token ${TOKEN}
# Set context to use token user
kubectl config --kubeconfig ${KUBECONFIG_FILE}.tmp \
  set-context ${NEW_CONTEXT} --user ${CONTEXT}-${SA_NAMESPACE}-token-user
# Set context to correct namespace
kubectl config --kubeconfig ${KUBECONFIG_FILE}.tmp \
  set-context ${NEW_CONTEXT} --namespace ${SA_NAMESPACE}
# Flatten/minify kubeconfig
kubectl config --kubeconfig ${KUBECONFIG_FILE}.tmp \
  view --flatten --minify > ${KUBECONFIG_FILE}
# Remove tmp
rm ${KUBECONFIG_FILE}.full.tmp
rm ${KUBECONFIG_FILE}.tmp

cp ${KUBECONFIG_FILE} .secret/
```

# Add Kubernetes Cluster
```bash
export KUBECONFIG_FULL=/home/spinnaker/.secret/kubeconfig-target-sa

# Enter the account name you want Spinnaker to use to identify the deployment target (should be the same as above)
export ACCOUNT_NAME="kubernetes-target"

hal config provider kubernetes account add ${ACCOUNT_NAME} \
  --provider-version v2 \
  --kubeconfig-file ${KUBECONFIG_FULL} \
  --omit-namespaces spinnaker,spinnaker-system \
  --only-spinnaker-managed true

hal deploy apply
```

# Wait for cluster up
```bash
export KUBECONFIG=kubeconfig-webinar

kubectl get pods -n spinnaker
```