
# Set Splunk Home path
$SPLUNK_HOME = "$env:SPLUNK_HOME"
Write-Output "Splunk home path - $SPLUNK_HOME"

# Constant variables
$dsIP="3.110.77.157:8089"
$appName="linux_dc_app" # Inside this app script is located

# Fetch general details of the Universal Forwarder
$guid = (Select-String -Path "$SPLUNK_HOME\etc\instance.cfg" -Pattern "guid =" | ForEach-Object { $_.Line.Split('=')[1].Trim() })
$ip = (Test-Connection -ComputerName (hostname) -Count 1 | Select-Object -ExpandProperty Address).IPAddressToString
$host = (hostname)
$server = & "$SPLUNK_HOME\bin\splunk.exe" btool server list general | Select-String "serverName" | ForEach-Object { $_.Line.Split('=')[1].Trim() }

Write-Output "UF Info : UUID   - $guid"
Write-Output "UF Info : IP     - $ip"
Write-Output "UF Info : host   - $host"
Write-Output "UF Info : Server - $server"

# Define the URL and headers for the Phonehome request
$phonehome_url = "https://$dsIP/servicesNS/-/ds_management_app/Phonehome"
$header = @{
    "Content-Type" = "application/x-www-form-urlencoded"
}

# Run the Phonehome request to get the list of apps and GUIDs
$response = Invoke-RestMethod -Uri $phonehome_url -Headers $header -Method Post -Body @{
    "0" = $guid
    "1" = $ip
    "2" = $host
    "3" = $server
}
Write-Output "Phonehome response : $response"

# Parse response to get app names and GUIDs
$app_info = $response.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }
Write-Output "Phonehome app_info : $app_info"

# Function to calculate checksum for a single .tgz file
function Calculate-Checksum {
    param ($filePath)
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $stream = [System.IO.File]::OpenRead($filePath)
    $checksum = [BitConverter]::ToString($md5.ComputeHash($stream)).Replace("-", "").ToLower()
    $stream.Close()
    return $checksum
}

# Initialize flag to track if any changes occurred
$changes_made = $false

# Define paths for downloading and extracting apps
$output_path = "$SPLUNK_HOME\etc\apps\$appName\data\"
$final_app_path = "$SPLUNK_HOME\etc\apps\"

# Loop through each app in the response
$apps_from_phonehome = @{}
foreach ($app_entry in $app_info) {
    $app_name, $api_guid = $app_entry -split "="
    $apps_from_phonehome[$app_name] = $api_guid
    $app_tgz_path = "$output_path$app_name.tgz"

    # Check if the app's .tgz file exists and calculate its checksum
    if (Test-Path -Path $app_tgz_path) {
        $current_checksum = Calculate-Checksum -filePath $app_tgz_path
        Write-Output "Checksum $app_tgz_path : $current_checksum"
    } else {
        $current_checksum = ""
    }

    Write-Output "Checksums DS: $api_guid and UF: $current_checksum"
    # Compare checksums
    if ($current_checksum -eq $api_guid) {
        Write-Output "Checksum matches for $app_name. Skipping download."
        continue
    }

    # Checksum mismatch; download the app
    Write-Output "Checksum mismatch for $app_name. Downloading the app..."
    $changes_made = $true

    # Clean up by removing the downloaded .tgz file
    if (Test-Path -Path $app_tgz_path) {
        Remove-Item -Path $app_tgz_path
    }

    # Fetch the app's file content using curl
    $download_url = "https://$dsIP/servicesNS/-/ds_management_app/getApps?app_name=$app_name"
    $app_response = Invoke-RestMethod -Uri $download_url -Method Get
    $file_content = $app_response.file_content
    $filename = $app_response.filename

    # Decode the base64 file content and save it to the specified output path
    [System.IO.File]::WriteAllBytes($app_tgz_path, [Convert]::FromBase64String($file_content))

    # Remove the existing app directory if it exists
    $app_directory = "$final_app_path$app_name"
    if (Test-Path -Path $app_directory) {
        Remove-Item -Path $app_directory -Recurse -Force
    }

    # Extract the downloaded .tgz file to the apps directory (requires 7-Zip installed)
    & "C:\Program Files\7-Zip\7z.exe" x $app_tgz_path -o$final_app_path$app_name -aoa
    Write-Output "$app_name has been updated successfully."
}

# Cleanup: Remove .tgz files and directories not in Phonehome response
foreach ($tgz_file in Get-ChildItem -Path $output_path -Filter "*.tgz") {
    $tgz_app_name = $tgz_file.BaseName
    if (-not $apps_from_phonehome.ContainsKey($tgz_app_name)) {
        Write-Output "Removing unused .tgz file and directory for app: $tgz_app_name"
        Remove-Item -Path $tgz_file.FullName
        $app_directory = "$final_app_path$tgz_app_name"
        if (Test-Path -Path $app_directory) {
            Remove-Item -Path $app_directory -Recurse -Force
        }
        $changes_made = $true
    }
}

# Restart Splunk if there were any changes
if ($changes_made) {
    Write-Output "Changes were made to apps. Restarting Splunk..."
    & "$SPLUNK_HOME\bin\splunk.exe" restart
} else {
    Write-Output "No changes made to apps. Skipping Splunk restart."
}
