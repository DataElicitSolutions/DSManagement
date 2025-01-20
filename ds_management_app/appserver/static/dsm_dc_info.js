$(document).ready(function () {
    let currentPage = 1;
    const rowsPerPage = 20;
    let allRows = []; // Variable to store fetched results
    let sortDirection = {}; // Store the sorting direction for each column
    
    $("#prev-page, #prev-page-top").prop("disabled");
    $("#next-page, #next-page-top").prop("disabled");

    function fetchData(filters = {}) {
        const searchQuery = `
| inputlookup dc_phonehome_time.csv
            | appendpipe [|  inputlookup dc_info.csv | stats latest(servername) as servername latest(clientname) as clientname by guid ip]
            | appendpipe [|  inputlookup dc_app_status.csv | stats latest(installed_apps) as installed_apps latest(failed_apps) as failed_apps by guid ip ]
            | appendpipe [|  inputlookup dc_serverclass_mapping.csv | stats latest(serverclass_list) as serverclass_list  by guid ip ]
            | stats latest(*) as * latest(_time) as _time by guid ip
            | search _time=*
            | rename _time as last_phonehome_time 
            | eval  duration = tostring(now()-last_phonehome_time, "duration")
            | eval days = if(match(duration, "\\+"), mvindex(split(duration, "+"), 0) . " days ago", null()), 
                  time_parts = if(match(duration, "\\+"), mvindex(split(duration, "\\+"), 1), duration)
            | eval hours = if(isnull(days) and match(time_parts, ":"), mvindex(split(time_parts, ":"), 0) . " hours ago", null()), 
                minutes = if(hours=="00 hours ago"  and isnull(days) and match(time_parts, ":"), mvindex(split(time_parts, ":"), 1) . " minutes ago", null()), 
                seconds = if(minutes=="00 minutes ago" and ihours=="00 hours ago" and isnull(days), mvindex(split(time_parts, ":"), 2) . " seconds ago", null())
            |  eval minutes=if(minutes=="00 minutes ago",null(),minutes) , hours=if(hours=="00 hours ago",null(),hours) 
            | eval last_phonehome = coalesce(days, hours, minutes, seconds)
            | eval last_phonehome=if(match(last_phonehome, "^0"), ltrim(last_phonehome, "0"), last_phonehome)
            | table hostname servername clientname ip os serverclass_list installed_apps failed_apps  last_phonehome last_phonehome_time
        `;

        // Apply filters
        let filterString = "| search ";
        if (filters.hostname) filterString += ` hostname=${filters.hostname}`;
        if (filters.servername) filterString += ` servername=${filters.servername}`;
        if (filters.clientname) filterString += ` clientname=${filters.clientname}`;
        if (filters.ip) filterString += ` ip=${filters.ip}`;
        if (filters.os) filterString += ` os=${filters.os}`;
        if (filterString == "| search "){
            filterString=""
        }
        const finalSearch = searchQuery + filterString;
        console.log(finalSearch)
        // Fetch data using Splunk's REST API
        require(["splunkjs/mvc/searchmanager"], function (SearchManager) {
            const searchManager = new SearchManager({

                search: finalSearch,
                earliest_time: "-24h@h",
                latest_time: "now"
            });

            const tbody = $("#data-table tbody");
            tbody.empty(); // Clear old data

            searchManager.startSearch();

            tbody.append('<tr><td colspan="9">No results found</td></tr>');
            $("#pagination-info, #pagination-info-top").text("No pages available");
            $("#prev-page, #prev-page-top").prop("disabled", true);
            $("#next-page, #next-page-top").prop("disabled", true);

            searchManager.on("search:done", function () {
                const results = searchManager.data("results", { count: 0 });
                results.on("data", function () {
                    allRows = results.data()?.rows || [];

                    // Call paginate function to handle displaying data
                    paginateData();

                }); 

            });

        });
    }

    // Function to handle sorting
    function sortData(column, direction) {
        console.log("Column name passed to sortData:", column); // Debug column name

        const columns = ["hostname", "servername", "clientname", "ip", "os", "serverclass", "installed_apps", "failed_apps", "last_phonehome","last_phonehome_epoc"];
        const index = columns.indexOf(column);

        if (index === -1) {
            console.error("Invalid column specified:", column);
            return;
        }

        // Perform sorting
        allRows.sort((a, b) => {
            let valA = a[index];
            let valB = b[index];

            // Handle numeric and string sorting
            if (!isNaN(valA) && !isNaN(valB)) {
                valA = Number(valA);
                valB = Number(valB);
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (direction === "asc") {
                return valA > valB ? 1 : valA < valB ? -1 : 0;
            } else {
                return valA < valB ? 1 : valA > valB ? -1 : 0;
            }
        });

        // Update sort direction for the column
        sortDirection[column] = direction;

        // Update the table after sorting
        paginateData();
    }


    function paginateData() {
        const totalRows = allRows.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage);

        // Slice data for the current page
        const paginatedRows = allRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

        const tbody = $("#data-table tbody");
        tbody.empty(); // Clear old data

        // Populate table with paginated rows
        paginatedRows.forEach(row => {
            // Check if the value contains a comma
            [5, 6, 7].forEach(index => {
                if (row[index] && row[index].includes(',')) {
                    row[index] = row[index].split(',').join('<br>');
                }
            });
            const rowHtml = `
                <tr>
                    <td>${row[0] || "-"}</td>
                    <td>${row[1] || "-"}</td>
                    <td>${row[2] || "-"}</td>
                    <td>${row[3] || "-"}</td>
                    <td>${row[4] || "-"}</td>
                    <td>${row[5] || "-"}</td>
                    <td>${row[6] || "-"}</td>
                    <td>${row[7] || "-"}</td>
                    <td>${row[8] || "-"}</td>
                    <td class="hideColumn">${row[9] || "-"}</td>
                    
                </tr>
            `;
            tbody.append(rowHtml);
        });

        // Update pagination info
        const paginationText = `Page ${currentPage} of ${totalPages}`;
        $("#pagination-info, #pagination-info-top").text(paginationText);

        // Enable/disable navigation buttons
        $("#prev-page, #prev-page-top").prop("disabled", currentPage === 1);
        $("#next-page, #next-page-top").prop("disabled", currentPage === totalPages);
    }

    // Initial load
    fetchData();

    // Search button click event
    $("#search-button").click(function () {
        currentPage = 1; // Reset to first page
        const filters = {
            hostname: $("#hostname").val(),
            servername: $("#servername").val(),
            clientname: $("#clientname").val(),
            ip: $("#ip").val(),
            os: $("#os").val()
        };
        fetchData(filters);
    });

    // Pagination button click events
    $("#prev-page, #prev-page-top").click(function () {
        if (currentPage > 1) {
            currentPage--;
            paginateData();
        }
    });

    $("#next-page, #next-page-top").click(function () {
        currentPage++;
        paginateData();
    });

    // Header click to sort
    $("#data-table thead th").click(function () {
        let column = $(this).data("column");
        let direction = "asc";

        if (column === "last_phonehome") {
            column = "last_phonehome_epoc";
        }

        // Check and toggle direction
        if (sortDirection[column] === "asc") {
            direction = "desc";
        }
        
        // Reset all icons to down arrow
        $("#data-table thead th span").text("↓");

        // Update the icon for the sorted column
        $(this).find(".sort-icon").text(direction === "asc" ? "↑" : "↓");

        // Sort the data
        sortData(column, direction);
    });
});

