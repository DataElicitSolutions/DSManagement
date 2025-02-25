package main

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

func GetGUID() string {
	// Define the file path
	logToFile("Fetching GUID.")
	guid := ""

	// Open the file
	file, err := os.Open(instance_cfg_path)
	if err != nil {
		logToFile(fmt.Sprintf("Error opening file: %v", err))
		os.Exit(1)
		return ""
	}
	defer file.Close()

	// Read the file line by line
	scanner := bufio.NewScanner(file)
	re := regexp.MustCompile(`^guid\s*=\s*(.+)$`)
	for scanner.Scan() {
		line := scanner.Text()
		// Match the line with "guid = value"
		if matches := re.FindStringSubmatch(line); matches != nil {
			guid = strings.TrimSpace(matches[1])
			break
		}
	}

	// Handle potential errors from scanning
	if err := scanner.Err(); err != nil {
		logToFile(fmt.Sprintf("Error reading file: %v", err))
		os.Exit(1)
		return ""
	}

	// Print the extracted guid
	if guid != "" {
		return guid
	} else {
		logToFile("GUID not found in the file.")
		os.Exit(1)
		return ""
	}
}

func GetClientName() string {
	logToFile("Fetching clientname from deploymentclient.conf if present")
	cmd := exec.Command(filepath.Join(splunkHome, "bin", splunk_binary_name), "btool", "deploymentclient", "list", "deployment-client")
	var std_out bytes.Buffer
	var std_err bytes.Buffer
	cmd.Stdout = &std_out
	cmd.Stderr = &std_err
	if err := cmd.Run(); err != nil {
		logToFile(fmt.Sprintf("Failed to get ClientName : %s , %v", std_err.String(), err))
		return GetGUID()
	}
	output := std_out.String()
	ClientName := ""
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, "clientName") {
			parts := strings.Split(line, "=")
			if len(parts) > 0 {
				ClientName = strings.TrimSpace(parts[len(parts)-1])
				return ClientName
			}
		}
	}
	ClientName = GetGUID()

	return ClientName
}

// restartSplunk restarts the Splunk service
func restartSplunk() {
	logToFile("Restarting Splunk")
	port := GetLocalManagementPort(sessionKey)
	if port == "" {
		logToFile("Failed to find the Splunkd port in the command output")
		port = "8089"
	}
	cmd := exec.Command(filepath.Join(splunkHome, "bin", splunk_binary_name), "_internal", "call", "/services/server/control/restart", "-method", "POST", "-uri", "https://127.0.0.1:"+port, "-token", sessionKey)
	var std_out bytes.Buffer
	var std_err bytes.Buffer
	cmd.Stdout = &std_out
	cmd.Stderr = &std_err
	if err := cmd.Run(); err != nil {
		logToFile(fmt.Sprintf("Failed to restart Splunk: %s, %v", std_err.String(), err))
		markScriptFinished()
		os.Exit(1)
	}
	logToFile("Restart Successful")
	markScriptFinished()
}

func SetDCParameter() {

	logToFile("Fetching parameter from dc.conf")
	cmd := exec.Command(filepath.Join(splunkHome, "bin", splunk_binary_name), "btool", strings.TrimSuffix(filepath.Base(conf_file_name), ".conf"), "list", "general")
	var std_out bytes.Buffer
	var std_err bytes.Buffer
	cmd.Stdout = &std_out
	cmd.Stderr = &std_err

	if err := cmd.Run(); err != nil {
		logToFile(fmt.Sprintf("Failed to get DC.Conf file : %s, %v", std_err.String(), err))
		os.Exit(1)
	}
	output := std_out.String()
	var err error
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, ds_ui_url) {
			parts := strings.Split(line, "=")
			if len(parts) > 0 {
				dsIP = strings.TrimSpace(parts[len(parts)-1])
			}
		}
		if strings.Contains(line, ds_maxretries) {
			parts := strings.Split(line, "=")
			err = nil
			if len(parts) > 0 {
				max_retries, err = strconv.Atoi(strings.TrimSpace(parts[len(parts)-1]))
				if err != nil {
					max_retries = 5
				}
			}
		}
	}
	if dsIP == "" {
		logToFile("Unable to get deployment server UI URL. Hence exiting.")
		os.Exit(1)
	}
}

func GetHost() string {
	logToFile("Fetching hostname")
	cmd := exec.Command(filepath.Join(splunkHome, "bin", splunk_binary_name), "btool", "inputs", "list", "SSL")
	var std_out bytes.Buffer
	var std_err bytes.Buffer
	cmd.Stdout = &std_out
	cmd.Stderr = &std_err

	if err := cmd.Run(); err != nil {
		logToFile(fmt.Sprintf("Failed to get HostName : %s ,%v", std_err.String(), err))
		name, err := os.Hostname()
		if err != nil {
			logToFile(fmt.Sprintf("Failed to get Hostname from OS: %v", err))
			os.Exit(1)
		}
		return name
	}
	output := std_out.String()
	HostName := ""
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, "host = ") {
			parts := strings.Split(line, "=")
			if len(parts) > 0 {
				HostName = strings.TrimSpace(parts[len(parts)-1])
			}
		}
	}
	if HostName == "$decideOnStartup" {
		name, err := os.Hostname()
		if err != nil {
			logToFile(fmt.Sprintf("Failed to get Hostname from OS: %v", err))
			os.Exit(1)
		}
		return name
	}
	return HostName
}

func GetServerName() string {
	logToFile("Fetching servername")
	cmd := exec.Command(filepath.Join(splunkHome, "bin", splunk_binary_name), "btool", "server", "list", "general")
	var std_out bytes.Buffer
	var std_err bytes.Buffer
	cmd.Stdout = &std_out
	cmd.Stderr = &std_err

	if err := cmd.Run(); err != nil {
		logToFile(fmt.Sprintf("Failed to get ServerName : %s, %v", std_err.String(), err))
		os.Exit(1)
	}
	output := std_out.String()
	ServerName := ""
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, "serverName = ") {
			parts := strings.Split(line, "=")
			if len(parts) > 0 {
				ServerName = strings.TrimSpace(parts[len(parts)-1])
			}
		}
	}
	if ServerName != "" {
		return ServerName
	}
	logToFile("Error while fetching servername")
	os.Exit(1)
	return ServerName

}

func GetLocalManagementPort(sessionKey string) string {

	logToFile("Fetching management port")
	cmd := exec.Command(filepath.Join(splunkHome, "bin", splunk_binary_name), "show", "splunkd-port", "-token", sessionKey)

	// Capture the command's output
	var std_out bytes.Buffer
	var std_err bytes.Buffer
	cmd.Stdout = &std_out
	cmd.Stderr = &std_err

	// Execute the command
	if err := cmd.Run(); err != nil {
		logToFile(fmt.Sprintf("Failed to execute command: %s ,%v", std_err.String(), err))
		return ""
	}

	// Process the output to extract the port
	output := std_out.String()
	var port string
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, "Splunkd port") {
			parts := strings.Fields(line)
			if len(parts) > 0 {
				port = parts[len(parts)-1]
				return port
			}
		}
	}

	return port

}
