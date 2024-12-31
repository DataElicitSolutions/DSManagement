#!/bin/bash
read -r SESSION_KEY

# Set the Splunk Home path
if [[ -z "$SPLUNK_HOME" ]]; then
    # Determine SPLUNK_HOME based on the script’s location
    SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SPLUNK_HOME="$(cd "$SCRIPT_PATH/../../../.." && pwd)"
fi
echo "Splunk home path - $SPLUNK_HOME" 

SCRIPT_LOG_FILE=$SPLUNK_HOME/var/log/splunk/linux_dc_script.log

# Check if the variable has a value
if [ -z "$SESSION_KEY" ]; then
    echo "Error: SESSION_KEY is empty. Exiting..." >> $SCRIPT_LOG_FILE
    exit 1
fi

# Constant variables
dsIP="test.dataelicitsol.com"
script_start_time=$(date "+%Y-%m-%d %H:%M:%S")
#appName="linux_dc_app" # Any appName which is managed by DS

# Configuration
LOCK_FILE="$SPLUNK_HOME/var/run/data/dc_script_running.lock"  # Path to lock file
LAST_RUN_FILE="$SPLUNK_HOME/var/run/data/dc_last_successful_pull.time"  # Path to last run time file
PULL_DELAY=600  # 10 minutes in seconds

