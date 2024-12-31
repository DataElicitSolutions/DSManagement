import os, shutil,re, csv, hashlib, tarfile
from splunk.clilib.bundle_paths import make_splunkhome_path
import splunk.appserver.mrsparkle.lib.util as splunk_lib_util
from ds_utils import log, create_machine_types_filter_file
from extract_csv_parms import extrace_csv

# Define source and destination directories for copy_apps
src_dir = splunk_lib_util.make_splunkhome_path(["etc", "deployment-apps"])
dst_dir = splunk_lib_util.make_splunkhome_path(["etc", "apps", "ds_management_app", "data", "ds_app"])
checkpoint_dir = splunk_lib_util.make_splunkhome_path(["etc", "apps", "ds_management_app", "data", "checkpoint"])

# Define paths for converting .conf to .csv
conf_file = splunk_lib_util.make_splunkhome_path(["etc", "system", "local", "serverclass.conf"])
csv_file = splunk_lib_util.make_splunkhome_path(["etc", "apps", "ds_management_app", "lookups","serverclass.csv"])

# Define source and destination directories for set_app_checkpoint
ds_app_dir = splunk_lib_util.make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'data', 'ds_app'])
output_dir = splunk_lib_util.make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'appserver', 'static','apps'])
checkpoint_csv = splunk_lib_util.make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'lookups', 'app_checkpoint.csv'])

# Define source and destination directories for push_script
ds_setup_app_dir = splunk_lib_util.make_splunkhome_path(['etc', 'apps', 'ds_management_app', 'data', 'setup_app'])
deployment_app_dir = splunk_lib_util.make_splunkhome_path(['etc', 'deployment-apps'])

# Function to copy deployment-apps to ds_app
def copy_apps():
    checkpoint_copy_ds_app = splunk_lib_util.make_splunkhome_path(["etc", "apps", "ds_management_app", "data", "checkpoint", "checkpoint_copy_ds_app.txt"])
    if os.path.isfile(checkpoint_copy_ds_app):
        log("INFO","Deployment apps is already copied")
        return
    # Ensure destination directory exists
    os.makedirs(dst_dir, exist_ok=True)
    os.makedirs(checkpoint_dir, exist_ok=True)

    # Copy all contents from src_dir to dst_dir
    try:
        for item in os.listdir(src_dir):
            s = os.path.join(src_dir, item)
            d = os.path.join(dst_dir, item)
            if os.path.isdir(s):
                # If it's a directory, copy the directory only if it doesn't already exist in the destination
                if not os.path.exists(d):
                    shutil.copytree(s, d)
                else:
                    # If the directory already exists, copy files individually
                    for sub_item in os.listdir(s):
                        sub_s = os.path.join(s, sub_item)
                        sub_d = os.path.join(d, sub_item)
                        if os.path.isdir(sub_s):
                            shutil.copytree(sub_s, sub_d)
                        else:
                            shutil.copy2(sub_s, sub_d)
            else:
                # Copy files
                shutil.copy2(s, d)
        log("INFO","Deployment apps copied successfully.")
        with open(checkpoint_copy_ds_app, 'w') as fp:
            log("INFO","Checkpoint added for Deployment apps")
            pass
    except Exception as e:
        log("ERROR",f"Error copying Deployment apps: {e}")


