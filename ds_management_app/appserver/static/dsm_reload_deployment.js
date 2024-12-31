require([
    "splunkjs/mvc",
    "splunkjs/mvc/searchmanager",
    "splunkjs/mvc/simplexml/ready!"
], function(mvc, SearchManager, ) {

    // Define a search manager for the custom command
    var customCommandSearch = new SearchManager({
        id: "custom_command_search",
        search: "| dsreload",
        preview: true,
        cache: false,
        autostart: false  
    });

   
    $("#ds_managment_reload_button").click(function() {

        $("#ds_managment_reload_button").prop("disabled", true);
        // Show the status message
        $("#status_message").text("Reloading Serverclass ...").css("color", "blue");
        $("#loader").show(); // Show the loader
        
        // Start the search
        customCommandSearch.startSearch();
    });

    // Listen for the search to complete and clear the status message
    customCommandSearch.on("search:done", function() {
        
        var results = customCommandSearch.data("results", { count: 1 });
        results.on("data", function() {
            const rows = results.data()?.rows;
            if (rows && rows.length > 0) {
                // Extract the status and message from the first row
                const status = rows[0][0];  // First element: "success"
                const summary = rows[0][2]; // Second element: "summary"
                const message = rows[0][1]; // Third element: "message."
               
                // let summary_output = "Reload Summary:<br>"; 
                // summary_output += summary.join("<br>"); 
                
                // Update the status message based on the status
                if (status === "success") {
                    $("#status_message").text(message).css("color", "green");
                    // $("#summary_message").html(summary_output).css("color", "blue");
                } else {
                    $("#status_message").text(message).css("color", "red");
                    // $("#summary_message").html(summary_output).css("color", "blue");
                }
            } 
            $("#loader").hide(); // Stop the loader once results are processed
            $("#ds_managment_reload_button").prop("disabled", false);
            });
    });

    // Optionally, handle any search errors
    customCommandSearch.on("search:error", function() {
        $("#status_message").text("An error occurred while reloading Serverclass").css("color", "red");
    });
});
