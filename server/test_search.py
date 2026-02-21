import urllib.request
import json
import logging

try:
    response = urllib.request.urlopen("http://localhost:8082/api/dictionary/search?q=cat")
    data = json.loads(response.read().decode('utf-8'))
    print(f"Items returned: {len(data)}")
    if len(data) > 0:
        print(json.dumps(data[0], indent=2))
except Exception as e:
    print(f"Error: {e}")
