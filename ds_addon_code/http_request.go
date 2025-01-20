package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func doHTTPGETRequest(url string, destination_file string) bool {
	// Make the HTTP request
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // Skip certificate verification
			},
		},
	}

	resp, err := client.Get(url)
	if err != nil {
		logToFile(fmt.Sprintf("HTTP Request Failed with error %s", err))
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logToFile(fmt.Sprintf("HTTP Request Failed with status code %d", resp.StatusCode))
		return false
	} else {
		if destination_file != "" {
			outFile, err := os.Create(destination_file)
			if err != nil {
				logToFile(fmt.Sprintf("Failed to create file %s: %v", destination_file, err))
				return false
			}
			_, err = io.Copy(outFile, resp.Body)
			if err != nil {
				logToFile(fmt.Sprintf("Failed to write to file %s: %v", destination_file, err))
				return false
			}
			defer outFile.Close()
		}
		return true
	}
}

func doHTTPPOSTRequest(url1 string, data url.Values) bool {
	// Make the HTTP request

	encodedData := data.Encode()

	req, err := http.NewRequest("POST", url1, strings.NewReader(encodedData))
	if err != nil {
		logToFile(fmt.Sprintf("Failed to create request: %v", err))
		return false
	}
	req.Header.Set("Content-Type", header)
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // Skip certificate verification
			},
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		logToFile(fmt.Sprintf("Failed to make request: %v", err))
		return false
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logToFile(fmt.Sprintf("Failed to read response body: %v", err))
		return false
	}

	// Get the HTTP status code
	statusCode := resp.StatusCode

	// Print the status code and response body
	logToFile(fmt.Sprintf("Response Code: %d, %s", statusCode, string(body)))

	if statusCode != http.StatusOK {
		logToFile(fmt.Sprintf("HTTP Request Failed with status code %d", statusCode))
		return false
	}
	return true
}
