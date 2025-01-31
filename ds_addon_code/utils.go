package main

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
)

// logToFile appends logs to the script log file
func logToFile(message string) {
	logFile, err := os.OpenFile(scriptLogFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
		os.Exit(0)
	}
	defer logFile.Close()

	log.SetOutput(logFile)
	log.Println(message)
}

func sleepRandomTime() {

	// Generate a random duration between 1 and 10 seconds
	sleepDuration := rand.Intn(10) + 1

	// Log the sleep duration
	logToFile(fmt.Sprintf("Sleeping for %d seconds...", sleepDuration))

	// Sleep for the random duration
	time.Sleep(time.Duration(sleepDuration) * time.Second)
}

// checkIfScriptRunning ensures no multiple instances are running
func checkIfScriptRunning() {
	if _, err := os.Stat(lockFile); err == nil {
		lockTime := getFileModTime(lockFile)
		if time.Since(lockTime).Seconds() < 300 {
			logToFile("Script is already running. Exiting...")
			os.Exit(0)
		}
		_ = os.Remove(lockFile) // Remove stale lock file
	}
}

// getFileModTime returns the last modification time of a file
func getFileModTime(filePath string) time.Time {
	info, err := os.Stat(filePath)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

// markScriptRunning creates a lock file
func markScriptRunning() {
	_, _ = os.Create(lockFile)
}

// markScriptFinished removes the lock file
func markScriptFinished() {
	_ = os.Remove(lockFile)
}

// updateLastSuccessfulPull updates the last successful pull timestamp
func updateLastSuccessfulPull() {
	currentTime := strconv.FormatInt(time.Now().Unix(), 10)
	_ = os.WriteFile(lastRunFile, []byte(currentTime), 0644)
}

// calculateChecksum calculates the MD5 checksum of a file
func calculateChecksum(filePath string) string {
	file, err := os.Open(filePath)
	if err != nil {
		logToFile(fmt.Sprintf("Failed to open file: %v", err))
		return ""
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		logToFile(fmt.Sprintf("Failed to calculate checksum: %v", err))
		return ""
	}
	return hex.EncodeToString(hash.Sum(nil))
}

// Get preferred outbound ip of this machine
func getLocalIPForHTTP() string {
	// Parse the URL to extract the hostname
	parsedURL, err := http.NewRequest("GET", dsIP, nil)
	if err != nil {
		logToFile(fmt.Sprintf("error parsing URL: %v", err))
		os.Exit(1)
		return ""
	}

	host := parsedURL.URL.Hostname()
	port := parsedURL.URL.Port()

	// Default to port 80 or 443 if not specified
	if port == "" {
		if parsedURL.URL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	// Resolve the host:port
	address := net.JoinHostPort(host, port)

	// Create a TCP connection to the resolved address
	conn, err := net.Dial("tcp", address)
	if err != nil {
		logToFile(fmt.Sprintf("could not determine local IP for %s: %v", dsIP, err))
		os.Exit(1)
		return ""
	}
	defer conn.Close()

	// Get the local address of the connection
	localAddr := conn.LocalAddr().(*net.TCPAddr)
	if localAddr.IP.String() == "" {
		logToFile("Failed to get Local IP")
		os.Exit(1)
	}
	return localAddr.IP.String()
}
