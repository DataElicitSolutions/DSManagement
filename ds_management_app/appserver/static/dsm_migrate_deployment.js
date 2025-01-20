require([
    "splunkjs/mvc",
    "splunkjs/mvc/searchmanager",
    "splunkjs/mvc/simplexml/ready!"
], function(mvc, SearchManager ) {

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

    // Define a search manager to fetch the existing value
    var fetchValueSearch = new SearchManager({
        id: "fetch_value_search",
        search: "| dssetup ",
        preview: true,
        cache: false,
        autostart: true  // Automatically start this search when the page loads
    });

    startLoader("Loading ...");
    // Populate the text box on page load
    fetchValueSearch.on("search:done", function() {
    var results = fetchValueSearch.data("results", { count: 1 });
    results.on("data", function() {
        const rows = results.data()?.rows;
        if (rows && rows.length > 0) {
            // Extract the status and message from the first row
            const status = rows[0][0];  // First element: "success"
            const message = rows[0][1]; // Second element: "JSON message"

            // Update the status message based on the status
            if (status == "success") {
                const data = JSON.parse(message); // Parse the JSON string into an object
                $("#repoLocation").text(data.dest_repositoryLocation);
            } 
            endLoader()
        } 
        });
    });

    $(document).ready(function () {
        // Show/Hide source and destination paths for Migrate Apps
        $("#migrateApps").change(function () {
            if ($(this).is(":checked")) {
                $("#appsPaths").show(); // Show the source and destination paths
            } else {
                $("#appsPaths").hide(); // Hide the source and destination paths
            }
        });
    
        // Show/Hide serverclass options and override checkbox
        $("#migrateServerclass").change(function () {
            if ($(this).is(":checked")) {
                $("#serverclass-box").show(); // Show the serverclass migration box
            } else {
                $("#serverclass-box").hide(); // Hide the serverclass migration box
            }
        });
    
    });
    

    // Handle Submit Button
    $("#submitButton").click(function () {
        const isMigrateAppsChecked = $("#migrateApps").is(":checked");
        const isMigrateServerclassChecked = $("#migrateServerclass").is(":checked");
        const isOverrideChecked = $("#overrideServerclass").is(":checked");
       
        if(!isMigrateAppsChecked && !isMigrateServerclassChecked){
            alert("Choose Migrate app / Migrate Serverclass Option")
            endLoader()
            return;
        }
        startLoader("Migrating Deployment server ...")

        customCommandSearch = new SearchManager({
            search: `| dsmigrate apps="${isMigrateAppsChecked}", override="${isOverrideChecked}", serverclass="${isMigrateServerclassChecked}"`,
            preview: true,
            cache: false,
            autostart: false  
        });

        customCommandSearch.startSearch();

        // Listen for the search to complete and clear the status message
        customCommandSearch.on("search:done", function() {
            
            var results = customCommandSearch.data("results", { count: 1 });
            results.on("data", function() {
                const rows = results.data()?.rows;
                let msg=""
                if (rows && rows.length > 0) {
                    // Extract the status and message from the first row
                    const status = rows[0][0];  // First element: "success"
                    const message = rows[0][1]; // Third element: "message."
                    msg=message
                    // Update the status message based on the status
                    if (status === "success") {
                        $("#status_message").text(message)
                    
                    } else {
                        $("#status_message").text(message)
                    }
                } 
                endLoader(msg)
            });
        });

        // Optionally, handle any search errors
        customCommandSearch.on("search:error", function() {
            $("#status_message").text("An error occurred while reloading Serverclass").css("color", "red");
        });
    });
    

});
