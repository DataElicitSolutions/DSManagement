#!/bin/sh
env GOOS=aix GOARCH=ppc64 go build -o ds_addon/bin/dc_aix-powerpc *.go 
env GOOS=solaris GOARCH=amd64 go build -o ds_addon/bin/dc_sunos-x64 *.go
env GOOS=solaris GOARCH=sparc64 go build -o ds_addon/bin/dc_sunos-sparc64 *.go
env GOOS=darwin GOARCH=arm64 go build -o ds_addon/bin/dc_darwin-arm64 *.go
env GOOS=darwin GOARCH=amd64 go build -o ds_addon/bin/dc_darwin-x86_64 *.go
env GOOS=windows GOARCH=amd64 go build -o ds_addon/bin/dc_windows-x64.exe *.go
env GOOS=windows GOARCH=386 go build -o ds_addon/bin/dc_windows-intel.exe *.go
env GOOS=freebsd GOARCH=amd64 go build -o ds_addon/bin/dc_freebsd-amd64 *.go
env GOOS=freebsd GOARCH=386 go build -o ds_addon/bin/dc_freebsd-i386 *.go
env GOOS=linux GOARCH=386 go build -o ds_addon/bin/dc_linux-i686 *.go
env GOOS=linux GOARCH=amd64 go build -o ds_addon/bin/dc_linux-x86_64 *.go
env GOOS=linux GOARCH=arm64 go build -o ds_addon/bin/dc_linux-aarch64 *.go
env GOOS=linux GOARCH=s390x go build -o ds_addon/bin/dc_linux-s390x *.go
env GOOS=linux GOARCH=ppc64le go build -o ds_addon/bin/dc_linux-powerpc64le *.go  
tar --exclude=".git*" --exclude="local*" --exclude=".DS_Store*" --exclude="*pyc*" --exclude="._*" -cvzf ds_addon.tgz ds_addon
yes | cp ds_addon.tgz ./../ds_management_app/data/setup_app

# solaris-sparc --- SunOS-sparcv9
# solaris-amd64-manifest - SunOS-x86_64
# linux-s390x-manifest --- Linux-s390x
# linux-ppc64le-manifest --- Linux-powerpc64le
# freebsd14-amd64-manifest --- FreeBSD-amd64
# freebsd13-amd64-manifest --- FreeBSD-amd64
# aix-powerpc-manifest --- AIX-powerpc
# linux-arm64-manifest --- Linux-aarch64
# linux-amd64-manifest --- Linux-x86_64
# darwin-universal2-manifest --- Darwin-universal
# darwin-intel-manifest --- Darwin-x86_64
