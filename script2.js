// Render a heatmap map focused on Europe using Canvas

const width = 960;
const height = 500;

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

    // Aggregate artist data by 2-letter nationality codes
    const artistCounts = d3.rollup(
        artistData,
        v => v.length, // Count artists for each country
        d => d["a.nationality"]
    );

    console.log("Artist counts by 2-letter code:", artistCounts);

    // Map from 2-letter codes to full country names
    const countryCodeMap = new Map(countries.map(f => [f.properties.ISO_A2, f.properties.ADMIN]));

    // Map artist counts to full country names
    const artistCountsByCountry = new Map();
    artistCounts.forEach((count, code) => {
        const fullName = countryCodeMap.get(code);
        if (fullName) {
            artistCountsByCountry.set(fullName, count);
        }
    });

    console.log("Mapped artist counts by full country name:", artistCountsByCountry);

    // Find min and max artist counts for color scaling
    const maxCount = d3.max(Array.from(artistCountsByCountry.values()));

    // Define a color scale
    const colorScale = d3.scaleSequentialLog(d3.interpolateReds)
        .domain([1, maxCount]);

    // Draw the map
    countries.forEach(feature => {
        const countryName = feature.properties.ADMIN; // Match the country name property
        const count = artistCountsByCountry.get(countryName) || 0;

        context.beginPath();
        path(feature);
        context.fillStyle = count > 0 ? colorScale(count) : "#ccc"; // Use heatmap or default color
        context.fill();
        context.strokeStyle = "#000"; // Border for countries
        context.stroke();

        // Add tooltip functionality
        feature.properties.artistCount = count; // Attach count to feature for later use
    });

    // Tooltip setup
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
