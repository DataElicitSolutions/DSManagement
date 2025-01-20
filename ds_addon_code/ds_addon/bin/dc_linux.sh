#!/bin/sh
# Detect the operating system
OS_TYPE=$(uname -s)
ARCH_TYPE=$(uname -m)
read -r SESSION_KEY
Check if the variable has a value
if [ -z "$SESSION_KEY" ]; then
    echo "Error: SESSION_KEY is empty. Exiting..."
    exit 1
fi

cd "$(dirname "$0")"
# Function to run the appropriate binary based on the OS and architecture
run_binary() {  
    case "$OS_TYPE" in    
        Linux)
            if [ "$ARCH_TYPE" == "x86_64" ]; then
                echo  $SESSION_KEY | ./dc_linux-x86_64
            elif [ "$ARCH_TYPE" == "aarch64" ]; then
                echo  $SESSION_KEY | ./dc_linux-aarch64 
            elif [ "$ARCH_TYPE" == "arm64" ]; then
                echo  $SESSION_KEY |./dc_linux-aarch64
            elif [ "$ARCH_TYPE" == "s390x" ]; then
                echo  $SESSION_KEY | ./dc_linux-s390x
            elif [ "$ARCH_TYPE" == "ppcle" ]; then
                echo  $SESSION_KEY |./dc_linux-powerpc64le
            elif [ "$ARCH_TYPE" == "ppc64le" ]; then
                echo  $SESSION_KEY |./dc_linux-powerpc64le
            elif [ "$ARCH_TYPE" == "i686" ]; then
                echo  $SESSION_KEY |./dc_linux-i686
            else        
                echo "Unsupported architecture: $ARCH_TYPE"
                exit 1      
            fi      
            ;;    
        Darwin)      
            if [ "$ARCH_TYPE" == "x86_64" ]; then
                echo  $SESSION_KEY |./dc_darwin-x86_64
            elif [ "$ARCH_TYPE" == "arm64" ]; then
                echo  $SESSION_KEY |./dc_darwin-arm64
            else        
                echo "Unsupported architecture: $ARCH_TYPE"
                exit 1      
            fi      
            ;;
        FreeBSD)      
            if [ "$ARCH_TYPE" == "amd64" ]; then
                echo  $SESSION_KEY |./dc_freebsd-amd64
            elif [ "$ARCH_TYPE" == "386" ]; then
                echo  $SESSION_KEY |./dc_freebsd-i386
            else        
                echo "Unsupported architecture: $ARCH_TYPE"
                exit 1      
            fi      
            ;;
        SunOS)      
            if [ "$ARCH_TYPE" == "amd64" ]; then
                echo  $SESSION_KEY |./dc_sunos-x64
            # elif [ "$ARCH_TYPE" == "sparc64" ]; then
            #     echo  $SESSION_KEY |./dc_sunos-sparc64
            else        
                echo "Unsupported architecture: $ARCH_TYPE"
                exit 1      
            fi      
            ;;
        AIX)      
            if [ "$ARCH_TYPE" == "ppc64" ]; then
                echo  $SESSION_KEY |./dc_aix-powerpc
            else        
                echo "Unsupported architecture: $ARCH_TYPE"
                exit 1      
            fi      
            ;;
        *)
            echo "Unsupported OS: $OS_TYPE"      
            exit 1      
            ;;  
        esac
    }
# Execute the binary
run_binary