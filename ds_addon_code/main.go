package main

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

var (
	sessionKey                 string
	splunkHome                 string
	scriptLogFile              string
	lockFile                   string
	lastRunFile                string
	outputPath                 string
	finalAppPath               string
	appsDownloadList           string
	final_apps_download_list   string
	instance_cfg_path          string
	splunk_binary_name         string
	dsIP                       = ""
	phoneHomeUrl               string
	phoneHomeUrlStatic         string
	max_retries                = 5
	retry_count                = 0
	phonehome_file_name        string
	header                     string
	GUID                       string
	IP                         string
	HOST                       string
	SERVERNAME                 string
	CLIENTNAME                 string
	success                    = true
	OS                         string
	changes_made               = false
	phonehome_complete_time    string
	app_download_complete_time string
	script_start_time          string
	script_end_time            string
	current_app_name           = "dc_app"
	ds_ui_url                  = "ds_ui_url"
	ds_maxretries              = "max_retries"
	conf_file_name             = "dc.conf"
	download_url               string
	status_url                 string
)

func init_variable() error {

	// Initialize necessary variables
	ex, err := os.Executable()
	if err != nil {
		return err
	}

	scriptPath := filepath.Dir(ex)
	splunkHome = filepath.Join(scriptPath, "..", "..", "..", "..")
	scriptLogFile = filepath.Join(splunkHome, "var", "log", "splunk", "dc_script.log")
	lockFile = filepath.Join(splunkHome, "var", "run", "data", current_app_name, "dc_script_running.lock")
	lastRunFile = filepath.Join(splunkHome, "var", "run", "data", current_app_name, "dc_last_successful_pull.time")
	outputPath = filepath.Join(splunkHome, "var", "run", "data", current_app_name, "apps")
	finalAppPath = filepath.Join(splunkHome, "etc", "apps")
	appsDownloadList = filepath.Join(splunkHome, "var", "run", "data", current_app_name)
	instance_cfg_path = filepath.Join(splunkHome, "etc", "instance.cfg")

	OS = path.Base(ex)
	OS = strings.TrimPrefix(OS, "dc_")
	if strings.Contains(OS, "windows") {
		OS = strings.TrimSuffix(OS, ".exe")
		splunk_binary_name = "splunk.exe"
	} else {
		splunk_binary_name = "splunk"
	}

	SetDCParameter()
	GUID = GetGUID()
	IP = getLocalIPForHTTP()
	HOST = GetHost()
	SERVERNAME = GetServerName()
	CLIENTNAME = GetClientName()

	phonehome_file_name = GUID + "__" + IP + "__" + HOST + "__" + OS + ".txt"
	final_apps_download_list = filepath.Join(appsDownloadList, phonehome_file_name)

	if _, err := os.Stat(appsDownloadList); os.IsNotExist(err) {
		logToFile(fmt.Sprintf("Directory %s does not exist. Creating it...", appsDownloadList))
		if err := os.MkdirAll(appsDownloadList, os.ModePerm); err != nil {
			logToFile(fmt.Sprintf("Failed to create directory: %v", err))
			os.Exit(1)
		}
	} else {
		logToFile(fmt.Sprintf("Directory %s exists.", appsDownloadList))
	}

	phoneHomeUrl = dsIP + "/servicesNS/-/ds_management_app/Phonehome"
	phoneHomeUrlStatic = dsIP + "/static/ds_management_app/apps_download_list/" + phonehome_file_name
	download_url = dsIP + "/static/ds_management_app/apps/"
	status_url = dsIP + "/servicesNS/-/ds_management_app/dcStatus"
	header = "application/x-www-form-urlencoded"

	return nil
}

