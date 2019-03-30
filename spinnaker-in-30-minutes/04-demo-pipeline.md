# Webinar - Demo Pipeline

Here's what we started with:

* Two EKS Clusters (with two EKS nodes) - one to install Spinnaker in, one to deploy to
* Kubeconfig with full access to each cluster
* Nginx ingress controller installed in the Spinnaker EKS cluster, set up with the following:
  * Certificate for *.webinar.spinnaker.io
  * DNS pointing at *.webinar.spinnaker.io

Here's what we've done so far:
* Installed Spinnaker in our Kubernetes cluster, and exposed it at  https://spinnaker.webinar.armory.io, with an API endpoint at https://gate.webinar.armory.io
* Added a second Kubernetes cluster as a deployment target to Spinnaker

Next, we'll create a pipeline that deploys to the new deployment target.

# Create new pipeline
Create a new app called `Demo`
Create a new pipeline called 'Hello Day'
Add these parameters (required, default 2)
* devcount
* prodcount
* tag

Deploy Manifest (for Kubernetes-Dev)
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: helloworld
  name: helloworld
  namespace: dev
spec:
  replicas: '${ #toInt( parameters.devcount ) }'
  selector:
    matchLabels:
      app: helloworld
  template:
    metadata:
      labels:
        app: helloworld
    spec:
      containers:
        - image: 'justinrlee/nginx:${parameters.tag}'
          name: primary
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
---
apiVersion: v1
kind: Service
metadata:
  name: helloworld
  namespace: dev
spec:
  ports:
    - port: 80
      protocol: TCP
      targetPort: 80
  selector:
    app: helloworld
  type: LoadBalancer
```

Add manual judgment: Validate Dev

Add one deploy stage:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: prod-1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: helloworld
  name: helloworld
  namespace: prod-1
spec:
  replicas: '${ #toInt( parameters.prodcount ) }'
  selector:
    matchLabels:
      app: helloworld
  template:
    metadata:
      labels:
        app: helloworld
    spec:
      containers:
        - image: 'justinrlee/nginx:${parameters.tag}'
          name: primary
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
---
apiVersion: v1
kind: Service
metadata:
  name: helloworld
  namespace: prod-1
spec:
  ports:
    - port: 80
      protocol: TCP
      targetPort: 80
  selector:
    app: helloworld
  type: LoadBalancer
```

Add one deploy stage:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: prod-2
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: helloworld
  name: helloworld
  namespace: prod-2
spec:
  replicas: '${ #toInt( parameters.prodcount ) }'
  selector:
    matchLabels:
      app: helloworld
  template:
    metadata:
      labels:
        app: helloworld
    spec:
      containers:
        - image: 'justinrlee/nginx:${parameters.tag}'
          name: primary
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
---
apiVersion: v1
kind: Service
metadata:
  name: helloworld
  namespace: prod-2
spec:
  ports:
    - port: 80
      protocol: TCP
      targetPort: 80
  selector:
    app: helloworld
  type: LoadBalancer
```