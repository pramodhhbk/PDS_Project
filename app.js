let globalData = [];
let map;

// Initialize the application
async function initApp() {
    try {
        await loadData();
        setupFilters();
        createMap();
        updateVisualization();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Load and process the data
async function loadData() {
    const response = await fetch(CONFIG.dataUrl);
    const csvText = await response.text();
    globalData = parseCSV(csvText);
}

// Set up event listeners for filters
function setupFilters() {
    const regionSelect = document.getElementById('region-select');
    const countrySelect = document.getElementById('country-select');
    const attackTypeSelect = document.getElementById('attack-type-select');

    // Populate dropdowns
    const regions = [...new Set(globalData.map(d => d.region_txt))].sort();
    const attackTypes = [...new Set(globalData.map(d => d.attacktype1_txt))].sort();

    regions.forEach(region => {
        const option = new Option(region, region);
        regionSelect.add(option);
    });

    attackTypes.forEach(type => {
        const option = new Option(type, type);
        attackTypeSelect.add(option);
    });

    // Add event listeners
    regionSelect.addEventListener('change', updateCountryDropdown);
    regionSelect.addEventListener('change', updateVisualization);
    countrySelect.addEventListener('change', updateVisualization);
    attackTypeSelect.addEventListener('change', updateVisualization);
}

// Create the map
function createMap() {
    mapboxgl.accessToken = CONFIG.mapboxToken;
    map = new mapboxgl.Map({
        container: 'map-container',
        style: 'mapbox://styles/mapbox/dark-v10',
        center: [0, 0],
        zoom: 1
    });
}

// Update visualization based on filters
function updateVisualization() {
    const filteredData = filterData();
    updateMap(filteredData);
    updateStatistics(filteredData);
}

// Filter data based on selected values
function filterData() {
    const selectedRegions = Array.from(document.getElementById('region-select').selectedOptions).map(o => o.value);
    const selectedCountries = Array.from(document.getElementById('country-select').selectedOptions).map(o => o.value);
    const selectedAttackTypes = Array.from(document.getElementById('attack-type-select').selectedOptions).map(o => o.value);

    return globalData.filter(d => {
        const regionMatch = selectedRegions.length === 0 || selectedRegions.includes(d.region_txt);
        const countryMatch = selectedCountries.length === 0 || selectedCountries.includes(d.country_txt);
        const attackMatch = selectedAttackTypes.length === 0 || selectedAttackTypes.includes(d.attacktype1_txt);
        return regionMatch && countryMatch && attackMatch;
    });
}

// Update the map with filtered data
function updateMap(data) {
    // Remove existing layers
    if (map.getLayer('incidents')) {
        map.removeLayer('incidents');
    }
    if (map.getSource('incidents')) {
        map.removeSource('incidents');
    }

    // Add new data
    map.addSource('incidents', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: data.map(d => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [d.longitude, d.latitude]
                },
                properties: {
                    ...d
                }
            }))
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
    });

    // Add clusters
    map.addLayer({
        id: 'incidents',
        type: 'circle',
        source: 'incidents',
        paint: {
            'circle-color': [
                'case',
                ['has', 'point_count'],
                [
                    'step',
                    ['get', 'point_count'],
                    '#51bbd6',
                    100,
                    '#f1f075',
                    750,
                    '#f28cb1'
                ],
                '#f28cb1'
            ],
            'circle-radius': [
                'step',
                ['get', 'point_count'],
                20,
                100,
                30,
                750,
                40
            ]
        }
    });
}

// Update statistics
function updateStatistics(data) {
    document.getElementById('total-incidents').textContent = data.length.toLocaleString();
    document.getElementById('total-casualties').textContent = data.reduce((sum, d) => sum + (d.nkill || 0), 0).toLocaleString();
    
    const countryCounts = {};
    const attackCounts = {};
    
    data.forEach(d => {
        countryCounts[d.country_txt] = (countryCounts[d.country_txt] || 0) + 1;
        attackCounts[d.attacktype1_txt] = (attackCounts[d.attacktype1_txt] || 0) + 1;
    });

    const mostAffectedCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
    const mostCommonAttack = Object.entries(attackCounts).sort((a, b) => b[1] - a[1])[0];

    document.getElementById('most-affected-country').textContent = mostAffectedCountry ? mostAffectedCountry[0] : '-';
    document.getElementById('most-common-attack').textContent = mostCommonAttack ? mostCommonAttack[0] : '-';
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', initApp);