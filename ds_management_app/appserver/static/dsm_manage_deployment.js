require([
    "splunkjs/mvc",
    "splunkjs/mvc/searchmanager",
    "splunkjs/mvc/simplexml/ready!"
], function(mvc, SearchManager ) {

    var defaultTokenModel = mvc.Components.get("default");
    var submittedTokenModel = mvc.Components.get("submitted");

    // Query Variables
    const loadAppSearchQuery = () => `| inputlookup serverclass.csv | search NOT App="-" | dedup App | table App | sort App`;

    const getAppsForServerclassSearchQuery = (serverclass) =>
        `| inputlookup serverclass.csv  | search Serverclass="${serverclass}" NOT App="-" | dedup App | table App | sort App`;
    
    const getWhitelistAndBlacklistClientSearchQuery = (serverclass) =>
        `| inputlookup serverclass.csv  | search Serverclass="${serverclass}" AND Key IN ("whitelist*","blacklist*","machineTypesFilter") | stats values(Value) as Value by Key |  eval Value=mvjoin(Value, ", ")`;

    const updateDSSearchQuery = (serverclass,action,apps,whitelist,blacklist,machineTypesFilter,whitelistFromPathname,whitelistSelectField,whitelistWhereField,whitelistWhereEquals,blacklistFromPathname,blacklistSelectField,blacklistWhereField,blacklistWhereEquals) =>
        `| dsupdate serverclass="${serverclass}" action="${action}" apps="${apps}" whitelist="${whitelist}" blacklist="${blacklist}" machineTypesFilter="${machineTypesFilter}" whitelistFromPathname="${whitelistFromPathname}" whitelistSelectField="${whitelistSelectField}" whitelistWhereField="${whitelistWhereField}" whitelistWhereEquals="${whitelistWhereEquals}" blacklistFromPathname="${blacklistFromPathname}" blacklistSelectField="${blacklistSelectField}" blacklistWhereField="${blacklistWhereField}" blacklistWhereEquals="${blacklistWhereEquals}" `
    
    function startLoader(msg){
        $("#overlay").fadeIn(); 
        $("body").css("overflow", "hidden"); 
        $("#status_message").text(msg); 
    } 
    
    function endLoader(msg){
        $("#overlay").fadeOut();
        $("body").css("overflow", "auto");
        if (msg) {
            // Create a message and display it at the bottom of the screen
            const message = $(`<div class='notification-message'>${msg}</div>`);
            $("body").append(message);  // Append the message to the body

            // Style the message and show it
            message.css({
                position: "fixed",
                bottom: "20px",  // Adjust this to control how high the message is from the bottom
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "#28a745",  // Green background
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "5px",
                fontSize: "16px",
                textAlign: "center",
                zIndex: 9999
            });

            // Hide the message after 10 seconds
            setTimeout(function () {
                message.fadeOut(function () {
                    $(this).remove();  // Remove the message after fading out
                });
            }, 5000);  // 10000 milliseconds = 10 seconds
        }
    }  

    function resetUI(){
        // Hide tabs (app/client) and remove submit panel
        $("#tab1").prop("disabled",true);
        $("#tab2").prop("disabled",true);
        $("#submit_panel").css("display", "none");
        // defaultTokenModel.unset("submit_panel"); 
        // submittedTokenModel.unset("submit_panel");
        $("#add_app").css("display", "none");
        $("#add_client").css("display", "none");
        // defaultTokenModel.unset("add_app"); 
        // submittedTokenModel.unset("add_app"); 
        // defaultTokenModel.unset("add_client"); 
        // submittedTokenModel.unset("add_client");
        $("#tab1").removeClass("active");
        $("#tab2").removeClass("active");
    }

    function populateDropdown(dropdownId, defaultOptionText,selected_value) {
        let searchManager;

        if(dropdownId=="#dropdown"){
            searchManager = new SearchManager({
                search: "| inputlookup serverclass.csv | dedup Serverclass | table Serverclass | sort Serverclass",
                preview: true,
                cache: false,
                autostart: false  
            });
        } else {
            searchManager=new SearchManager({
                search: updateDSSearchQuery("Null","getAllApps","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null"),
                preview: true,
                cache: false,
                autostart: false  
            });
        }
        searchManager.startSearch();
        // searchManager.off("search:done")
        searchManager.on("search:done", function () {
            const results = searchManager.data("results", { count: 0 });
            results.on("data", function () {
                const rows = results.data()?.rows;

                const $dropdown = $(dropdownId);
                $dropdown.empty().append(`<option value="">${defaultOptionText}</option>`);

                // Special case for #appDropdown to handle apps JSON structure
                if (dropdownId === "#appDropdown") {
                    const appData = rows[0][1];
                    if (appData && appData.length > 0) {
                        appData.forEach(app => {
                            $dropdown.append(`<option value="${app}">${app}</option>`);
                        });
                    } else {
                        $dropdown.append(`<option value="">No Results Found</option>`);
                    }
                } else {
                    if (rows && rows.length > 0) {
                        rows.forEach(row => {
                            $dropdown.append(`<option value="${row[0]}">${row[0]}</option>`);
                        });
                    } else {
                        $dropdown.append(`<option value="">No Results Found</option>`);
                    }
                }
                if(selected_value!=""){
                    $dropdown.val(selected_value);
                    $("#modifyButton").trigger("click");
                }
            });
            searchManager = null
        });
        // Optionally, handle any search errors
        searchManager.on("search:error", function() {
            $("#status_message").text("An error occurred while loading Serverclass")
        });
        
    }

    //  This section load with dashboard 
    $(document).ready(function() {

        $("#tab1").prop("disabled",true);
        $("#tab2").prop("disabled",true);
        $("#submit_panel").css("display", "none");
        $("#add_app").css("display", "none");
        $("#add_client").css("display", "none");
        // defaultTokenModel.unset("submit_panel"); 
        // submittedTokenModel.unset("submit_panel");
        fetchRepoLocationSearch = new SearchManager({
            search: "| dssetup ",
            preview: true,
            cache: false,
            autostart: true  
        });
        fetchRepoLocationSearch.on("search:done", function() {
            var results = fetchRepoLocationSearch.data("results", { count: 1 });
            results.on("data", function() {
                const rows = results.data()?.rows;
                if (rows && rows.length > 0) {
                    const status = rows[0][0];  // First element: "success"
                    const message = rows[0][1]; // Second element: "JSON message"
                    if (status == "success") {
                        const data = JSON.parse(message); // Parse the JSON string into an object
                        if (data.dest_repositoryLocation) {
                            $("#repoLocation").text(data.dest_repositoryLocation);
                        } else {
                            $("#repoLocation").text("Not set");
                        }                
                    } else {
                        $("#repoLocation").text("Not set");
                    }  
                } 
            });
        });
        populateDropdown( "#dropdown", "Select a Serverclass","");
        populateDropdown( "#appDropdown", "Select an App","");   
    });

    function is_serverclass_present(serverclassName, callback) {
        const searchQuery = `| inputlookup serverclass.csv | search Serverclass="${serverclassName}" | stats count`;

        const searchManager = new SearchManager({
            search: searchQuery,
            preview: true,
            cache: false,
            autostart: false
        });
    
        searchManager.startSearch();
    
        searchManager.on("search:done", function () {
            const results = searchManager.data("results", { count: 1 });
            
            results.on("data", function () {
                const rows = results.data()?.rows;
                if (rows && rows.length > 0 && parseInt(rows[0][0], 10) > 0) {
                    callback(true); // Serverclass is present
                } else {
                    callback(false); // Serverclass is not present
                }
            });
    
            // Cleanup
            searchManager.off("search:done");
        });
    }
    


    // Button event handlers
    $("#addServerclass").click(function() {
        var inputValue = prompt("Enter Serverclass name:");
        if (inputValue) {
            startLoader("Adding Serverclass ...")
            is_serverclass_present(inputValue, function (isPresent) {
                if (isPresent) {
                    alert(`Serverclass "${inputValue}" is already present.`);
                    endLoader(); 
                } else {

                    var updateDSSearch = new SearchManager({
                        search: updateDSSearchQuery(inputValue,"Add","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null"),
                        preview: true,
                        cache: false,
                        autostart: false
                        }
                    );
                    updateDSSearch.startSearch();
                    updateDSSearch.on("search:done", function() {
                        // Fetch the results
                        var results = updateDSSearch.data("results", { count: 0 }); // Get all rows
                        results.on("data", function() {
                            const rows = results.data()?.rows;
                            if (rows[0][0] === "success") { 
                                populateDropdown( "#dropdown", "Select a Serverclass",inputValue);
                                
                                $("#status_message").text("Serverclass added successfully !!!");                     
                            } else {
                                // Handle failure case
                                $("#status_message").text("Failed to add Serverclass. Please try again.")
                            }
                            endLoader(); 
                            inputValue = null
                            updateDSSearch=null
                        });
                        
                    });
                }
            });

        } else {
            alert("No Serverclass name entered.");
        }
    });

    $("#removeServerclass").click(function() {
        const confirmation = confirm("Are you sure you want to remove the Serverclass?");
        if (confirmation) {

            const serverclassName = $("#dropdown").val();
            if (!serverclassName) {
                alert("Please select a Serverclass to remove.");
                return;
            }
            startLoader("Removing Serverclass ...")
            var updateDSSearch = new SearchManager({
                search: updateDSSearchQuery(serverclassName,"Remove","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null","Null"),
                preview: true,
                cache: false,
                autostart: false
                }
            );
            // updateDSSearch.settings.set("search", updateDSSearchQuery(serverclassName,"Remove","Null","Null","Null","Null"));
            updateDSSearch.startSearch();
            updateDSSearch.on("search:done", function() {
                // Fetch the results
                var results = updateDSSearch.data("results", { count: 0 }); // Get all rows
                results.on("data", function() {
                    const rows = results.data()?.rows;
                    let msg=""
                    if (rows[0][0] === "success") { 
                        populateDropdown( "#dropdown", "Select a Serverclass","");
                        $("#dropdown").val("");
                        msg="Serverclass removed successfully !!!"
                        $("#status_message").text(msg);         
                    }else{
                        msg="Error while removing Serverclass"
                        $("#status_message").text(msg);
                    } 
                    endLoader(msg);
                    resetUI()
                    updateDSSearch=null
                });
            }); 
        } 
    });

    // Modify button logic
    $("#modifyButton").click(function () {
        const selectedOption = $("#dropdown").val();
        $("#tab1").prop("disabled",false);
        $("#tab2").prop("disabled",false);
        // Toggle buttons based on flags
        $("#whitelistToggle").prop("checked", false).change();
        $("#blacklistToggle").prop("checked", false).change();
        if (selectedOption) {
            startLoader("Loading Serverclass ...")
            const check_flag=0
            $("#add_app").css("display", "block");
            $("#submit_panel").css("display", "block");
            $("#add_client").css("display", "none");
            // defaultTokenModel.set("add_app","true"); 
            // defaultTokenModel.unset("add_client"); 
            // defaultTokenModel.set("submit_panel","true"); 
            // submittedTokenModel.set("add_app","true"); 
            // submittedTokenModel.unset("add_client"); 
            // submittedTokenModel.set("submit_panel","true"); 
            
            $("#tab1").addClass("active");
            $("#tab2").removeClass("active");

            getAppsForServerclassSearch = new SearchManager({
                search: getAppsForServerclassSearchQuery(selectedOption),
                preview: true,
                cache: false,
                autostart: false
                }
            );
            getAppsForServerclassSearch.startSearch();

            getAppsForServerclassSearch.on("search:done", function() {
                // Fetch the results
                var results = getAppsForServerclassSearch.data("results", { count: 0 }); // Get all rows
                const $selectedApps = $("#selectedAppsTable tbody");

                let fallbackTimeout = setTimeout(() => {
                    console.log("Fallback: No data received, stopping loader.");
                    $selectedApps.empty();
                    endLoader()
                }, 500); // Timeout set to 5 seconds (adjust as needed)

                results.on("data", function() {
                    clearTimeout(fallbackTimeout); 
                    const rows = results.data()?.rows;
                    $selectedApps.empty();
                    // Populate the dropdown with data
                    if (rows && rows.length > 0) {
                        rows.forEach(row => {
                            const appName = row[0];
                            $selectedApps.append(`
                                <tr>
                                    <td>${appName}</td>
                                    <td><button class="removeAppBtn">x</button></td>
                                </tr>
                            `);
                        });
                    } else {
                        $selectedApps.append(`<tr><td colspan="2">No Apps added</td></tr>`);
                    }
                });
            });
            
            getWhitelistAndBlacklistClientSearch =  new SearchManager({
                search: getWhitelistAndBlacklistClientSearchQuery(selectedOption),
                preview: true,
                cache: false,
                autostart: false
                }
            );
            const filterMapping = {
                "whitelist": $("#whitelist"),
                "blacklist": $("#blacklist"),
                "machinetypesfilter": $("#machineTypesFilter"),
                "whitelist_from_pathname": $("#whitelistFromPathname"),
                "whitelist_select_field": $("#whitelistSelectField"),
                "whitelist_where_equals": $("#whitelistWhereEquals"),
                "whitelist_where_field": $("#whitelistWhereField"),
                "blacklist_from_pathname": $("#blacklistFromPathname"),
                "blacklist_select_field": $("#blacklistSelectField"),
                "blacklist_where_equals": $("#blacklistWhereEquals"),
                "blacklist_where_field": $("#blacklistWhereField")
            };
            
            // Function to reset all fields
            function resetFields() {
                Object.values(filterMapping).forEach(field => field.val(""));
            }
            
            // Function to set placeholders for specific fields
            function setPlaceholders() {
                $("#whitelist, #blacklist, #machineTypesFilter").attr("placeholder", "No results found...");
            }
            let whitelistFlag = false;
            let blacklistFlag = false;

            getWhitelistAndBlacklistClientSearch.startSearch();
            getWhitelistAndBlacklistClientSearch.on("search:done", function() {
                // Fetch the results
                var results = getWhitelistAndBlacklistClientSearch.data("results", { count: 0 }); // Get all rows


                let fallbackTimeout = setTimeout(() => {
                    console.log("Fallback: No data received, stopping loader.");
                    resetFields();
                    setPlaceholders();
                    endLoader();
                }, 500); // Adjust timeout as needed

                results.on("data", function() {
                    clearTimeout(fallbackTimeout); 
                    resetFields(); // Clear all fields initially
                    const rows = results.data()?.rows;

                    if (rows && rows.length > 0) {
                    
                        // Loop through the rows and populate whitelist/blacklist
                        rows.forEach(row => {
                            const filterType = row[0]?.toLowerCase(); // First column
                            const filterValues = row[1]; // Second column
                    
                            if (filterMapping[filterType]) {
                                filterMapping[filterType].val(filterValues); // Populate the corresponding input field
                            }

                            // Check for whitelist_* or blacklist_*
                            if (filterType.startsWith("whitelist_")) {
                                whitelistFlag = true;
                            }
                            if (filterType.startsWith("blacklist_")) {
                                blacklistFlag = true;
                            }
                        });

                        // Toggle buttons based on flags
                        $("#whitelistToggle").prop("checked", whitelistFlag).change();
                        $("#blacklistToggle").prop("checked", blacklistFlag).change();
                    } else {
                        setPlaceholders();
                    }
                    endLoader()
                });
            });

        } else {
            alert("Please select an serverclass from the dropdown.");
        }
    });

    $("#tab1").click(function(){
        $("#add_app").css("display", "block");
        $("#add_client").css("display", "none");
        // defaultTokenModel.set("add_app","true"); 
        // defaultTokenModel.unset("add_client"); 
        // submittedTokenModel.set("add_app","true"); 
        // submittedTokenModel.unset("add_client"); 
        $("#tab1").addClass("active");
        $("#tab2").removeClass("active");
    });

    $("#tab2").click(function(){
        $("#add_client").css("display", "block");
        $("#add_app").css("display", "none");
        // defaultTokenModel.set("add_client","true");
        // defaultTokenModel.unset("add_app"); 
        // submittedTokenModel.set("add_client","true");
        // submittedTokenModel.unset("add_app"); 
        $("#tab2").addClass("active");
        $("#tab1").removeClass("active");
    });



    $("#addApp").click(function () {
        const selectedApp = $("#appDropdown").val();
    
        if (selectedApp) {
            // Check if the app already exists in the table
            let exists = false;
            $("#selectedAppsTable tbody tr").each(function () {
                const rowValue = $(this).find("td:first").text(); // Check the first cell for app name
                if (rowValue === selectedApp) {
                    exists = true;
                    return false; // Break out of the loop
                }
            });
    
            if (!exists) {
                // Add the selected app if it's not already in the table
                $("#selectedAppsTable tbody").append(`
                    <tr>
                        <td>${selectedApp}</td>
                        <td><button class="removeAppBtn">×</button></td>
                    </tr>
                `);
            } else {
                alert("The selected app is already added.");
            }
        } else {
            alert("Please select an app to add.");
        }
    });
        
    $("#selectedAppsTable").on("click", ".removeAppBtn", function () {
        const appName = $(this).closest("tr").find("td:first").text(); // Get app name from the row
        if (confirm(`Are you sure you want to remove "${appName}"?`)) {
            $(this).closest("tr").remove(); // Remove the row
        }
    });

    // Handle whitelist toggle
    $("#whitelistToggle").change(function () {
        if (this.checked) {
            $("#whitelistOptions").slideDown(); // Show options
        } else {
            $("#whitelistOptions").slideUp(); // Hide options
        }
    });

    // Handle blacklist toggle
    $("#blacklistToggle").change(function () {
        if (this.checked) {
            $("#blacklistOptions").slideDown(); // Show options
        } else {
            $("#blacklistOptions").slideUp(); // Hide options
        }
    });

    // Reload DS Button
    $("#ds_managment_reload_button").click(function() {

        startLoader("Reloading Serverclass ...")
        // Start the search
        customCommandSearch = new SearchManager({
            search: "| dsreload",
            preview: true,
            cache: false,
            autostart: false  
        });

        customCommandSearch.startSearch();

        customCommandSearch.on("search:done", function() {
        
            var results = customCommandSearch.data("results", { count: 1 });
            results.on("data", function() {
                const rows = results.data()?.rows;
                let msg=""
                if (rows && rows.length > 0) {
                    const status = rows[0][0];  // First element: "success"
                    const summary = rows[0][2]; // Second element: "summary"
                    const message = rows[0][1]; // Third element: "message."
                    msg=message
                    if (status === "success") {
                        $("#status_message").text(message)
                        // $("#summary_message").html(summary_output).css("color", "blue");
                    } else {
                        $("#status_message").text(message)
                        // $("#summary_message").html(summary_output).css("color", "blue");
                    }
                } 
                endLoader(msg);
                });
        });
    
        // Optionally, handle any search errors
        customCommandSearch.on("search:error", function() {
            $("#status_message").text("An error occurred while reloading Serverclass").css("color", "red");
        });
    });




    // Submit button JS
    $("#submitButton").on("click", function () {
        startLoader("Updating Serverclass ...")

        // Fetch the latest values from the text areas
        const serverclass = $("#dropdown").val().trim();
        const whitelistValue = $("#whitelist").val().trim();
        const blacklistValue = $("#blacklist").val().trim();
        const machineTypesFilterValue = $("#machineTypesFilter").val().trim();
        
        //  Fetch Whitelist/Blacklist Filepath value
        whitelistFromPathname = $("#whitelistFromPathname").val().trim();
        whitelistSelectField = $("#whitelistSelectField").val().trim();
        whitelistWhereField = $("#whitelistWhereField").val().trim();
        whitelistWhereEquals = $("#whitelistWhereEquals").val().trim();
        blacklistFromPathname = $("#blacklistFromPathname").val().trim();
        blacklistSelectField = $("#blacklistSelectField").val().trim();
        blacklistWhereField = $("#blacklistWhereField").val().trim();
        blacklistWhereEquals = $("#blacklistWhereEquals").val().trim();

        if (!$("#whitelistToggle").prop("checked")) {
            whitelistFromPathname="Null";
            whitelistSelectField="Null";
            whitelistWhereField="Null";
            whitelistWhereEquals="Null";
        }

        if (!$("#blacklistToggle").prop("checked")) {
            blacklistFromPathname="Null";
            blacklistSelectField="Null";
            blacklistWhereField="Null";
            blacklistWhereEquals="Null";
        }

        // Fetch all apps from the table
        const apps = [];
        $("#selectedAppsTable tbody tr").each(function () {
            const appName = $(this).find("td:first").text();
            if (appName) {
                apps.push(appName);
            }
        });
        // Convert apps array to a comma-separated string
        const appsCommaSeparated = apps.join(", ") || "Null";

        // Create a variable to store these values
        const filterData = {
            whitelist: whitelistValue || "Null",
            blacklist: blacklistValue || "Null",
            machineTypesFilter: machineTypesFilterValue || "Null",
            apps: appsCommaSeparated,
            action: "Update",
            whitelistFromPathname: whitelistFromPathname || "Null",
            whitelistSelectField: whitelistSelectField || "Null",
            whitelistWhereField: whitelistWhereField || "Null",
            whitelistWhereEquals: whitelistWhereEquals || "Null",
            blacklistFromPathname: blacklistFromPathname || "Null",
            blacklistSelectField: blacklistSelectField || "Null",
            blacklistWhereField: blacklistWhereField || "Null",
            blacklistWhereEquals: blacklistWhereEquals || "Null",
        };

        // Log the values or send them to your endpoint
        var updateDSSearch = new SearchManager({
            search: updateDSSearchQuery(serverclass,filterData["action"],filterData["apps"],filterData["whitelist"],filterData["blacklist"],filterData["machineTypesFilter"],filterData["whitelistFromPathname"],filterData["whitelistSelectField"], filterData["whitelistWhereField"],filterData["whitelistWhereEquals"],filterData["blacklistFromPathname"],filterData["blacklistSelectField"],filterData["blacklistWhereField"],filterData["blacklistWhereEquals"]),
            preview: true,
            cache: false,
            autostart: false
            }
        );
        
        updateDSSearch.startSearch();
        updateDSSearch.on("search:done", function() {
            // Fetch the results
            var results = updateDSSearch.data("results", { count: 0 }); // Get all rows
            results.on("data", function() {
                const rows = results.data()?.rows;
                let msg=""
                if (rows[0][0] === "success") {
                    msg="Serverclass updated successfully !!!"
                    $("#status_message").text(msg)
                    
                } else {
                    msg=`Error in serverclass update: ${rows[0][1]}`
                    $("#status_message").text(msg)
                }    
                endLoader(msg)
                updateDSSearch=null
            });
        });

    });
       
});
