
## Run Job Manifest

```yml
apiVersion: batch/v1
kind: Job
metadata:
  name: jira-test
  namespace: spinnaker
spec:
  backoffLimit: 0
  template:
    spec:
      containers:
        - env:
            - name: JIRA_TOKEN
              value: anVzdGlucmxlZTpwYXNzd29yZDEyMw==
            - name: JIRA_URL
              value: 'http://18.237.33.147:8000'
            - name: ISSUE_ID
              value: ENG-1
            - name: SUCCESS_STATUS
              value: Done
            - name: FAILURE_STATUS
              value: Rejected
          image: 'justinrlee/spinnaker-jira:1571754882'
          name: jira
      restartPolicy: Never
  ttlSecondsAfterFinished: 600
```