// Render a heatmap focused on Europe using Canvas

let selectedCountry = null;

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

const canvas = d3.select("body")
    .append("canvas")
    .attr("width", width_map
)
    .attr("height", height_map)
    .node();

const context = canvas.getContext("2d");

const projection = d3.geoMercator()
    .scale(800) // Adjust scale for Europe
    .center([15, 50]) // Center the map on Europe
    .translate([width_map
 / 2, height_map / 2]);

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

    // Find the minimum birth year (excluding 0)
    const minYear = d3.min(Array.from(artistData, d => {
        const birthdate = d["a.birthdate"];
        if (birthdate && /^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
            const year = parseInt(birthdate.split('-')[0], 10);
            return year > 0 ? year : null;
        }
        return null;
    }).filter(year => year !== null)) - 1;

    // Update slider minimum value
    const yearSlider = document.getElementById("year-slider");
    yearSlider.min = minYear || 0;

    const countryCodeMap = new Map(countries.map(f => [f.properties.ISO_A2.trim().toUpperCase(), f.properties.ADMIN]));

    let colorScale = null;

    function drawMap() {
        const selectedGender = document.querySelector("input[name=gender]:checked").value;
        const selectedYear = +yearSlider.value;
        const filterByYear = document.getElementById("filter-by-year").checked;

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

        const maxCount = d3.max(Array.from(artistCountsByCountry.values()));
        colorScale.domain([1, maxCount || 1]); // Ensure domain is valid

        context.clearRect(0, 0, width_map
, height_map);

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

// Example usage
d3.csv("data/artvis_dump_NEW.csv").then(data => {
    const uniqueExhibitionCountries = getUniqueExhibitionCountries(data);

    // Do something with the unique countries, like displaying in a dropdown or console logging
    console.log("Unique Countries:", uniqueExhibitionCountries);
});