console.log(d3.version);


let selectedCountries = [];
// Set up the SVG canvas dimensions
const width = 900, height = 600;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// Create a Sankey generator
const sankey = d3.sankey()
    .nodeWidth(20)
    .nodePadding(10)
    .extent([[1, 1], [width - 1, height - 6]]);

// Function to populate the country dropdown
function populateCountryDropdown() {
    d3.csv("data/artvis_dump_NEW.csv").then(data => {
        // Extract unique countries from the dataset
        const countries = [...new Set(data.map(d => d["a.nationality"]))];

        const dropdown = d3.select("#country-dropdown");
        countries.forEach(country => {
            dropdown.append("option")
                .attr("value", country)
                .text(country);
        });
    }).catch(error => {
        console.error("Error loading data:", error);
    });
}

// Function to update the selected countries list and Sankey diagram
// Function to update the selected countries list and Sankey diagram
function updateSelectedCountries() {
    // Get the currently selected countries
    console.log(selectedCountries);
    const dropdown = document.getElementById("country-dropdown");
    const currentlySelectedCountries = Array.from(dropdown.selectedOptions)
        .map(option => option.value);

    currentlySelectedCountries.forEach(country => {
        if (!selectedCountries.includes(country)) {
            selectedCountries.push(country);
        }
    });

    // Update the selected countries list in the UI
    const selectedList = d3.select("#selected-countries");
    selectedList.selectAll("li").remove(); // Clear current list

    selectedCountries.forEach(country => {
        const li = selectedList.append("li").text(country);
        li.append("button")
            .text("Remove")
            .on("click", function () {
                // Remove the country from the selectedCountries array
                selectedCountries = selectedCountries.filter(c => c !== country);

                // Update the dropdown selection to reflect the removal
                const dropdownOption = Array.from(dropdown.options).find(option => option.value === country);
                if (dropdownOption) dropdownOption.selected = false;

                // Update the UI and Sankey diagram
                updateSelectedCountries();
                updateSankeyDiagram(selectedCountries);
            });
    });
    console.log(selectedCountries);
    // Update the Sankey diagram
    updateSankeyDiagram(selectedCountries);
}

// Update the event listener for country dropdown to properly handle multiple selections
document.getElementById("country-dropdown").addEventListener("change", function () {
    updateSelectedCountries();
});


function getSelectedCountries() {
    return Array.from(document.querySelectorAll("#selected-countries li"))
        .map(item => item.textContent);
}


// Function to update the Sankey diagram based on selected countries
// Function to update the Sankey diagram based on selected countries
function updateSankeyDiagram(selectedCountries) {
    // Load the data
    d3.csv("data/artvis_dump_NEW.csv").then(data => {
        console.time("Processing Data");

        // Filter the data based on selected countries
        const filteredData = data.filter(d => selectedCountries.includes(d["a.nationality"]));


        // Create a new aggregation based on Gender → Nationality → Exhibition Type
        const aggregatedLinks = d3.rollups(
            filteredData,
            v => d3.sum(v, d => +d["e.paintings"]), // Sum of paintings for each combination
            d => d["a.gender"],                    // Group by gender
            d => d["a.nationality"],               // Group by nationality
            d => d["e.type"]                       // Group by exhibition type
        );

        const nodes = [];
        const nodeMap = new Map();
        const links = [];

        aggregatedLinks.forEach(([gender, nationalityGroup]) => {
            // Add node for gender (if not already present)
            if (!nodeMap.has(gender)) {
                nodeMap.set(gender, { name: gender });
                nodes.push(nodeMap.get(gender));
            }

            nationalityGroup.forEach(([nationality, exhibitionTypes]) => {
                // Add node for nationality (if not already present)
                if (!nodeMap.has(nationality)) {
                    nodeMap.set(nationality, { name: nationality });
                    nodes.push(nodeMap.get(nationality));
                }

                exhibitionTypes.forEach(([exhibitionType, paintings]) => {
                    // Add node for exhibition type (if not already present)
                    if (!nodeMap.has(exhibitionType)) {
                        nodeMap.set(exhibitionType, { name: exhibitionType });
                        nodes.push(nodeMap.get(exhibitionType));
                    }

                    // Create a link from gender → nationality → exhibition type
                    const genderNode = nodeMap.get(gender);
                    const nationalityNode = nodeMap.get(nationality);
                    const exhibitionTypeNode = nodeMap.get(exhibitionType);

                    // Ensure all nodes exist before creating links
                    if (genderNode && nationalityNode && exhibitionTypeNode) {
                        links.push({
                            source: genderNode,
                            target: nationalityNode,
                            value: paintings
                        });

                        links.push({
                            source: nationalityNode,
                            target: exhibitionTypeNode,
                            value: paintings
                        });
                    } else {
                        console.warn('Invalid nodes:', { genderNode, nationalityNode, exhibitionTypeNode });
                    }
                });
            });
        });

        // Log nodes and links for debugging
        console.log('Nodes:', nodes);
        console.log('Links:', links);

        console.timeEnd("Processing Data");

        // If no links were generated, stop further processing
        if (links.length === 0) {
            console.warn("No links generated, possibly due to missing data.");
            return;
        }

        const graph = { nodes, links };

        // Clear previous SVG content
        svg.selectAll("*").remove();

        // Generate the Sankey diagram
        sankey(graph);

        svg.append("g")
            .selectAll("path")
            .data(graph.links)
            .join("path")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("fill", "none")
            .attr("stroke", "#aaa")
            .attr("stroke-width", d => Math.max(1, d.width))
            .attr("opacity", 0.8);

        const node = svg.append("g")
            .selectAll("g")
            .data(graph.nodes)
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        node.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0)
            .attr("fill", "#4682b4");

        node.append("text")
            .attr("x", d => d.x0 < width / 2 ? d.x1 - d.x0 + 6 : -6)
            .attr("y", (d => (d.y1 - d.y0) / 2))
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .text(d => d.name);
    }).catch(error => {
        console.error("Error in Sankey update:", error);
    });
}

// Initialize the page
populateCountryDropdown();
// Add event listener for changes in country selection


/*
d3.csv("data/artvis_dump_NEW.csv").then(function(data) {
    // Log the entire dataset to the console
    console.log("Loaded Data:", data);

    // Check if data is available
    if (data.length > 0) {
        // Take the first row of the data and display it in the output div
        const firstRow = data[0]; // Get the first row from the CSV data
        const outputDiv = d3.select("#output"); // Select the output div
        outputDiv.append("p").text(JSON.stringify(firstRow)); // Display it as JSON
    } else {
        // Display a message if no data is found
        d3.select("#output").append("p").text("No data found in the CSV file.");
    }
}).catch(function(error) {
    // If there's an error loading the CSV, log it to the console
    console.error("Error loading the CSV file:", error);
    d3.select("#output").append("p").text("Error loading the CSV file.");
});





*/