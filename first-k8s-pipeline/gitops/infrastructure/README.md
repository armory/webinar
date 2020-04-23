# Infrastructure
I am using an EC2 instance with Minnaker installed. 
This example is using [pulumi](https://www.pulumi.com/) to stand up the ec2 instance. 

## Usage

### Install Pulumi

`brew install pulumi`

### Set up AWS Credentials
This was designed to be used by the Armory SE team.  Specify the AWS profile by setting your ACCESS_KEY and SECRET_KEY as environment variables or specify the profile (~/.aws/credentials) you want to use by setting the environment variable AWS_PROFILE. For more details refer to this [pulumi doc](https://www.pulumi.com/docs/intro/cloud-providers/aws/setup/).

e.g. `export AWS_PROFILE=armory`

### Run Pulumi Up

`pulumi up`

### Other

Nice to have Minnaker use an updated ingress (e.g.):

```
---
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  labels:
    app: spin
  name: spin-ingress
  namespace: spinnaker
spec:
  rules:
  -
    host: spinnaker.annapolis.armory.io
    http:
      paths:
      - backend:
          serviceName: spin-deck
          servicePort: 9000
        path: /
      - backend:
          serviceName: spin-gate
          servicePort: 8084
        path: /api/v1
```