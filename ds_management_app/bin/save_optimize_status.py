import sys, os
sys.path.append(os.path.dirname(__file__))
import sa_import
import json, time
from datetime import datetime
from future.moves.urllib.error import HTTPError
import splunk.safe_lxml_etree as etree
from ds_utils import log,upate_dc_app_status_csv
import splunk
from setup import csv_file

class OptimizedLoadTestHandler(splunk.rest.BaseRestHandler):

    def handle_POST(self):
        try:
            payload={}
            
            data=self.request
            dc = data['remoteAddr']
            app_data = data["form"]
            log("INFO", f"Getting call from deployment client: {str(dc)} - to save app information")
                       
            for key in app_data:
                if key in ["current_time","script_start_time", "phonehome_complete_time", "app_download_complete_time", "script_end_time"]:            
                    # dt_object = datetime.strptime(app_data[key], "%Y-%m-%d %H:%M:%S")
                    # app_data[key] = int(time.mktime(dt_object.timetuple()))
                    if app_data[key]:  # Check if the value is not empty or None
                            try:
                                dt_object = datetime.strptime(app_data[key], "%Y-%m-%d %H:%M:%S")
                                app_data[key] = int(time.mktime(dt_object.timetuple()))
                            except ValueError as e:
                                log("ERROR",f"Error parsing datetime for key '{key}': {e}")  
            upate_dc_app_status_csv(f"{app_data['current_time']},{dc},{app_data['guid']},{app_data['script_start_time']},{app_data['phonehome_complete_time']},{app_data['app_download_complete_time']},{app_data['script_end_time']},\"{app_data['installed_apps']}\"")
            

            payload["info"] = "Success"
            payload["status"] = 200
            log("INFO",f"Successfully saved app information for deployment client: {str(dc)}")
            self.response.write(json.dumps(payload))

        except Exception as e:
            log("ERROR", f"Failed to process request - save DC info: {str(e)}")
            # log(traceback.format_exc())
            payload["error"] = str(e)
            payload["status"] = 500
            self.response.write(json.dumps(payload))