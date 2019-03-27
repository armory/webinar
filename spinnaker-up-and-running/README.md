## Webinar Prep:
Stand up two EKS clusters, using [the Cloudformation template](misc/eks.yml).  You'll probably have to download and re-upload it to Cloudformation.  Note the following:
* This is basically a combination of the two CF templates on this page: https://docs.aws.amazon.com/eks/latest/userguide/getting-started.html, with some of the role setup automated.  It does not automatically add the permissions so that the EKS nodes can join the cluster (see below)
* This has the same caveat that regular EKS does - the user or role that creates the EKS cluster (in this case, the user or role who creates the CloudFormation stack) is the only user initially allowed into the cluster.
* If you create services or ingresses in an EKS cluster, it will create additional AWS resources in the VPC (such as ELBs).  You will not be able to delete the cloudformation stack until you remove these resources.  Two ways to do this:
    * Delete the Kubernetes resources (such as Kubernetes Service or Ingress objects) prior to tearing down the CF Stack
    * Delete the ELB and other created resources manually.  This may take a bit of effort.

## Adding the EKS nodes to the cluster
You *must* wait till the cloudformation stack is fully up (or at least, until the EKS cluster is fully up and the role is created).
```bash
cd /tmp
# Get the list of Cloudformation stacks
aws cloudformation list-stacks

# Get the list of stacks
STACK=webinar-source

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

aws eks update-kubeconfig --name ${EKSCLUSTER} --kubeconfig kubeconfig-${EKSCLUSTER}

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

kubectl --kubeconfig kubeconfig-${EKSCLUSTER} apply -f aws-auth-cm-${EKSCLUSTER}.yaml
```

## In the Webinar
Create a new working directory, set up permissions
```bash
mkdir ~/spinnaker/webinar

# cp <STUFF> to ~/spinnaker/webinar

cd !$
```

Set up permissions
```bash

```