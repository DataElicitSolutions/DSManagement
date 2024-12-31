require([
    "splunkjs/mvc",
    "splunkjs/mvc/searchmanager",
    "splunkjs/mvc/simplexml/ready!"
], function(mvc, SearchManager, ) {

    const list_serverclass_query =  'inputlookup serverclass.csv | dedup App | table App | search App!="-";';

    // Define a search manager for the custom command
    var customCommandSearch = new SearchManager({
        id: "custom_command_search",
        search: list_serverclass_query,
        preview: true,
        cache: false,
        autostart: false  
    });

  
    $("#ds_managment_reload_button").click(function() {
        // Show the status message
        $("#status_message").text("Reloading Serverclass ...").css("color", "blue");
        
        // Start the search
        customCommandSearch.startSearch();
    });

    // Listen for the search to complete and clear the status message
    customCommandSearch.on("search:done", function() {
        $("#status_message").text("Serverclass reloaded successfully.").css("color", "green");
    });

    // Optionally, handle any search errors
    customCommandSearch.on("search:error", function() {
        $("#status_message").text("An error occurred while reloading Serverclass").css("color", "red");
    });
});
