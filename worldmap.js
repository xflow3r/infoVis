// Render a heatmap focused on Europe using Canvas

let selectedCountry = null;

//TODO not all countries are valid i think
const countryCodeMapping = {
    "United Kingdom": "GB",
    "Netherlands": "NL",
    "Russia": "RU",
    "Switzerland": "CH",
    "United States": "US",
    "France": "FR",
    "Italy": "IT",
    "Germany": "DE",
    "Czech Republic": "CZ",
    "Hungary": "HU",
    "Ukraine": "UA",
    "Romania": "RO",
    "Australia": "AU",
    "Belgium": "BE",
    "Belarus": "BY",
    "Austria": "AT",
    "Norway": "NO",
    "Sweden": "SE",
    "Unknown": "\\N", // For invalid or missing country values
    "Finland": "FI",
    "Spain": "ES",
    "Poland": "PL",
    "Bulgaria": "BG",
    "Georgia": "GE",
    "Mexico": "MX",
    "Armenia": "AM",
    "Israel": "IL",
    "Portugal": "PT",
    "Denmark": "DK",
    "Ireland": "IE",
    "Croatia": "HR",
    "Chile": "CL",
    "Slovakia": "SK",
    "Greece": "GR",
    "Lithuania": "LT",
    "Latvia": "LV",
    "Canada": "CA",
    "Dominican Republic": "DO",
    "Peru": "PE",
    "Japan": "JP",
    "Serbia": "RS",
    "Turkey": "TR",
    "Slovenia": "SI",
    "Estonia": "EE",
    "Argentina": "AR",
    "South Africa": "ZA",
    "Luxembourg": "LU",
    "New Zealand": "NZ",
    "Venezuela": "VE",
    "Guatemala": "GT",
    "Uruguay": "UY",
    "El Salvador": "SV",
    "Bosnia and Herzegovina": "BA",
    "India": "IN",
    "Montenegro": "ME"
};


const width_map = 960;
const height_map = 500;

const mapContainer = d3.select("#worldmap");

// Clear any existing content in the div

// Append the canvas to the mapContainer
const canvas = mapContainer.append("canvas")
    .attr("width", width_map)
    .attr("height", height_map)
    .node();

const context = canvas.getContext("2d");

const projection = d3.geoMercator()
    .scale(800) // Adjust scale for Europe
    .center([15, 50]) // Center the map on Europe
    .translate([width_map / 2, height_map / 2]);

const path = d3.geoPath().projection(projection).context(context);

