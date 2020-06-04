
## Curl, Auth Test

```bash
curl -v http://18.237.33.147:8000/rest/api/2/project \
  -H "authorization: Basic anVzdGlucmxlZTpwYXNzd29yZDEyMw==" \
  -H "content-type: application/json"

curl -v http://18.237.33.147:8000/rest/api/2/project \
  -u justinrlee:password123 \
  -H "content-type: application/json"

curl -v -X POST http://18.237.33.147:8000/rest/api/2/issue \
  -H "authorization: Basic anVzdGlucmxlZTpwYXNzd29yZDEyMw==" \
  -H "content-type: application/json" \
  -d '{
	"fields": {
		"project": {
			"key": "ENG"
		},
		"summary": "summary",
		"description": "my description",
		"issuetype": {
			"name": "Task"
		},
		"priority": {
			"name": "Medium"
		}
	}
}'
```

## Custom Webhook (Preconfigured Webhook Stage)

```yml
webhook:
  preconfigured:
  - label: "Create JIRA Task"
    enabled: true
    description: "This will create a JIRA Task in the ENG project"
    type: createJIRAEngTask
    method: POST
    url: http://18.237.33.147:8000/rest/api/2/issue
    customHeaders:
      authorization: Basic anVzdGlucmxlZTpwYXNzd29yZDEyMw==
      content-type: application/json
    payload: |-
      {
        "fields": {
          "project": {
            "key": "ENG"
          },
          "summary": "${parameterValues['summary']}",
          "description": "${parameterValues['description']}",
          "issuetype": {
            "name": "Task"
          },
          "priority": {
            "name": "Medium"
          }
        }
      }
    parameters:
    - name: description
      label: "Task Description"
      type: string
      description: "Description Helper Text"
    - name: summary
      label: "Task Summary"
      type: string
      description: "Summary Helper Text"
```