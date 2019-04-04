# Webinar - Install Spinnaker

Here's what we have so far:

* Two EKS Clusters (with two EKS nodes) - one to install Spinnaker in, one to deploy to
* Kubeconfig with full access to each cluster
* Nginx ingress controller installed in the Spinnaker EKS cluster, set up with the following:
  * Certificate for *.webinar.spinnaker.io
  * DNS pointing *.webinar.spinnaker.io at our ingress controller

# Introduction to kubeconfigs (slide)

In working directory:
```bash
mkdir .hal
mkdir .kube
mkdir .secret
```

Create S3 bucket (via UI):
armory-webinar-20190329
keep all versions of object in the same buket
automatically encrypt

Services > IAM
Users
Create user
armory-webinar-20190329-user
programmatic access
permissions:
no permissions

1. grab access key and secret access key (will have to erase this later)

1. go to user
1. add inline permissions, JSON

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::armory-webinar-20190329"
        },
        {
            "Effect": "Allow",
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::armory-webinar-20190329",
                "arn:aws:s3:::armory-webinar-20190329/*"
            ]
        }
    ]
}
```

## Validate access:
```bash
export AWS_ACCESS_KEY_ID=
export AWS_SECRET_ACCESS_KEY=
aws sts get-caller-identity

aws s3 ls armory-webinar-20190329

unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
```

## Create kubeconfig for source (binary)
* Get binary from https://github.com/armory/spinnaker-tools/releases
* OSX: https://github.com/armory/spinnaker-tools/releases/download/0.0.1/spinnaker-tools-darwin
* Linux: https://github.com/armory/spinnaker-tools/releases/download/0.0.1/spinnaker-tools-linux

Download and run like this:
```bash
./spinnaker-tools create-service-account --kubeconfig kubeconfig-webinar -o kubeconfig-spinnaker-sa
# Choose source kubernetes cluster, new namespace, kubeconfig
```


## Create kubeconfig for source (long method)
```bash
export KUBECONFIG=kubeconfig-webinar

CONTEXT=$(kubectl config current-context)
SA_NAMESPACE="spinnaker"
SERVICE_ACCOUNT_NAME="spinnaker-sa"
ROLE_NAME="spinnaker-role"
ACCOUNT_NAME="spinnaker"

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

kubectl --context ${CONTEXT} apply -f ${SA_NAMESPACE}-${SERVICE_ACCOUNT_NAME}-service-account.yml

tee ${SA_NAMESPACE}-${SERVICE_ACCOUNT_NAME}-rbac.yml <<-EOF
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${ROLE_NAME}
  namespace: ${SA_NAMESPACE}
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${SERVICE_ACCOUNT_NAME}-binding
  namespace: ${SA_NAMESPACE}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: ${ROLE_NAME}
subjects:
- kind: ServiceAccount
  name: ${SERVICE_ACCOUNT_NAME}
  namespace: ${SA_NAMESPACE}
EOF

kubectl --context ${CONTEXT} apply -f ${SA_NAMESPACE}-${SERVICE_ACCOUNT_NAME}-rbac.yml

#### 
NEW_CONTEXT=${SA_NAMESPACE}-sa
KUBECONFIG_FILE="kubeconfig-spinnaker-sa"

SECRET_NAME=$(kubectl get serviceaccount ${SERVICE_ACCOUNT_NAME} \
  --context ${CONTEXT} \
  --namespace ${SA_NAMESPACE} \
  -o jsonpath='{.secrets[0].name}')
TOKEN_DATA=$(kubectl get secret ${SECRET_NAME} \
  --context ${CONTEXT} \
  --namespace ${SA_NAMESPACE} \
  -o jsonpath='{.data.token}')

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

# Recap
Now, we have three things:
* A kubeconfig (in `.secret/kubeconfig-spinnaker-sa`), with a service account that has clusteradmin access to our 'source' cluster
* An S3 bucket, with history and encryption turned on
* An AWS IAM user with access to the bucket, and an access key/secret access key for that user

# Start the Docker container
```bash
docker run --name halyard -it --rm \
  -v ${PWD}/.hal:/home/spinnaker/.hal \
  -v ${PWD}/.secret:/home/spinnaker/.secret \
  gcr.io/spinnaker-marketplace/halyard:stable
```


# Get into the container
```bash
docker exec -it halyard bash

alias ll='ls -alh'
cd ~
export PS1="\h:\W \u\$ "
```

# Run halyard commands
```bash
ACCOUNT_NAME=spinnaker
NAMESPACE=spinnaker
KUBECONFIG_FULL=/home/spinnaker/.secret/kubeconfig-spinnaker-sa

hal config provider kubernetes enable
hal config features edit --artifacts true

hal config provider kubernetes account add ${ACCOUNT_NAME} \
  --provider-version v2 \
  --kubeconfig-file ${KUBECONFIG_FULL} \
  --namespaces ${NAMESPACE} \
  --only-spinnaker-managed true

hal config deploy edit \
  --type distributed \
  --account-name ${ACCOUNT_NAME} \
  --location ${NAMESPACE}

export ACCESS_KEY_ID=AKIAYJIFACYPHJS7YNVO
export BUCKET_NAME=armory-webinar-20190328
export REGION=us-east-1
hal config storage s3 edit \
    --bucket ${BUCKET_NAME} \
    --access-key-id ${ACCESS_KEY_ID} \
    --secret-access-key \
    --region ${REGION}

hal config storage edit --type s3

hal version list

hal config version edit --version 1.12.7

hal deploy apply
```

Show the UI via Port Forward (must be done from local laptop):
# Port forward
```bash
export KUBECONFIG=kubeconfig-webinar
kubectl get pods -n spinnaker
kubectl -n spinnaker port-forward svc/spin-gate 8084:8084 &
kubectl -n spinnaker port-forward svc/spin-deck 9000:9000 &
```



Create the ingress:
```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: spinnaker-ingress
  namespace: spinnaker
  annotations:
    kubernetes.io/ingress.class: "nginx"
spec:
  rules:
  - host: spinnaker.webinar.armory.io
    http:
      paths:
      - backend:
          serviceName: spin-deck
          servicePort: 9000
        path: /
  - host: gate.webinar.armory.io 
    http:
      paths:
      - backend:
          serviceName: spin-gate
          servicePort: 8084
        path: /
```

### Set up
```bash
hal config security ui edit --override-base-url https://spinnaker.webinar.armory.io
hal config security api edit --override-base-url https://gate.webinar.armory.io
hal deploy apply
```

Validate that the UI is now viewable