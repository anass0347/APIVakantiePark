import json
import sys
from growatt import Growatt
# install this library: pip install git+https://github.com/Sanneeeee/growatt-api.git
api = Growatt()
api.login("Team Kapsalon", "D1gitalTw!n")
plant_list = api.get_plants()[0]["id"]
plant_id = plant_list

devices = []

# Loop van pagina 1 t/m 5 (en verder als je meer wilt ophalen)
for page in range(1, 6):
    response = api.get_devices_by_plant(plant_id, page)

    if 'obj' in response and 'datas' in response['obj']:
        devices.extend(response['obj']['datas'])

status_map = {
    "-1": "Offline",
    "1": "Online",
    '3': "Fault"
}

filtered_devices = [
    {
        "chalet": device.get('alias', 'N/A').removeprefix('Chalet ').strip(),
        "lastUpdateTime": device.get('lastUpdateTime', 'N/A'),
        "eToday": device.get('eToday', 'N/A'),
        "status": status_map.get(str(device.get('status')), 'Unknown')
    }
    for device in devices if device.get('alias', '').startswith('Chalet')
]
# Zet de filtered devices om naar JSON
json_result = json.dumps(filtered_devices, indent=4)
print(json.dumps(filtered_devices))
sys.stdout.flush()