# Function to convert .conf file to .csv
def convert_conf_to_csv():
    checkpoint_serverclass_conversion = splunk_lib_util.make_splunkhome_path(["etc", "apps", "ds_management_app", "data", "checkpoint", "checkpoint_serverclass_conversion.txt"])
    if os.path.isfile(checkpoint_serverclass_conversion):
        log("INFO","Serverclass is already copied")
        return
    
    os.makedirs(os.path.dirname(csv_file), exist_ok=True) 
    # Code to convert .conf file to .csv
    # Initialize data list to hold parsed content
    data = []

    # Regex to match the section headers and key-value pairs
    section_pattern = re.compile(r"\[(.*?)\]")
    kv_pattern = re.compile(r"([^=]+)\s*=\s*(.+)")
    host_pattern = r"^(blacklist|whitelist)(\.from_pathname|\.select_field|\.where_field|\.where_equals)?"

    # Attempt to read and parse the .conf file
    try:
        with open(conf_file, 'r') as file:
            serverclass = None
            app = '-'
            for line in file:
                line = line.strip()
                
                # If line is a section header
                section_match = section_pattern.match(line)
                if section_match:
                    section = section_match.group(1)
                    # Parse serverclass and app from section
                    parts = section.split(':')
                    if len(parts)==4:
                        serverclass=parts[1]
                        app=parts[3]
                    elif len(parts)==2:
                        serverclass=parts[1]
                        app="-"
                    else:
                        serverclass="-"
                        app="-"                    
                    continue
                # If line is a key-value pair
                kv_match = kv_pattern.match(line)
                if kv_match:
                    key, value = kv_match.groups()
                    host_match = re.match(host_pattern, key)
                    if host_match:
                        if host_match.group(2):  
                            key=f"{host_match.group(1)}_{host_match.group(2)[1:]}"
                        else:  # Otherwise, it's just blacklist or whitelist
                            key=host_match.group(1)
                    data.append([serverclass, app, key, value])

        # Write the parsed data to CSV
        with open(csv_file, 'w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['Serverclass', 'App', 'Key', 'Value'])  # CSV header
            writer.writerows(data)
            
        # After create csv from conf file need below steps.
        extrace_csv()
        create_machine_types_filter_file()
        
        log("INFO", "Conversion of serverclass.conf to serverclass.csv completed successfully.")
        with open(checkpoint_serverclass_conversion, 'w') as fp:
            log("INFO","Checkpoint added for Serverclass")
            pass
    except Exception as e:
        log("ERROR", f"Error converting .conf file to CSV: {e}")
        

# Function to calculate checksum of all files in a directory
def calculate_directory_checksum(directory):
    hash_md5 = hashlib.md5()
    for root, dirs, files in os.walk(directory):
        for filename in sorted(files):  # Sort files for consistency
            filepath = os.path.join(root, filename)
            with open(filepath, "rb") as f:
                # Update checksum for each file's contents
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
    return hash_md5.hexdigest()

# Function to calculate checksum of given file
def calculate_file_checksum(file_path):
    """Calculate MD5 checksum of a single file."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()
      
# Function to compress all directory in ds_apps and move tgz to ~/var/run. 
# Also Update checkpoint.csv
def compress_app_update_checkpoint():
    # Initialize list to store checkpoint data for CSV
    os.makedirs(output_dir, exist_ok=True)  # Ensure output directory exists
    os.makedirs(os.path.dirname(checkpoint_csv), exist_ok=True) 
    
    checkpoint_data = []
    
    # Process each directory in ds_app
    for app_dir in os.listdir(ds_app_dir):
        full_app_dir = os.path.join(ds_app_dir, app_dir)
        if os.path.isdir(full_app_dir):  # Ensure it's a directory
            
            # Compress the directory into a .tgz file
            tarball_path = os.path.join(output_dir, f"{app_dir}.tgz")
            with tarfile.open(tarball_path, "w:gz") as tar:
                tar.add(full_app_dir, arcname=app_dir)
            log("INFO",f"Processed and compressed {app_dir} successfully.")
            
            # Calculate checksum
            checksum = calculate_file_checksum(tarball_path)
            
            # Store checksum data for CSV file
            checkpoint_data.append([app_dir, checksum])

    # Write all checksums to the CSV file
    with open(checkpoint_csv, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['app_name', 'checkpoint'])  # Write header
        writer.writerows(checkpoint_data)  # Write checkpoint data
        
def set_app_checkpoint():
    checkpoint_each_app = splunk_lib_util.make_splunkhome_path(["etc", "apps", "ds_management_app", "data", "checkpoint", "checkpoint_each_app.txt"])
    if os.path.isfile(checkpoint_each_app):
        log("INFO","Checkpoint for each app is already created")
        return

    compress_app_update_checkpoint()
    
    with open(checkpoint_each_app, 'w') as fp:
        log("INFO","Checkpoint for each app added successfully.")
        pass
    log("INFO","Checksum and compression process completed successfully.")
        
# Function to create serverclass and push setup apps in the serversclass
def push_script():
    checkpoint_copy_setup_app = splunk_lib_util.make_splunkhome_path(["etc", "apps", "ds_management_app", "data", "checkpoint", "checkpoint_copy_setup_app.txt"])
    if os.path.isfile(checkpoint_copy_setup_app):
        log("INFO","Setup app for DS is already copied")
        return    

    # Ensure the deployment directory exists
    os.makedirs(ds_setup_app_dir, exist_ok=True)
    os.makedirs(deployment_app_dir, exist_ok=True)

    try:        
        for file_name in os.listdir(ds_setup_app_dir):
            if file_name.endswith(".tgz"):
                file_path = os.path.join(ds_setup_app_dir, file_name)
                app_name = file_name.rsplit('.', 1)[0]  # Extract app name by removing the .tgz extension
                app_deployment_path = os.path.join(deployment_app_dir, app_name)
                
                # Remove existing app directory if it exists
                if os.path.exists(app_deployment_path):
                    shutil.rmtree(app_deployment_path)
                    log("INFO",f"Removed existing app directory: {app_deployment_path}")
                
                # Extract the .tgz file to the deployment directory
                with tarfile.open(file_path, "r:gz") as tar:
                    tar.extractall(path=deployment_app_dir)
                    log("INFO",f"Extracted {file_name} to {deployment_app_dir}")
                           
        with open(checkpoint_copy_setup_app, 'w') as fp:
            log("INFO","Successfully added setup app for DS")
            pass                    
        
    except Exception as e:
        log("ERROR", f"Error while adding setup apps :{e}")

  
# Execute functions
if __name__ == "__main__":
    copy_apps()
    convert_conf_to_csv()
    set_app_checkpoint()
    push_script()