// Load Europe-specific GeoJSON data and artist data
Promise.all([
    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson").then(res => res.json()),
    d3.csv("data/artvis_dump_NEW.csv")
]).then(([europeData, artistData]) => {
    console.log("Europe data loaded:", europeData);
    console.log("Artist data loaded:", artistData);

    const countries = europeData.features;

    // Normalize nationality codes and prepare artist data
    const artistCounts = d3.rollup(
        artistData,
        v => v.length, // Count artists for each country
        d => d["a.nationality"]?.trim()?.toUpperCase() || "", // Handle missing or invalid data
        d => d["a.gender"]?.trim()?.toUpperCase() || "UNKNOWN",
        d => {
            const birthdate = d["a.birthdate"];
            if (!birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return 0;
            return parseInt(birthdate.split('-')[0], 10); // Extract year from birthdate
        }
    );

    console.log("Artist counts by country and gender:", artistCounts);

    // Find the minimum birth year (excluding 0)
    const minYear = d3.min(Array.from(artistData, d => {
        const birthdate = d["a.birthdate"];
        if (birthdate && /^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
            const year = parseInt(birthdate.split('-')[0], 10);
            return year > 0 ? year : null;
        }
        return null;
    }).filter(year => year !== null)) - 1;

    console.log("Minimum birth year:", minYear);

    // Update slider minimum value
    const yearSlider = document.getElementById("year-slider");
    yearSlider.min = minYear || 0;

    const countryCodeMap = new Map(countries.map(f => [f.properties.ISO_A2.trim().toUpperCase(), f.properties.ADMIN]));

    let colorScale = null;

    function drawMap() {
        const selectedGender = document.querySelector("input[name=gender]:checked").value;
        const selectedYear = +yearSlider.value;
        const filterByYear = document.getElementById("filter-by-year").checked;

        console.log("Selected gender:", selectedGender);
        console.log("Selected year:", selectedYear);
        console.log("Filter by year:", filterByYear);

        // Show or hide the slider based on checkbox
        document.getElementById("year-filter").style.visibility = filterByYear ? "visible" : "hidden";

        // Define color scales based on selected gender
        if (selectedGender === "A") {
            colorScale = d3.scaleSequentialLog(d3.interpolateYlOrBr);
        } else if (selectedGender === "M") {
            colorScale = d3.scaleSequentialLog(d3.interpolateBlues);
        } else if (selectedGender === "F") {
            colorScale = d3.scaleSequentialLog(d3.interpolateReds);
        } else {
            colorScale = d3.scaleSequentialLog(d3.interpolateGreens);
        }

        const artistCountsByCountry = new Map();
        artistCounts.forEach((genderMap, code) => {
            const fullName = countryCodeMap.get(code);
            if (fullName) {
                let total = 0;

                if (selectedGender === "A") {
                    genderMap.forEach((yearMap) => {
                        yearMap.forEach((count, year) => {
                            if ((!filterByYear || (year !== 0 && year <= selectedYear))) {
                                total += count;
                            }
                        });
                    });
                } else {
                    const yearMap = genderMap.get(selectedGender.toUpperCase());
                    if (!yearMap) {
                        artistCountsByCountry.set(fullName, total); // Set total as 0 for missing gender
                        return;
                    }
                    yearMap.forEach((count, year) => {
                        if ((!filterByYear || (year !== 0 && year <= selectedYear))) {
                            total += count;
                        }
                    });
                }
                artistCountsByCountry.set(fullName, total);
            }
        });

        console.log("Artist counts by country:", artistCountsByCountry);

        const maxCount = d3.max(Array.from(artistCountsByCountry.values()));
        colorScale.domain([1, maxCount || 1]); // Ensure domain is valid

        context.clearRect(0, 0, width_map, height_map);

        countries.forEach(feature => {
            const countryName = feature.properties.ADMIN;
            const count = artistCountsByCountry.get(countryName) || 0;

            context.beginPath();
            path(feature);
            context.fillStyle = count > 0 ? colorScale(count) : "#ccc";
            context.fill();
            context.strokeStyle = "#000";
            context.stroke();

            feature.properties.artistCount = count;
        });
    }

    drawMap();

    // Attach event listeners to the HTML elements
    document.querySelectorAll("input[name=gender]").forEach(radio => {
        radio.addEventListener("change", drawMap);
    });

    yearSlider.addEventListener("input", function () {
        document.getElementById("year-value").textContent = this.value;
        drawMap();
    });

    document.getElementById("filter-by-year").addEventListener("change", drawMap);

    const tooltip = d3.select("body")
        .append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "5px")
        .style("visibility", "hidden");

    canvas.addEventListener("mousemove", event => {
        const [mx, my] = [event.offsetX, event.offsetY];

        const hoveredFeature = countries.find(feature => {
            context.beginPath();
            path(feature);
            return context.isPointInPath(mx, my);
        });

        if (hoveredFeature) {
            tooltip.style("visibility", "visible")
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`)
                .html(`${hoveredFeature.properties.ADMIN}: ${hoveredFeature.properties.artistCount} artists`);
        } else {
            tooltip.style("visibility", "hidden");
        }
    });

    canvas.addEventListener("click", event => {
        const [mx, my] = [event.offsetX, event.offsetY];

        // Find the country that was clicked
        const clickedFeature = countries.find(feature => {
            context.beginPath();
            path(feature);
            return context.isPointInPath(mx, my);
        });

        if (clickedFeature) {
            selectedCountry = clickedFeature.properties.ADMIN; // Save the selected country name
            console.log("Selected Country:", selectedCountry);

            // Optionally: Provide visual feedback for the selected country
            context.clearRect(0, 0, width_map, height_map);
            countries.forEach(feature => {
                context.beginPath();
                path(feature);
                if (feature === clickedFeature) {
                    context.fillStyle = "rgba(255, 0, 0, 0.5)"; // Highlight the clicked country
                } else {
                    context.fillStyle = feature.properties.artistCount > 0 ? colorScale(feature.properties.artistCount) : "#ccc";
                }
                context.fill();
                context.strokeStyle = "#000";
                context.stroke();
            });

            // Optional: Display the selected country's name
            tooltip.style("visibility", "visible")
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`)
                .html(`Selected: ${clickedFeature.properties.ADMIN}`);

            console.log(dataByCountry(selectedCountry));
            drawGenderDonutChart(selectedCountry);
            drawGenderLineChart(selectedCountry)
        } else {
            // Reset selection if clicked outside any country
            selectedCountry = null;
            console.log("No country selected");
            tooltip.style("visibility", "hidden");
        }
    });

}).catch(err => console.error("Error loading data:", err));

