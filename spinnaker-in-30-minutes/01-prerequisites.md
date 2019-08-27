# Webinar Setup / Prerequisites

## How to stand up an EKS clusters
Stand up an EKS cluster, using [the Cloudformation template](misc/eks.yml).  You'll probably have to download and re-upload it to Cloudformation. 

If you have Single Sign-On for Amazon, and use a different user for the `aws` CLI - You'll want to run the CF template from the `aws` CLI: 
```bash
# Download the CF Template
curl -L -O https://raw.githubusercontent.com/armory/webinar/master/spinnaker-in-30-minutes/misc/eks.yml
STACK=spinnaker-stack
FILEPATH=$PWD/eks.yml
# for us-west-2
NODEAMIID=ami-0c28139856aaf9c3b 
# for us-east-1 , default
# NODEAMIID=ami-0eeeef929db40543c
# Get the list of the valid keypairs and replace with your keypairname.
aws ec2 describe-key-pairs --region us-west-2 
KEYPAIRNAME=mykeypairname
aws cloudformation create-stack --stack-name ${STACK} \
  --template-body file://${FILEPATH} \
  --parameters ParameterKey=KeyName,ParameterValue=${KEYPAIRNAME} \
    ParameterKey=NodeImageId,ParameterValue=${NODEAMIID} \
  --capabilities CAPABILITY_IAM
```
See note below regarding EKS permissions.

Note the following:
* This is basically a combination of the two CF templates on this page: https://docs.aws.amazon.com/eks/latest/userguide/getting-started.html, with some of the role setup automated.  It does not automatically add the permissions so that the EKS nodes can join the cluster (see below)
* The default parameter for the EKS node AMI is for us-east-1; you may need to change this for other regions.  Get the AMI for your region from the above link.
* This has the same caveat that regular EKS does - the user or role that creates the EKS cluster (in this case, the user or role who creates the CloudFormation stack) is the only user initially allowed into the cluster.  
* If you create services or ingresses in an EKS cluster, it will create additional AWS resources in the VPC (such as ELBs).  You will not be able to delete the cloudformation stack until you remove these resources.  Two ways to do this:
    * Delete the Kubernetes resources (such as Kubernetes Service or Ingress objects) prior to tearing down the CF Stack
    * Delete the ELB and other created resources manually.  This may take a bit of effort.

## Create a certificate in AWS
If you want to have a TLS endpoint (aka. https://spinnaker.webinar.armory.io), an easy to do this would be to use the AWS Certificate Manager to create a new certificate. The mechanism used to do this will be up to you - we're using automatic validation through the AWS Certificate Manager to create a certificate for the host `*.webinar.armory.io`

## Adding the EKS nodes to the cluster
You *must* wait till the cloudformation stack is fully up (or at least, until the EKS cluster is fully up and the role is created).
```bash
mkdir ~/tmp/webinar/$(date +%s)
cd !$
mkdir _old

# Get the list of Cloudformation stacks
aws cloudformation list-stacks --query 'StackSummaries[?StackStatus==`CREATE_COMPLETE` && TemplateDescription==`Amazon EKS Sample VPC`]'

# Get the list of stacks
STACK=spinnaker-stack  

EKSCLUSTER=$(aws cloudformation describe-stack-resources \
    --stack-name ${STACK} \
    --query 'StackResources[?LogicalResourceId==`EKSCluster`].PhysicalResourceId' \
    --output text)

ROLE=$(aws cloudformation describe-stack-resources \
    --stack-name ${STACK} \
    --query 'StackResources[?LogicalResourceId==`NodeInstanceRole`].PhysicalResourceId' \
    --output text)

ROLEARN=$(aws iam get-role \
    --role-name ${ROLE} \
    --query 'Role.Arn' \
    --output text)

aws eks update-kubeconfig --name ${EKSCLUSTER} --kubeconfig kubeconfig-webinar
export KUBECONFIG=kubeconfig-webinar
CONTEXT=$(kubectl --kubeconfig kubeconfig-webinar config current-context)
sed -i.bak "s|${CONTEXT}|${STACK}|g" kubeconfig-webinar
rm kubeconfig-webinar.bak

tee aws-auth-cm-${EKSCLUSTER}.yaml <<-'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapRoles: |
    - rolearn: ROLEARN
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers
        - system:nodes
EOF

sed -i.bak "s|ROLEARN|${ROLEARN}|g" aws-auth-cm-${EKSCLUSTER}.yaml

kubectl --kubeconfig kubeconfig-webinar apply -f aws-auth-cm-${EKSCLUSTER}.yaml
mv aws-auth* _old/

export KUBECONFIG=kubeconfig-webinar
```

# Set up NGINX Ingress Controller
If you want to have a TLS (https://) public endpoint, create a Layer 7 Ingress Controller.

https://kubernetes.github.io/ingress-nginx/deploy/#aws

```bash
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/mandatory.yaml
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/provider/aws/service-l7.yaml
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/provider/aws/patch-configmap-l7.yaml
```
Get the list of certificates & update service-l7.yaml with ACM certificate
```bash
# Update service-l7.yaml with ACM certificate from this command
aws acm list-certificates
vi service-l7.yaml
```

```bash
### Apply the service yamls:
export KUBECONFIG=kubeconfig-webinar
kubectl config use-context webinar-eks-spinnaker
kubectl apply -f mandatory.yaml -f service-l7.yaml -f patch-configmap-l7.yaml
```

# Set up DNS
Once the ingress service is up and has an ELB (`kubectl get svc -n ingress-nginx ingress-nginx -owide`), create a DNS CNAME entry to point that at the ELB URL.