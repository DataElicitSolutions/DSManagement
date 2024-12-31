import sys, os
sys.path.append(os.path.dirname(__file__))
import sa_import
import json, threading, base64
from splunk.clilib.bundle_paths import make_splunkhome_path
import splunk.appserver.mrsparkle.lib.util as splunk_lib_util
from ds_utils import log, get_apps_for_input
from splunk.persistconn.application import PersistentServerConnectionApplication
from concurrent.futures import ThreadPoolExecutor

# Set up a ThreadPoolExecutor for concurrent request handling
executor = ThreadPoolExecutor(max_workers=15)  # Adjust max_workers based on your expected load

class UploadAppHandler(PersistentServerConnectionApplication):
    def __init__(self, _command_line, _command_arg):
        super(UploadAppHandler, self).__init__()

    def handle(self, in_string):
        # Submit each request to the ThreadPoolExecutor for concurrent processing
        future = executor.submit(self.process_request, in_string)
        return future.result()

    def process_request(self, in_string):
        try:
            
            # Parse the incoming request to retrieve the app name
            request_info = json.loads(in_string)
            # log("request_info",request_info)
            dc = request_info.get("connection", {}).get("src_ip",{})
            app_names = request_info.get("query", {})
            app_name = next((i[1] for i in app_names if i[0] == "app_name"), None)
            log("INFO","Getting upload app("+str(app_name)+") request from deployment client: "+str(dc))

            # Check if the app_name parameter is provided
            if not app_name:
                log("ERROR","Error: app_name parameter is missing.")
                return {
                    'status': 400,
                    'payload': json.dumps({'error': 'app_name parameter is missing.'})
                }

            # Construct the file path to the .tgz file
            tgz_file_path = splunk_lib_util.make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'var', 'run',f"{app_name}.tgz"])


            # Check if the file exists
            if not os.path.isfile(tgz_file_path):
                log("ERROR",f"Error: {app_name}.tgz not found.")
                return {
                    'status': 404,
                    'payload': json.dumps({'error': f"{app_name}.tgz not found."})
                }

            # Read the .tgz file content and prepare it for response
            with open(tgz_file_path, 'rb') as file:
                file_content = file.read()
                base64_content = base64.b64encode(file_content).decode('utf-8')  # Encode as base64 and convert to string

            # Respond with the file content
            log("INFO","App is ready to send")
            return {
                'status': 200,
                'headers': {'Content-Type': 'application/octet-stream'},
                'payload': json.dumps({'file_content': base64_content, 'filename': f"{app_name}.tgz"})
            }

        except Exception as e:
            # Log and return an error response in case of exceptions
            log("ERROR",f"Error handling request: {str(e)}")
            return {
                'status': 500,
                'payload': json.dumps({'error': f"Error handling request: {str(e)}"})
            }
