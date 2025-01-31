require([
    "splunkjs/mvc",
    "splunkjs/mvc/searchmanager",
    "splunkjs/mvc/simplexml/ready!"
], function(mvc, SearchManager) {

    // Define a search manager to fetch the existing value
    var fetchValueSearch = new SearchManager({
        id: "fetch_value_search",
        search: "| dssetup ",
        preview: true,
        cache: false,
        autostart: true  // Automatically start this search when the page loads
    });

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

                // Populate the input fields with the corresponding values
                $("#dsURL").val(data.dsIP);
                $("#repoLocation").val(data.dest_repositoryLocation);
                $("#phonehome").val(data.phonehome);
        
            } 
            endLoader()
        } 
        });
    });


    // Handle submit button click
    $("#submit").click(function() {
        var dsURL = $("#dsURL").val().trim();
        var repoLocation = $("#repoLocation").val().trim();
        var phonehome = $("#phonehome").val().trim();

        // Check for missing values
        if (!dsURL) {
            alert("Please provide a value for DS URL.");
            return;
        }
        if (!repoLocation) {
            alert("Please provide a value for Destination Repository Location.");
            return;
        }
        if (!phonehome) {
            alert("Please provide a value for Phonehome Interval.");
            return;
        }


        // Check if phonehome is integers
        if (isNaN(phonehome) || parseInt(phonehome) != phonehome) {
            alert("Phonehome must be an integer.");
            return;
        }

        // Convert to integers
        phonehome = parseInt(phonehome);

        customCommandSearch = new SearchManager({
            search: `| dssetup dsIP="${dsURL}", phonehome="${phonehome}", repositoryLocation="${repoLocation}"`,
            preview: true,
            cache: false,
            autostart: false  
        });

        startLoader("Updating configurations ...");
 
        // Start the search
        customCommandSearch.startSearch();

        // Handle successful completion
        customCommandSearch.on("search:done", function() {
            
            const results = customCommandSearch.data("results", { count: 1 });
            results.on("data", function() {
                const rows = results.data()?.rows;
                let msg=""
                if (rows && rows.length > 0) {
                    // Extract the status and message from the first row
                    const status = rows[0][0];  // First element: "success"
                    const message = rows[0][1]; // Second element: "Successfully Updated configurations."
                    msg=message
                    // Update the status message based on the status
                    if (status === "success") {
                        $("#status_message").text(message)
                    } else {
                        msg="Error is setup please try again"
                        $("#status_message").text(msg)
                    }
                } 
                endLoader(msg)
            });
        
        });

        // Handle errors
        customCommandSearch.on("search:error", function() {
            $("#status_message").text("An error occurred while updating configuration.")
        });
    });
});