// main contains the overall script logic
func main() {
	scanner := bufio.NewScanner(os.Stdin)

	if scanner.Scan() {
		sessionKey = scanner.Text()
	}

	if sessionKey == "" {
		logToFile("Error: SESSION_KEY is empty. Exiting...")
		os.Exit(1)
	}

	script_start_time = time.Now().Format("2006-01-02 15:04:05")

	err := init_variable()
	if err != nil {
		logToFile(fmt.Sprintf("Error while initializing variable %s", err.Error()))
		os.Exit(1)
	}

	checkIfScriptRunning()
	markScriptRunning()
	defer markScriptFinished()

	logToFile("Pulling application...")
	logToFile("UF Info : UUID   - " + GUID)
	logToFile("UF Info : IP     - " + IP)
	logToFile("UF Info : host   - " + HOST)
	logToFile("UF Info : Server - " + SERVERNAME)
	logToFile("UF Info : ClientName - " + CLIENTNAME)

	http_status := doHTTPGETRequest(phoneHomeUrlStatic, final_apps_download_list)
	if !http_status {
		success = false
	}

	if !success {
		for retry_count < max_retries {
			sleepRandomTime()

			data := url.Values{}
			data.Set("guid", GUID)
			data.Set("private_ip", IP)
			data.Set("hostname", HOST)
			data.Set("servername", SERVERNAME)
			data.Set("clientname", CLIENTNAME)
			data.Set("os", OS)
			http_status = doHTTPPOSTRequest(phoneHomeUrl, data)
			if http_status {
				http_status = doHTTPGETRequest(phoneHomeUrlStatic, final_apps_download_list)
				if http_status {
					phonehome_complete_time := time.Now().Format("2006-01-02 15:04:05")
					logToFile(fmt.Sprintf("Phonehome call completed successfully at %v", phonehome_complete_time))
					success = true
					break
				} else {
					logToFile(fmt.Sprintf("Failed to download  %s", phonehome_file_name))
					success = false
					break
				}
			} else {
				logToFile("Phonehome call failed with status code. Retrying...")
				retry_count = retry_count + 1
				success = false
			}
		}
	}

	if !success {
		logToFile(fmt.Sprintf("Phonehome call failed after %d attempts. Exiting..", retry_count))
		markScriptFinished()
		os.Exit(1)
	}

	phonehome_complete_time = time.Now().Format("2006-01-02 15:04:05")

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		logToFile(fmt.Sprintf("Directory %s does not exist. Creating it...", outputPath))
		if err := os.MkdirAll(outputPath, os.ModePerm); err != nil {
			logToFile(fmt.Sprintf("Failed to create directory: %v", err))
			os.Exit(1)
		}
	} else {
		logToFile(fmt.Sprintf("Directory %s exists.", outputPath))
	}

	file, err := os.Open(final_apps_download_list)
	if err != nil {
		logToFile(fmt.Sprintf("Failed to open file: %v", err))
		return
	}
	defer file.Close()

	// Create a CSV reader
	reader := csv.NewReader(file)
	apps_from_phonehome := make(map[string]string)
	var failed_apps []string
	var installed_apps []string
	// Read the file line by line
	for {
		record, err := reader.Read()
		if err != nil {
			if err.Error() == "EOF" {
				break // End of file
			}
			logToFile(fmt.Sprintf("Error reading line: %v", err))
			os.Exit(1)
		}

		// Assign values to variables
		if len(record) >= 2 { // Ensure the line has enough fields
			var app_name, checksum, app_tgz_path string
			app_name = record[0]
			checksum = record[1]
			if checksum == "None" {
				logToFile(fmt.Sprintf("Received None as checksum for app %s. Seems like app is not present on DS. Skipping.", app_name))
				failed_apps = append(failed_apps, app_name)
				continue
			}
			apps_from_phonehome[app_name] = checksum
			app_tgz_path = filepath.Join(outputPath, app_name+".tgz")
			// app_tgz_path = outputPath + "/" + app_name + ".tgz"

			var currentChecksum string
			if _, err := os.Stat(app_tgz_path); err == nil {
				// Calculate the checksum
				currentChecksum = calculateChecksum(app_tgz_path)
				if currentChecksum == "" {
					logToFile(fmt.Sprintf("Failed to calculate checksum for %s", app_tgz_path))
				}
			} else {
				currentChecksum = ""
				logToFile(fmt.Sprintf("File %s does not exist. Setting checksum to an empty string.", app_tgz_path))
			}

			if currentChecksum == checksum {
				logToFile(fmt.Sprintf("Checksum matches for %s. Skipping download.", app_name))
				installed_apps = append(installed_apps, app_name)
				continue
			}

			logToFile(fmt.Sprintf("Checksum mismatch for %s. Downloading the app...", app_name))
			changes_made = true

			if _, err := os.Stat(app_tgz_path); err == nil {
				err := os.Remove(app_tgz_path)
				if err != nil {
					logToFile(fmt.Sprintf("Failed to remove file %s: %v", app_tgz_path, err))
					failed_apps = append(failed_apps, app_name)
					continue
				}
				logToFile(fmt.Sprintf("File %s removed successfully.", app_tgz_path))
			}

			temp_download_url := download_url + app_name + ".tgz"
			http_status = doHTTPGETRequest(temp_download_url, app_tgz_path)
			if !http_status {
				logToFile(fmt.Sprintf("Failed to download %s: Skipping...", app_name))
				failed_apps = append(failed_apps, app_name)
				continue
			}

			appDirPath := filepath.Join(finalAppPath, app_name)

			if _, err := os.Stat(appDirPath); err == nil {
				err := os.RemoveAll(appDirPath)
				if err != nil {
					logToFile(fmt.Sprintf("Failed to remove directory %s: %v", appDirPath, err))
					failed_apps = append(failed_apps, app_name)
					continue
				}
				logToFile(fmt.Sprintf("Directory %s removed successfully.", appDirPath))
			}

			err := untarGz(app_tgz_path, finalAppPath)
			if err != nil {
				logToFile(fmt.Sprintf("Failed to untar file %s: %v", app_tgz_path, err))
				failed_apps = append(failed_apps, app_name)
				continue
			}
			installed_apps = append(installed_apps, app_name)
			logToFile(fmt.Sprintf("%s has been updated successfully.", app_name))

		} else {
			logToFile("Not enough fields in this line!")
		}
	}

	app_download_complete_time = time.Now().Format("2006-01-02 15:04:05")

	tgzFiles, err := filepath.Glob(filepath.Join(outputPath, "*.tgz"))
	if err != nil {
		logToFile(fmt.Sprintf("Failed to list .tgz files: %v", err))
	}

	for _, tgzFile := range tgzFiles {
		// Extract the app name from the .tgz file name
		tgzAppName := strings.TrimSuffix(filepath.Base(tgzFile), ".tgz")

		// Check if the app is in the appsFromPhonehome map
		if _, exists := apps_from_phonehome[tgzAppName]; !exists {
			logToFile(fmt.Sprintf("Removing unused .tgz file and directory for app: %s", tgzAppName))

			// Remove the .tgz file
			if err := os.Remove(tgzFile); err != nil {
				logToFile(fmt.Sprintf("Failed to remove .tgz file %s: %v", tgzFile, err))
			}

			// Check if the directory exists and remove it
			appDir := filepath.Join(finalAppPath, tgzAppName)
			if _, err := os.Stat(appDir); err == nil {
				if err := os.RemoveAll(appDir); err != nil {
					logToFile(fmt.Sprintf("Failed to remove directory %s: %v", appDir, err))
				}
			}
		}
	}

	if changes_made {

		current_time := time.Now().Format("2006-01-02 15:04:05")

		installed_apps_string := strings.Join(installed_apps, ",")
		failed_apps_string := strings.Join(failed_apps, ",")
		script_end_time = time.Now().Format("2006-01-02 15:04:05")
		data := url.Values{}
		data.Set("current_time", current_time)
		data.Set("guid", GUID)
		data.Set("script_start_time", script_start_time)
		data.Set("phonehome_complete_time", phonehome_complete_time)
		data.Set("app_download_complete_time", app_download_complete_time)
		data.Set("script_end_time", script_end_time)
		data.Set("installed_apps", installed_apps_string)
		data.Set("failed_apps", failed_apps_string)
		http_status = doHTTPPOSTRequest(status_url, data)
		if !http_status {
			logToFile("Failed to update time on DS.")
		}

		updateLastSuccessfulPull()
		restartSplunk()

	} else {
		logToFile("No changes made to apps. Skipping Splunk restart.")
	}
}
