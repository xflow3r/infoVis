// Render a heatmap map focused on Europe using Canvas

const width = 960;
const height = 500;

// Add radio buttons for gender filtering
d3.select("body")
    .append("div")
    .attr("id", "filters")
    .html(`
        <label><input type="radio" name="gender" value="all" checked> All</label>
        <label><input type="radio" name="gender" value="male"> Male</label>
        <label><input type="radio" name="gender" value="female"> Female</label>
        <label><input type="radio" name="gender" value="other"> Other</label>
    `);

// Add checkbox for year filtering
d3.select("body")
    .append("div")
    .attr("id", "year-filter-checkbox")
    .html(`
        <label><input type="checkbox" id="filter-by-year"> Filter by Year</label>
    `);

// Add slider for year filtering
d3.select("body")
    .append("div")
    .attr("id", "year-filter")
    .style("visibility", "hidden") // Initially hidden
    .html(`
        <label for="year-slider">Year:</label>
        <input type="range" id="year-slider" min="0" max="2023" step="1" value="2023">
        <span id="year-value">2023</span>
    `);

const canvas = d3.select("body")
    .append("canvas")
    .attr("width", width)
    .attr("height", height)
    .node();

const context = canvas.getContext("2d");

const projection = d3.geoMercator()
    .scale(800) // Adjust scale for Europe
    .center([15, 50]) // Center the map on Europe
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection).context(context);

// Load Europe-specific GeoJSON data and artist data
Promise.all([
    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson").then(res => res.json()),
    d3.csv("data/artvis_dump_NEW.csv")
]).then(([europeData, artistData]) => {
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
    console.log("Aggregated Artist Data:", artistCounts);

    // Find the minimum birth year (excluding 0)
    const minYear = d3.min(Array.from(artistData, d => {
        const birthdate = d["a.birthdate"];
        if (birthdate && /^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
            const year = parseInt(birthdate.split('-')[0], 10);
            return year > 0 ? year : null;
        }
        return null;
    }).filter(year => year !== null)) - 1;

    console.log("Minimum Year:", minYear);

    // Update slider minimum value
    d3.select("#year-slider").attr("min", minYear || 0);

    const countryCodeMap = new Map(countries.map(f => [f.properties.ISO_A2.trim().toUpperCase(), f.properties.ADMIN]));

    function drawMap() {
        const selectedGender = d3.select("input[name=gender]:checked").property("value");
        const selectedYear = +d3.select("#year-slider").property("value");
        const filterByYear = d3.select("#filter-by-year").property("checked");

        // Show or hide the slider based on checkbox
        d3.select("#year-filter").style("visibility", filterByYear ? "visible" : "hidden");

        // Define color scales based on selected gender
        let colorScale;
        if (selectedGender === "all") {
            colorScale = d3.scaleSequentialLog(d3.interpolateYlOrBr);
        } else if (selectedGender === "male") {
            colorScale = d3.scaleSequentialLog(d3.interpolateBlues);
        } else if (selectedGender === "female") {
            colorScale = d3.scaleSequentialLog(d3.interpolateReds);
        } else {
            colorScale = d3.scaleSequentialLog(d3.interpolateGreens);
        }

        const artistCountsByCountry = new Map();
        artistCounts.forEach((genderMap, code) => {
            const fullName = countryCodeMap.get(code);
            if (fullName) {
                let total = 0;
                if (selectedGender === "all") {
                    genderMap.forEach((yearMap) => {
                        yearMap.forEach((count, year) => {
                            if ((!filterByYear || (year !== 0 && year <= selectedYear))) {
                                total += count;
                            }
                        });
                    });
                } else {
                    const yearMap = genderMap.get(selectedGender.toUpperCase());
                    if (yearMap) {
                        yearMap.forEach((count, year) => {
                            if ((!filterByYear || (year !== 0 && year <= selectedYear))) {
                                total += count;
                            }
                        });
                    }
                }
                artistCountsByCountry.set(fullName, total);
            }
        });

        const maxCount = d3.max(Array.from(artistCountsByCountry.values()));
        colorScale.domain([1, maxCount || 1]); // Ensure domain is valid

        context.clearRect(0, 0, width, height);

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

    d3.selectAll("#filters input[type=radio]").on("change", drawMap);
    d3.select("#year-slider").on("input", function () {
        d3.select("#year-value").text(this.value);
        drawMap();
    });
    d3.select("#filter-by-year").on("change", drawMap);

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

}).catch(err => console.error("Error loading data:", err));
