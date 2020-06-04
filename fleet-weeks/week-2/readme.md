
1. Set up Jenkins: https://docs.armory.io/spinnaker-install-admin-guides/jenkins/ or https://www.spinnaker.io/setup/ci/jenkins/
1. Set up Github: https://docs.armory.io/spinnaker-install-admin-guides/github/ or https://www.spinnaker.io/setup/artifacts/github/
1. Jenkins properties file format: https://www.spinnaker.io/reference/artifacts/from-build-triggers/ and https://github.com/spinnaker/echo/blob/master/echo-pipelinetriggers/src/main/resources/docker.jinja:
    
    ```bash
    # This should include the tag
    image=justinrlee/nginx:tuesday
    messageFormat=DOCKER
    ```
1. Github artifact: 
https://api.github.com/repos/armory/webinar/contents/fleet-weeks/week-2/manifest.yml or HTTP artifact: 
https://raw.githubusercontent.com/armory/webinar/master/fleet-weeks/week-2/manifest.yml