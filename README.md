# townsville-rest-service

Generic REST service for customer requests

see /actions for 2 example actions

see /config.json for route and user definition

check /certs dir for required files for https and change servertype in config to https if you put the right files there

## example calls

```wget -qO- --user=test1 --password=test1 --post-data='{"test":"foobar"}' http://localhost:8080/townsville/test/1/```

```wget -qO- --user=test2 --password=test2 --post-data='{"test":"foobar"}' http://localhost:8080/townsville/test/2/```