function mapCountryToCode(country) {
    return countryCodeMapping[country] || null; // Return null if no mapping found
}

function dataByCountry(country) {
    const countryCode = mapCountryToCode(country);
    console.log("countrycode:");
    console.log(countryCode);
    if (!countryCode) {
        console.warn(`No country code found for country: ${countryName}`);
        return [];
    }

    d3.csv("data/artvis_dump_NEW.csv").then(data => {

    const filteredData = data.filter(d => d["a.nationality"] === countryCode);

    console.log(`Filtered data for ${country} (${countryCode}):`, filteredData);
    getUniqueExhibitionCountries(filteredData);

    return filteredData;
    }).catch(error => {
        console.error("Error in Sankey update:", error);
    });
}

function getUniqueExhibitionCountries(data) {
    const uniqueCountries = new Set(); // Using a Set to automatically filter out duplicates

    data.forEach(d => {
        if (d["a.nationality"]) {
            uniqueCountries.add(d["a.nationality"].trim().toUpperCase()); // Ensure we handle any extra spaces and case sensitivity
        }
    });

    console.log("Unique Exhibition Countries:", Array.from(uniqueCountries)); // Convert Set to Array for display
    return Array.from(uniqueCountries); // Return as array
}



function drawGenderDonutChart(selectedCountry) {
    // Count male and female artists
    d3.select("#donut-chart").html("");
    d3.csv("data/artvis_dump_NEW.csv").then(data => {

        const countryData = data.filter(d => d["a.nationality"] === mapCountryToCode(selectedCountry));

        console.log("Chart Data:", countryData);

        // Initialize counts for male, female, other
        let maleCount = 0;
        let femaleCount = 0;
        let otherCount = 0;

        countryData.forEach(d => {
            const gender = d["a.gender"];
            if (gender === "M") {
                maleCount++;
            } else if (gender === "F") {
                femaleCount++;
            } else if (gender === "O") {
                otherCount++;
            }
        });

        const chartData = [
            { label: "Male", value: maleCount, color: "#1f77b4" },    // Adjust color as needed
            { label: "Female", value: femaleCount, color: "#ff7f0e" }  // Adjust color as needed
        ];

        const filteredChartData = chartData.filter(d => d.value > 0);

        console.log("Chart Data:", filteredChartData);

        // Set up dimensions for the donut chart
        const width = 400;
        const height = 400;
        const margin = 40;
        const radius = Math.min(width, height) / 2 - margin;


        console.log("Creating SVG...");
        // Create an SVG element for the donut chart
        const svg = d3.select("#donut-chart")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        // Set up the color scale
        const colorScale = d3.scaleOrdinal()
            .domain(chartData.map(d => d.label))
            .range(chartData.map(d => d.color));

        // Set up the arc generator
        const arc = d3.arc()
            .innerRadius(radius * 0.5)  // Create the "donut" by setting the inner radius
            .outerRadius(radius);

        // Set up the pie generator
        const pie = d3.pie()
            .value(d => d.value)
            .sort(null); // No sorting of data

        // Draw the donut slices
        svg.selectAll(".arc")
            .data(pie(chartData))
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc)
            .attr("fill", d => colorScale(d.data.label));

        // Add labels to the donut chart
        svg.selectAll(".label")
            .data(pie(chartData))
            .enter().append("text")
            .attr("transform", d => `translate(${arc.centroid(d)})`)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(d => `${d.data.label}: ${d.data.value}`)
            .style("font-size", "14px")
            .style("fill", "white");


    }).catch(error => {
        console.error("Error in Sankey update:", error);
    });

}