# Function to check if the script is already running
is_script_running() {
    if [ -f "$LOCK_FILE" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            lock_time=$(stat -f "%m" "$LOCK_FILE")  # macOS syntax
        else
            lock_time=$(stat --format=%Y "$LOCK_FILE")  # Linux syntax
        fi
        current_time=$(date +%s)
        if (( current_time - lock_time < 300 )); then
            echo "Script is already running. Exiting..." >> $SCRIPT_LOG_FILE
            exit 0
        else
            # Remove stale lock file
            rm -f "$LOCK_FILE"
        fi
    fi
}

# Function to check if the last pull was within the delay period
is_within_pull_delay() {
    if [ -f "$LAST_RUN_FILE" ]; then
        last_pull_time=$(cat "$LAST_RUN_FILE")
        current_time=$(date +%s)
        if (( current_time - last_pull_time < PULL_DELAY )); then
            echo "Last pull was within the delay period. Exiting..." >> $SCRIPT_LOG_FILE
            exit 0
        fi
    fi
}

# Function to mark the script as running
mark_script_running() {
    touch "$LOCK_FILE"
}

# Function to mark the script as finished
mark_script_finished() {
    rm -f "$LOCK_FILE"
}

# Function to update the last successful pull time
update_last_successful_pull() {
    date +%s > "$LAST_RUN_FILE"
}

# Main script logic
is_script_running
is_within_pull_delay
mark_script_running

echo "Pulling application..."  >> $SCRIPT_LOG_FILE

# actual pulling logic start

# Check if jq is installed; if not, install it
if ! command -v jq &> /dev/null; then
    echo "jq is not installed. Installing jq..." >> $SCRIPT_LOG_FILE
    if [[ -f /etc/debian_version ]]; then
        sudo apt update
        sudo apt install -y jq
    elif [[ -f /etc/redhat-release ]]; then
        sudo yum install -y jq
    elif [[ -f /etc/system-release && $(grep -i "Amazon" /etc/system-release) ]]; then
        sudo amazon-linux-extras install epel -y
        sudo yum install -y jq
    else
        echo "Unsupported Linux distribution. Please install jq manually." >> $SCRIPT_LOG_FILE
        exit 1
    fi
else
    echo "jq is already installed. Proceeding..." >> $SCRIPT_LOG_FILE
fi




# Define the path to the configuration file
# config_file="$SPLUNK_HOME/etc/apps/ds_management_app/data/setup_app/config.txt"

# # Check if the configuration file exists
# if [[ -f "$config_file" ]]; then
#     # Source the file to load variables
#     source "$config_file"
#     echo "dsIP is set to: $dsIP"
#     echo "appName is set to: $appName"
# else
#     echo "Config file $config_file not found."
#     exit 1
# fi


# Fetch general details of the Universal Forwarder
guid=$(grep 'guid' "$SPLUNK_HOME/etc/instance.cfg" | awk -F ' = ' '{print $2}')
ip=$(hostname -I | awk '{print $1}')
host=$(hostname)
server=$("$SPLUNK_HOME/bin/splunk" btool server list general | grep serverName | awk -F ' = ' '{print $2}')

echo "UF Info : UUID   - $guid" >> $SCRIPT_LOG_FILE
echo "UF Info : IP     - $ip" >> $SCRIPT_LOG_FILE
echo "UF Info : host   - $host" >> $SCRIPT_LOG_FILE
echo "UF Info : Server - $server" >> $SCRIPT_LOG_FILE

# Define the URL and headers for the Phonehome curl request
phonehome_url="https://$dsIP:8089/servicesNS/-/ds_management_app/Phonehome"
header="Content-Type: application/x-www-form-urlencoded"


# Initialize variables
max_retries=5
retry_count=0
phonehome_complete_time=""
success=false
response=""

# Retry logic
while [ $retry_count -lt $max_retries ]; do
    # Sleep for a random duration between 1 and 10 seconds
    sleep_duration=$((RANDOM % 100 + 1))
    echo "Sleeping for $sleep_duration seconds before phonehome call..." >> $SCRIPT_LOG_FILE
    sleep "$sleep_duration"
    echo $phonehome_url
    response=$(curl -sk -w "%{http_code}" "$phonehome_url" --header "$header" \
        --data-urlencode "guid=$guid" --data-urlencode "private_ip=$ip" --data-urlencode "hostname=$host" --data-urlencode "servername=$server" --data-urlencode "os=linux")
    phonehome_complete_time=$(date "+%Y-%m-%d %H:%M:%S")
    echo $response
    # Extract the HTTP status code
    status_code="${response: -3}"

    if [[ "$status_code" == "200" ]]; then
        echo "Phonehome call succeeded with status code $status_code." >> $SCRIPT_LOG_FILE
        success=true
        break
    else
        echo "Phonehome call failed with status code $status_code. Retrying..." >> $SCRIPT_LOG_FILE
        retry_count=$((retry_count + 1))
    fi
done

# Check if the script failed after max retries
if [ "$success" = false ]; then
    echo "Phonehome call failed after $max_retries attempts. Exiting..." >> $SCRIPT_LOG_FILE
    exit 1
fi

echo "Phonehome call completed successfully at $phonehome_complete_time." >> $SCRIPT_LOG_FILE

# Parse response to get app names and GUIDs
app_info=$(echo "$response" | jq -r 'to_entries[] | "\(.key)=\(.value)"')
echo "Phonehome app_info : $app_info" >> $SCRIPT_LOG_FILE

# Function to calculate checksum for a single .tgz file
calculate_checksum() {
    local file_path=$1
    md5sum "$file_path" | awk '{print $1}'
}

# Initialize flag to track if any changes occurred
changes_made=false

# Define paths for downloading and extracting apps
final_app_path="$SPLUNK_HOME/etc/apps/"
output_path="$SPLUNK_HOME/var/run/data/"

# Check if the directory exists
if [[ ! -d "$output_path" ]]; then
    echo "Directory $output_path does not exist. Creating it..." >> $SCRIPT_LOG_FILE
    mkdir -p "$output_path"
else
    echo "Directory $output_path exists." >> $SCRIPT_LOG_FILE
fi

declare -A apps_from_phonehome
# Loop through each app in the response
for app_entry in $app_info; do
    app_name=$(echo "$app_entry" | awk -F= '{print $1}')
    api_guid=$(echo "$app_entry" | awk -F= '{print $2}')
    apps_from_phonehome["$app_name"]="$api_guid"
    app_tgz_path="$output_path$app_name.tgz"

    # Check if the app's .tgz file exists and calculate its checksum
    if [[ -f "$app_tgz_path" ]]; then
        current_checksum=$(calculate_checksum "$app_tgz_path")
        echo "Checksum $app_tgz_path : $current_checksum" >> $SCRIPT_LOG_FILE
    else
        current_checksum=""
    fi
    
    echo "Checksums DS: $api_guid and UF: $current_checksum" >> $SCRIPT_LOG_FILE
    # Compare checksums
    if [[ "$current_checksum" == "$api_guid" ]]; then
        echo "Checksum matches for $app_name. Skipping download." >> $SCRIPT_LOG_FILE
        continue
    fi

    # Checksum mismatch; download the app
    echo "Checksum mismatch for $app_name. Downloading the app..." >> $SCRIPT_LOG_FILE
    changes_made=true
    
    # Clean up by removing the downloaded .tgz file
    if [[ -f "$app_tgz_path" ]]; then
        rm "$app_tgz_path"
    fi
    # Fetch the app's file content using curl
    # download_url="https://$dsIP:8089/servicesNS/-/ds_management_app/getApps?app_name=$app_name"
    download_url="http://$dsIP:8000/en-GB/static/app/ds_management_app/apps/$app_name.tgz"
    # app_response=$(curl -sk "$download_url")
    curl -sk "$download_url" -o "$app_tgz_path"
    if [[ $? -ne 0 || ! -s "$app_tgz_path" ]]; then
        echo "Failed to download $app_name.tgz. Skipping..." >> $SCRIPT_LOG_FILE
        continue
    fi


    # Remove the existing app directory if it exists
    if [[ -d "$final_app_path$app_name" ]]; then
        rm -rf "$final_app_path$app_name"
    fi

    # Untar the downloaded .tgz file to the apps directory
    tar -xzf "$app_tgz_path" -C "$final_app_path"

    echo "$app_name has been updated successfully." >> $SCRIPT_LOG_FILE
done
app_download_complete_time=$(date "+%Y-%m-%d %H:%M:%S")

# Cleanup: Remove .tgz files and directories not in Phonehome response
for tgz_file in "$output_path"*.tgz; do
    tgz_app_name=$(basename "$tgz_file" .tgz)
    if [[ ! ${apps_from_phonehome[$tgz_app_name]+_} ]]; then
        echo "Removing unused .tgz file and directory for app: $tgz_app_name" >> $SCRIPT_LOG_FILE
        rm "$tgz_file"
        if [[ -d "$final_app_path$tgz_app_name" ]]; then
            rm -rf "$final_app_path$tgz_app_name"
        fi
    fi
done

# Restart Splunk if there were any changes
if [[ "$changes_made" == true ]]; then
    
    current_time=$(date "+%Y-%m-%d %H:%M:%S")
    # Define the URL and headers for the dcStatus REST call
    status_url="https://$dsIP:8089/servicesNS/-/ds_management_app/dcStatus"
    header="Content-Type: application/x-www-form-urlencoded"
    declare -A installed_apps
    
    # Check if the directory exists
    if [ -d "$output_path" ]; then
        # Get the list of files, separated by commas
        if [ -z "$(ls -A "$output_path" 2>/dev/null)" ]; then
            echo "No app instlled" >> $SCRIPT_LOG_FILE
            installed_apps=""
        else
            installed_apps=$(ls -1  "$output_path" | grep '\.tgz$' | sed 's/\.tgz$//' | tr '\n' ',' | sed 's/,$//')
        fi

    fi

    # Run the DC Status curl command to share list of apps and Time to DS
    script_end_time=$(date "+%Y-%m-%d %H:%M:%S")
    response=$(curl -sk "$status_url" --header "$header" \
        --data-urlencode "current_time=$current_time" \
        --data-urlencode "guid=$guid" --data-urlencode \
        "script_start_time=$script_start_time" --data-urlencode \
        "phonehome_complete_time=$phonehome_complete_time" \
        --data-urlencode "app_download_complete_time=$app_download_complete_time" \
        --data-urlencode "script_end_time=$script_end_time" \
        --data-urlencode "installed_apps=$installed_apps")

    if [ $? -eq 0 ]; then
        update_last_successful_pull
    fi

    echo "Changes were made to apps. Restarting Splunk..." >> $SCRIPT_LOG_FILE
    PORT=$($SPLUNK_HOME/bin/splunk show splunkd-port -token $SESSION_KEY 2>/dev/null | grep "Splunkd port" | awk '{print $NF}')
    $SPLUNK_HOME/bin/splunk _internal call /services/server/control/restart  -method POST -uri https://127.0.0.1:$PORT -token $SESSION_KEY

else
    echo "No changes made to apps. Skipping Splunk restart." >> $SCRIPT_LOG_FILE
fi

mark_script_finished