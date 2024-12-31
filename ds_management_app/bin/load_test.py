import sys, os
sys.path.append(os.path.dirname(__file__))
import sa_import
import json
from future.moves.urllib.error import HTTPError
import splunk.safe_lxml_etree as etree
from ds_utils import log, get_apps_for_input, get_apps_checkpoint,update_dc_info_csv
from ds_utils import log
import splunk

from splunk.clilib.bundle_paths import make_splunkhome_path
import splunk.appserver.mrsparkle.lib.util as splunk_lib_util

apps_download_list_dir = splunk_lib_util.make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'appserver', 'static','apps_download_list'])
new_csv_file = splunk_lib_util.make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'var', 'run','serverclass.csv'])

class LoadTestHandler(splunk.rest.BaseRestHandler):

    def handle_POST(self):
        try:
            data=self.request
            dc = data['remoteAddr']
            uf_names = data["form"]
            # uf_name=[["0","win_1"],["1","win_2"]]
            log("INFO", "Getting phonehome from deployment client: "+str(dc))
            uf_names["ip"]=dc
            update_dc_info_csv(f"{uf_names['guid']},{uf_names['ip']},{uf_names['private_ip']},{uf_names['hostname']},{uf_names['servername']},{uf_names['os']}")
            log("INFO",f"Stored client info: {dc}")
            
            required_unique_keys=[uf_names["guid"],uf_names["ip"],uf_names["hostname"],uf_names["servername"]]
            required_apps = get_apps_for_input(required_unique_keys, new_csv_file)
            
            ### New Modification Start ###    
            # payload=get_apps_checkpoint(list(required_apps))
            # log("INFO","List of apps is ready. Sending to DC...")
            
            apps_with_checkpoint=get_apps_checkpoint(list(required_apps))
            log("INFO","List of apps is ready. Sending to DC...")
            ### New Modification End ###
            
            ### New Changes Start ###
            os.makedirs(apps_download_list_dir, exist_ok=True)
            make_name= f"{uf_names['guid']}_{uf_names['private_ip']}_{uf_names['hostname']}_{uf_names['os']}.txt"
            client_file_name = make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'appserver', 'static','apps_download_list',make_name])

            with open(client_file_name, "w") as log_file:
                for key, value in apps_with_checkpoint.items():
                    log_file.write(f"{key},{value}\n")
            ### New Changes Complete ###
            payload={}
            payload["info"] = "Success"
            payload["status"] = 200
            self.response.write(json.dumps(payload))
        except Exception as e:
            log("ERROR", f"Failed to process phonehome request: {str(e)}")
            payload["error"] = str(e)
            payload["status"] = 500
            self.response.write(json.dumps(payload))
