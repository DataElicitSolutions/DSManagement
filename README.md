# Splunk DS (Deployment Server) Management App ![Build Status](https://img.shields.io/badge/build-Released-brightgreen)

## 📖 Description
For Splunk Enterprise customers using **Splunk Deployment Server** functionality with more than **5,000 Deployment Clients**, performance issues such as **slowness on Deployment Server UI**, **delays in add-on/app pushes**, and the need to **increase polling interval from 60 seconds (default) to 5–10 minutes** are common.

To address this, we have created the **DS Management App** using a custom Splunk REST Endpoint. This app replicates the Deployment Server functionality but with improved performance:

- Supports **10,000+ Deployment Clients** with **60-second polling intervals**.
- Provides a **responsive UI** that can manage thousands of servers seamlessly.
- Simplifies management and migration of apps and server classes.

---

## ⚡ Installation / Setup Instructions

### Step 1: Install DS Management App
- Install the **DS Management App** on your Deployment Server.

### Step 2: Configuration
1. Navigate to the **Configuration** page.  
2. Fill in the following details in the text box:
   - Deployment Server IP/DNS  
   - Destination Repository Location  
   - PhoneHome Interval  
   - Freeze Pull  
3. Click **Submit**.

### Step 3: Migration
This page is used to migrate your existing DS to the DS Management App.  
⚠️ **Note:** Migration of apps and server classes can only be performed **once**.

1. Go to **Migrate Deployment Server** page.  
2. Select the checkboxes:  
   - **Migrate Apps** (moves all apps from your DS to DS Management App).  
   - **Migrate serverclass.conf** (moves `serverclass.conf` from your DS to DS Management App).  
3. Click **Submit**.

### Step 4: Remove `serverclass.conf`
Before migrating Deployment Clients, **remove the `serverclass.conf` file** to avoid overriding apps on clients.

### Step 5: Migrate Deployment Clients
1. Go to **Settings > Forwarder Management**.  
2. Edit the server class `dc_app_clients` and add clients (use `*` in Include to move all clients).

---

## 🚀 Usage
Use the **"Manage Deployment Server" Dashboard** of the app to configure **server classes** and **deployment apps**.

---

## ⚙️ Technical & Contribution Sections

### Architecture / Project Structure
<img width="1917" height="5645" alt="image" src="https://github.com/user-attachments/assets/85eecbc7-16b9-4d19-8d00-3d4362a901bf" />

### 🧪 Tests
To test the application on a few deployment clients:  
1. Follow **Steps 1–3** from Installation.  
2. Blacklist the deployment client(s) you want to test from all server classes.  
3. Add the test client(s) to the `dc_app_clients` server class.  
4. Wait for a while – the deployment client should start appearing in the **Deployment Client Dashboard** of the app, and all apps/add-ons should be installed automatically.

---

## ⚠️ Limitations / Unsupported Parameters

While the DS Management App replicates most Deployment Server functionalities, certain parameters from `serverclass.conf` are **not supported** in this release.  

**Cons – Unsupported Parameters:**  

- `excludeFromUpdate = <comma-separated list>`  
- `targetRepositoryLocation = <path>`  
- `continueMatching = <boolean>`  
- `endpoint = <URL template string>`  
- `packageTypesFilter = <comma-separated list>`  
- `updaterRunningFilter = <boolean>`  
- `restartIfNeeded = <boolean>`  
- `stateOnClient = <enabled | disabled | noop>`  
- `precompressBundles = <boolean>`  
- `sourceRepositoryLocation = <path>`  

If your existing configuration relies on these parameters, please adjust accordingly before migration.  

---

## 📄 License
This project is licensed under the **AGPL License**.  
For details, see the [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.html).

---

## 👥 Authors
- **Ravi Nandasana**  
- **Bhavik Bhalodia**

## 🔧 Maintainers
- **Data Elicit Solutions Pvt. Ltd.**

---
## 📬 Support
For support, please contact: **splunk.support@dataelicit.com**
---

## 🙏 Acknowledgements
- This project leverages **GoLang** code to support multiple OS architecture using single code