function drawGenderLineChart(selectedCountry) {
    // Clear the existing chart (if any)
    d3.select("#line-chart").html("");

    // Load the CSV data
    d3.csv("data/artvis_dump_NEW.csv").then(data => {

        // Filter the data by selected country
        const countryData = data.filter(d => d["a.nationality"] === mapCountryToCode(selectedCountry));

        // Prepare data: group by year and count male/female artists
        const genderByYear = {};

        countryData.forEach(d => {
            const year = d["a.birthdate"].split("-")[0];  // Extract year from birthdate

            if (+year > 1200) {
                const gender = d["a.gender"];

                if (!genderByYear[year]) {
                    genderByYear[year] = { male: 0, female: 0 };
                }

                // Increment counts based on gender
                if (gender === "M") {
                    genderByYear[year].male++;
                } else if (gender === "F") {
                    genderByYear[year].female++;
                }
            }
        });

        // Convert the grouped data into an array of objects suitable for plotting
        const years = Object.keys(genderByYear).map(year => ({
            year: +year,  // Convert year to number for proper sorting
            male: genderByYear[year].male,
            female: genderByYear[year].female
        }));

        // Sort the data by year
        years.sort((a, b) => a.year - b.year);

        // Set up chart dimensions and margins
        const margin = { top: 40, right: 40, bottom: 40, left: 60 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Set up scales
        const xScale = d3.scaleLinear()
            .domain([d3.min(years, d => d.year), d3.max(years, d => d.year)])  // X-axis scale: year
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(years, d => Math.max(d.male, d.female))])  // Y-axis scale: count
            .range([height, 0]);

        // Set up line generators
        const maleLine = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.male));

        const femaleLine = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.female));

        // Create the SVG container for the line chart
        const svg = d3.select("#line-chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Add the X axis
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        // Add the Y axis
        svg.append("g")
            .call(d3.axisLeft(yScale));

        // Add the male line
        svg.append("path")
            .data([years])
            .attr("class", "male-line")
            .attr("d", maleLine)
            .style("stroke", "blue")
            .style("stroke-width", 2)
            .style("fill", "none");

        // Add the female line
        svg.append("path")
            .data([years])
            .attr("class", "female-line")
            .attr("d", femaleLine)
            .style("stroke", "orange")
            .style("stroke-width", 2)
            .style("fill", "none");

        // Add labels to the lines
        svg.append("text")
            .attr("x", width - 10)
            .attr("y", yScale(years[years.length - 1].male))
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .style("fill", "blue")
            .text("Male Artists");

        svg.append("text")
            .attr("x", width - 10)
            .attr("y", yScale(years[years.length - 1].female))
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .style("fill", "orange")
            .text("Female Artists");

        // Add a title to the chart
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .text(`Gender Evolution of Artists in ${selectedCountry}`);

    }).catch(error => {
        console.error("Error loading data:", error);
    });
}

