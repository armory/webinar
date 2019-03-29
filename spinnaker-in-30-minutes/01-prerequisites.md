# Webinar Setup / Prerequisites

## Stand up two EKS clusters
Stand up two EKS clusters, using [the Cloudformation template](misc/eks.yml).  You'll probably have to download and re-upload it to Cloudformation.  Use two nodes for `webinar-eks-spinnaker` and one or two nodes for `webinar-eks-target`.  Note the following:
* This is basically a combination of the two CF templates on this page: https://docs.aws.amazon.com/eks/latest/userguide/getting-started.html, with some of the role setup automated.  It does not automatically add the permissions so that the EKS nodes can join the cluster (see below)
* The default parameter for the EKS node AMI is for us-east-1; you may need to change this for other regions.  Get the AMI for your region from the above link.
* This has the same caveat that regular EKS does - the user or role that creates the EKS cluster (in this case, the user or role who creates the CloudFormation stack) is the only user initially allowed into the cluster.
* If you create services or ingresses in an EKS cluster, it will create additional AWS resources in the VPC (such as ELBs).  You will not be able to delete the cloudformation stack until you remove these resources.  Two ways to do this:
    * Delete the Kubernetes resources (such as Kubernetes Service or Ingress objects) prior to tearing down the CF Stack
    * Delete the ELB and other created resources manually.  This may take a bit of effort.

## Create a certificate in AWS
The mechanism used to do this will be up to you - we're using automatic validation through the AWS Certificate Manager to create a certificate for the host `*.webinar.armory.io`

## Adding the EKS nodes to the cluster
You *must* wait till the cloudformation stack is fully up (or at least, until the EKS cluster is fully up and the role is created).
```bash
mkdir ~/tmp/webinar/$(date +%s)
cd !$
mkdir _old

# Get the list of Cloudformation stacks
aws cloudformation list-stacks --query 'StackSummaries[?StackStatus==`CREATE_COMPLETE` && TemplateDescription==`Amazon EKS Sample VPC`]'

# Get the list of stacks
STACK=webinar-eks-target
STACK=webinar-eks-spinnaker
STACK_NAME=webinar-eks-target
STACK_NAME=webinar-eks-spinnaker

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
sed -i.bak "s|${CONTEXT}|${STACK_NAME}|g" kubeconfig-webinar
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

# Create Certificate in AWS
*.webinar.armory.io

# Set up NGINX Ingress Controller
https://kubernetes.github.io/ingress-nginx/deploy/#aws

```bash
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/mandatory.yaml
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/provider/aws/service-l7.yaml
wget https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/provider/aws/patch-configmap-l7.yaml

### Update service-l7.yaml with ACM certificate from this command:
aws acm list-certificates

### Then do this:
export KUBECONFIG=kubeconfig-webinar
kubectl config use-context webinar-eks-spinnaker
kubectl apply -f mandatory.yaml -f service-l7.yaml -f patch-configmap-l7.yaml
```

# Set up DNS
Once the ingress service is up and has an ELB (`kubectl get svc -n ingress-nginx ingress-nginx -owide`), create a DNS CNAME entry to point that at the ELB URL.