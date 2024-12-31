#!/bin/bash

# Set the Splunk Home path
SPLUNK_HOME=$(cd ../../../.. && pwd)
echo "Splunk home path - $SPLUNK_HOME"

# Fetch general details of the Universal Forwarder
guid=$(grep 'guid' "$SPLUNK_HOME/etc/instance.cfg" | awk -F ' = ' '{print $2}')
ip=$(hostname -I | awk '{print $1}')
host=$(hostname)
server=$("$SPLUNK_HOME/bin/splunk" btool server list general | grep serverName | awk -F ' = ' '{print $2}')

echo "UF Info : UUID   - $guid"
echo "UF Info : IP     - $ip"
echo "UF Info : host   - $host"
echo "UF Info : Server - $server"

# Define the URL and headers for the Phonehome curl request
phonehome_url="https://3.110.77.157:8089/servicesNS/-/ds_management_app/Phonehome"
header="Content-Type: application/x-www-form-urlencoded"

# Run the Phonehome curl command to get the list of apps and GUIDs
response=$(curl -sk "$phonehome_url" --header "$header" \
    --data-urlencode "0=$guid" --data-urlencode "1=$ip" --data-urlencode "2=$host" --data-urlencode "3=$server")
echo "Phonehome response : $response"

# Parse response to get app names and GUIDs
app_info=$(echo "$response" | jq -r 'to_entries[] | "\(.key)=\(.value)"')
echo "Phonehome app_info : $app_info"

# Function to calculate checksum for a single .tgz file
calculate_checksum() {
    local file_path=$1
    md5sum "$file_path" | awk '{print $1}'
}

# Define paths for downloading and extracting apps
output_path="$SPLUNK_HOME/etc/apps/ravi_app/data/"
final_app_path="$SPLUNK_HOME/etc/apps/"

# Loop through each app in the response
for app_entry in $app_info; do
    app_name=$(echo "$app_entry" | awk -F= '{print $1}')
    api_guid=$(echo "$app_entry" | awk -F= '{print $2}')
    app_tgz_path="$output_path$app_name.tgz"

    # Check if the app's .tgz file exists and calculate its checksum
    if [[ -f "$app_tgz_path" ]]; then
        current_checksum=$(calculate_checksum "$app_tgz_path")
        echo "Checksum $app_tgz_path : $current_checksum"
    else
        current_checksum=""
    fi
    
    echo "Checksums DS: $api_guid and UF: $current_checksum"
    # Compare checksums
    if [[ "$current_checksum" == "$api_guid" ]]; then
        echo "Checksum matches for $app_name. Skipping download."
        continue
    fi

    # Checksum mismatch; download the app
    echo "Checksum mismatch for $app_name. Downloading the app..."
    
    # Clean up by removing the downloaded .tgz file
    if [[ -f "$app_tgz_path" ]]; then
        rm "$app_tgz_path"
    fi
    # Fetch the app's file content using curl
    download_url="https://3.110.77.157:8089/servicesNS/-/ds_management_app/getApps?app_name=$app_name"
    app_response=$(curl -sk "$download_url")

    # Extract file_content and filename from the JSON response
    file_content=$(echo "$app_response" | jq -r '.file_content')
    filename=$(echo "$app_response" | jq -r '.filename')

    # Decode the base64 file content and save it to the specified output path
    echo "$file_content" | base64 -d > "$app_tgz_path"

    # Remove the existing app directory if it exists
    if [[ -d "$final_app_path$app_name" ]]; then
        rm -rf "$final_app_path$app_name"
    fi

    # Untar the downloaded .tgz file to the apps directory
    tar -xzf "$app_tgz_path" -C "$final_app_path"

    echo "$app_name has been updated successfully."
done