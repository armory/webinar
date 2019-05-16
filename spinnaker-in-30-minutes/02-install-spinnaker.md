# Webinar - Install Spinnaker

Here's what we have so far:

* An EKS Clusters (with two nodes) - This is where we we will install Spinnaker
* Kubeconfig with full access to the EKS cluster
* Nginx ingress controller installed in the Spinnaker EKS cluster, set up with the following:
  * Certificate for *.webinar.armory.io
  * DNS pointing *.webinar.armory.io at our ingress controller

# Introduction to kubeconfigs (slide)

In working directory:
```bash
mkdir -p .hal/.secret
```

Create S3 bucket (via UI):
* Bucket Name: armory-webinar-YYYYMMDD
* keep all versions of object in the same bucket
* automatically encrypt

Services > IAM
* Users
* Create user: armory-webinar-YYYYMMDD-user
* programmatic access
* permissions:
  * no permissions

1. grab access key and secret access key (will have to erase this later)
2. go to user
3. add inline permissions, in order to give the user permissions to the s3 bucket we just created.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::armory-webinar-YYYYMMDD"
        },
        {
            "Effect": "Allow",
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::armory-webinar-YYYYMMDD",
                "arn:aws:s3:::armory-webinar-YYYYMMDD/*"
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

aws s3 ls armory-webinar-YYYYMMDD

unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
```

## Create kubeconfig for source (binary)
* Get binary from https://github.com/armory/spinnaker-tools/releases
* OSX: https://github.com/armory/spinnaker-tools/releases/download/0.0.4/spinnaker-tools-darwin
* Linux: https://github.com/armory/spinnaker-tools/releases/download/0.0.4/spinnaker-tools-linux

Download and run like this:
```bash
curl -LO https://github.com/armory/spinnaker-tools/releases/download/0.0.4/spinnaker-tools-darwin
chmod +x spinnaker-tools-darwin
mv spinnaker-tools-darwin spinnaker-tools
./spinnaker-tools create-service-account --kubeconfig kubeconfig-webinar -o kubeconfig-spinnaker-sa
# Choose source kubernetes cluster, new namespace, kubeconfig

cp kubeconfig-spinnaker-sa .hal/.secret/kubeconfig-spinnaker-sa
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

hal config provider kubernetes account add ${ACCOUNT_NAME} \
  --provider-version v2 \
  --kubeconfig-file ${KUBECONFIG_FULL} \
  --only-spinnaker-managed true

hal config deploy edit \
  --type distributed \
  --account-name ${ACCOUNT_NAME} \
  --location ${NAMESPACE}

export ACCESS_KEY_ID=AKIAYJIFACYPHJS7YNVO
export BUCKET_NAME=armory-webinar-YYYYMMDD
export REGION=us-east-1
hal config storage s3 edit \
    --bucket ${BUCKET_NAME} \
    --access-key-id ${ACCESS_KEY_ID} \
    --secret-access-key \
    --region ${REGION}

hal config storage edit --type s3

hal config features edit --artifacts true

hal version list

hal config version edit --version X.Y.Z

hal deploy apply
```

# Port forward
Gives you access to the UI via Port Forward (must be done from local laptop):
```bash
export KUBECONFIG=kubeconfig-webinar
kubectl get pods -n spinnaker
kubectl -n spinnaker port-forward svc/spin-gate 8084:8084 &
kubectl -n spinnaker port-forward svc/spin-deck 9000:9000 &
```


# Next Steps
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