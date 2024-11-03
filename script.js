const proxyUrl = 'https://intel-opal.vercel.app/api/cors?url=';
let columns = JSON.parse(localStorage.getItem('dashboardColumns')) || {};

// Helper function to fetch OpenGraph image
async function fetchOpenGraphImage(articleUrl) {
    try {
        const response = await fetch(proxyUrl + encodeURIComponent(articleUrl));
        if (!response.ok) throw new Error("Failed to fetch article page for OpenGraph");

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");

        // Find the OpenGraph image tag
        const ogImage = doc.querySelector('meta[property="og:image"]');
        return ogImage ? ogImage.getAttribute("content") : null;
    } catch (error) {
        console.error("Error fetching OpenGraph image:", error);
        return null;
    }
}

// Function to load the default dashboard from `default.csv` if no saved data is in `localStorage`
async function loadDefaultDashboard() {
    // Only load the default CSV if columns are empty (first visit)
    if (Object.keys(columns).length > 0) return;

    try {
        const response = await fetch('default.csv');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const csvData = await response.text();
        const rows = csvData.trim().split('\n');

        rows.forEach((row, index) => {
            if (index === 0) return; // Skip the header row
            const [columnName, feedUrl] = row.split(',');

            if (columnName && feedUrl) {
                const cleanFeedUrl = feedUrl.trim();

                // Add column if it doesn't exist
                if (!columns[columnName]) {
                    columns[columnName] = [];
                    addColumnToDashboard(columnName, columns[columnName]);
                    addOptionToColumnSelect(columnName);
                }

                // Add feed to the column
                const fullFeedUrl = proxyUrl + cleanFeedUrl;
                columns[columnName].push(fullFeedUrl);
                populateColumn(columnName.toLowerCase().replace(/\s+/g, '-'), fullFeedUrl);
            }
        });

        // Save loaded columns to localStorage
        localStorage.setItem('dashboardColumns', JSON.stringify(columns));
    } catch (error) {
        console.error("Error loading default dashboard:", error);
    }
}

// Load the default dashboard if it's the first visit (no data in localStorage)
loadDefaultDashboard();

// Load saved columns and feeds on page load
for (const columnName in columns) {
    addColumnToDashboard(columnName, columns[columnName]);
    addOptionToColumnSelect(columnName);
}

// Function to fetch and parse an RSS feed
async function fetchFeed(url) {
    try {
        const response = await fetch(proxyUrl + encodeURIComponent(url));
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(data, "text/xml");
        return xml;
    } catch (error) {
        console.error("Error fetching feed:", error);
        return null;
    }
}

async function populateColumn(columnId, urls) {
    const feedContent = document.getElementById(columnId).querySelector('.feed-content');
    feedContent.innerHTML = ''; // Clear previous content before repopulating

    // Array to store all articles across feeds
    let articles = [];

    // Loop through each feed URL and fetch articles
    for (const url of urls) {
        const feedData = await fetchFeed(url);
        if (!feedData) continue;

        // Extract the original feed URL's domain as the channel title
        const originalUrl = url.replace(proxyUrl, ''); // Remove proxy prefix
        const parser = new URL(originalUrl);
        const channelTitle = parser.hostname.replace('www.', '');

        // Extract articles from the feed
        for (const item of feedData.querySelectorAll('item')) {
            const title = item.querySelector('title')?.textContent || 'No Title';
            const link = item.querySelector('link')?.textContent || '#';
            
            // Extract and clean up the description text
            let description = item.querySelector('description')?.textContent || 'No Description';
            description = description.replace(/<\/?[^>]+(>|$)/g, ""); // Remove HTML tags
            
            // Limit description to 400 characters
            if (description.length > 400) {
                description = description.substring(0, 400) + '...';
            }

            // Extract and format the publication date in UK format
            let pubDate = item.querySelector('pubDate');
            let formattedDate = "No date available";
            let pubDateObj = new Date(0); // Default to epoch if no date

            if (pubDate) {
                pubDateObj = new Date(pubDate.textContent);
                formattedDate = new Intl.DateTimeFormat('en-GB').format(pubDateObj);
            }

            // Thumbnail placeholder URL
            const placeholderImageUrl = 'https://via.placeholder.com/50';

            // Extract thumbnail image URL if available
            let imageUrl = null;
            const enclosure = item.querySelector('enclosure');
            const mediaContent = item.querySelector('media\\:content, content');
            
            if (enclosure && enclosure.getAttribute('type')?.startsWith('image')) {
                imageUrl = enclosure.getAttribute('url');
            } else if (mediaContent && mediaContent.getAttribute('url')) {
                imageUrl = mediaContent.getAttribute('url');
            }

            // If no image was found in the RSS, fetch OpenGraph image as a fallback
            if (!imageUrl) {
                imageUrl = await fetchOpenGraphImage(link) || placeholderImageUrl;
            }

            // Add article information to the array
            articles.push({
                channelTitle,
                title,
                link,
                description,
                formattedDate,
                imageUrl,
                pubDate: pubDateObj // Use date object for sorting
            });
        }
    }

    // Sort articles by date in descending order (latest first)
    articles.sort((a, b) => b.pubDate - a.pubDate);

    // Append articles to the feed content in sorted order
    articles.forEach(article => {
        // Create the article container
        const articleContainer = document.createElement('div');
        articleContainer.classList.add('article-container');

        // Display the domain/channel title
        const channelElement = document.createElement('div');
        channelElement.textContent = article.channelTitle;
        channelElement.classList.add('channel-title');
        articleContainer.appendChild(channelElement);

        // Add thumbnail or placeholder
        const img = document.createElement('img');
        img.src = article.imageUrl;
        img.alt = article.title;
        img.classList.add('thumbnail');
        articleContainer.appendChild(img);

        // Create the article link for the title
        const articleLink = document.createElement('a');
        articleLink.href = article.link;
        articleLink.target = '_blank';
        articleLink.textContent = article.title;
        articleLink.classList.add('article');
        articleContainer.appendChild(articleLink);

        // Add the description
        const descriptionElement = document.createElement('p');
        descriptionElement.textContent = article.description;
        descriptionElement.classList.add('description');
        articleContainer.appendChild(descriptionElement);

        // Add the publication date in UK format
        const dateElement = document.createElement('div');
        dateElement.textContent = article.formattedDate;
        dateElement.classList.add('article-date');
        articleContainer.appendChild(dateElement);

        // Append the article container to the column's feed content
        feedContent.appendChild(articleContainer);
    });
}

// Function to add a column to the dashboard display
function addColumnToDashboard(columnName, feedUrls) {
    const dashboard = document.getElementById('dashboard');
    const columnId = columnName.toLowerCase().replace(/\s+/g, '-');

    const column = document.createElement('div');
    column.classList.add('column');
    column.id = columnId;

    const header = document.createElement('h2');
    header.textContent = columnName;

    const feedContent = document.createElement('div');
    feedContent.classList.add('feed-content');

    column.appendChild(header);
    column.appendChild(feedContent);
    dashboard.appendChild(column);

    // Pass the entire array of URLs to populateColumn
    populateColumn(columnId, feedUrls);
}

// Function to add a new column option to the select dropdown
function addOptionToColumnSelect(columnName) {
    const columnSelect = document.getElementById('columnSelect');
    const option = document.createElement('option');
    option.value = columnName;
    option.textContent = columnName;
    columnSelect.appendChild(option);
}

// Event listener for the Add Column button
document.getElementById('addColumnBtn').addEventListener('click', () => {
    const columnName = document.getElementById('feedName').value.trim();
    if (columnName) {
        addNewColumn(columnName);
        document.getElementById('feedName').value = ''; // Clear the input field
    }
});

// Event listener for adding a feed to an existing column
document.getElementById('addFeedBtn').addEventListener('click', () => {
    const columnSelect = document.getElementById('columnSelect').value;
    const feedUrl = document.getElementById('feedUrl').value.trim();

    if (columnSelect && feedUrl) {
        const fullUrl = proxyUrl + feedUrl;
        columns[columnSelect].push(fullUrl);
        localStorage.setItem('dashboardColumns', JSON.stringify(columns));

        populateColumn(columnSelect.toLowerCase().replace(/\s+/g, '-'), fullUrl);
        updateFeedSelect(columnSelect);
        document.getElementById('feedUrl').value = ''; // Clear the feed URL field
    }
});

// Update the feed select dropdown for a specific column
function updateFeedSelect(columnName) {
    const feedSelect = document.getElementById('feedSelect');
    feedSelect.innerHTML = ''; // Clear previous options

    if (columns[columnName]) {
        columns[columnName].forEach(fullUrl => {
            const cleanUrl = fullUrl.startsWith(proxyUrl) ? fullUrl.replace(proxyUrl, '') : fullUrl;
            const option = document.createElement('option');
            option.value = fullUrl;
            option.textContent = cleanUrl;
            feedSelect.appendChild(option);
        });
    }
}

// Event listener for deleting an RSS feed from the selected column
document.getElementById('deleteFeedBtn').addEventListener('click', () => {
    const columnSelect = document.getElementById('columnSelect').value;
    const feedSelect = document.getElementById('feedSelect').value;

    if (columnSelect && feedSelect) {
        columns[columnSelect] = columns[columnSelect].filter(url => url !== feedSelect);
        localStorage.setItem('dashboardColumns', JSON.stringify(columns));

        const columnId = columnSelect.toLowerCase().replace(/\s+/g, '-');
        document.getElementById(columnId).querySelector('.feed-content').innerHTML = '';
        columns[columnSelect].forEach(url => populateColumn(columnId, url));

        updateFeedSelect(columnSelect);
    }
});

// Event listener for deleting a column
document.getElementById('deleteColumnBtn').addEventListener('click', () => {
    const columnSelect = document.getElementById('columnSelect').value;

    if (!columnSelect || !columns[columnSelect]) {
        alert("Please select a valid column to delete.");
        return;
    }

    delete columns[columnSelect];
    localStorage.setItem('dashboardColumns', JSON.stringify(columns));

    const columnId = columnSelect.toLowerCase().replace(/\s+/g, '-');
    const columnElement = document.getElementById(columnId);
    if (columnElement) {
        columnElement.remove();
    }

    const columnSelectDropdown = document.getElementById('columnSelect');
    columnSelectDropdown.querySelector(`option[value="${columnSelect}"]`).remove();

    document.getElementById('feedSelect').innerHTML = '';
    document.getElementById('columnSelect').value = '';
});

// Event listener for exporting the dashboard to CSV
document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = [['Column Name', 'RSS Feed URL']];

    for (const columnName in columns) {
        columns[columnName].forEach(feedUrl => {
            const cleanUrl = feedUrl.startsWith(proxyUrl) ? feedUrl.replace(proxyUrl, '') : feedUrl;
            rows.push([columnName, cleanUrl]);
        });
    }

    const csvContent = rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Event listener for resetting the entire dashboard
document.getElementById('resetBtn').addEventListener('click', () => {
    columns = {};
    localStorage.removeItem('dashboardColumns');
    document.getElementById('dashboard').innerHTML = '';
    document.getElementById('columnSelect').innerHTML = '<option value="">Select an existing column</option>';
    document.getElementById('feedSelect').innerHTML = '';
});

// Event listener for renaming a column
document.getElementById('renameColumnBtn').addEventListener('click', () => {
    const columnSelect = document.getElementById('columnSelect').value;
    const newColumnName = document.getElementById('renameColumnInput').value.trim();

    if (!columnSelect || !newColumnName) {
        alert("Please select a column and enter a new name.");
        return;
    }

    if (columns[newColumnName]) {
        alert("A column with this name already exists.");
        return;
    }

    columns[newColumnName] = columns[columnSelect];
    delete columns[columnSelect];

    const columnDiv = document.getElementById(columnSelect.toLowerCase().replace(/\s+/g, '-'));
    columnDiv.id = newColumnName.toLowerCase().replace(/\s+/g, '-');
    columnDiv.querySelector('h2').textContent = newColumnName;

    const columnSelectDropdown = document.getElementById('columnSelect');
    const option = columnSelectDropdown.querySelector(`option[value="${columnSelect}"]`);
    option.value = newColumnName;
    option.textContent = newColumnName;
    columnSelectDropdown.value = newColumnName;

    localStorage.setItem('dashboardColumns', JSON.stringify(columns));
    document.getElementById('renameColumnInput').value = '';
});

// Event listener for importing the dashboard from CSV
document.getElementById('importFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const csvData = e.target.result;
        const rows = csvData.trim().split('\n');

        columns = {};
        document.getElementById('dashboard').innerHTML = '';
        document.getElementById('columnSelect').innerHTML = '<option value="">Select an existing column</option>';

        rows.forEach((row, index) => {
            if (index === 0) return;
            const [columnName, feedUrl] = row.split(',');

            if (columnName && feedUrl) {
                const cleanFeedUrl = feedUrl.trim();

                if (!columns[columnName]) {
                    columns[columnName] = [];
                    addColumnToDashboard(columnName, columns[columnName]);
                    addOptionToColumnSelect(columnName);
                }

                const fullFeedUrl = proxyUrl + cleanFeedUrl;
                columns[columnName].push(fullFeedUrl);
                populateColumn(columnName.toLowerCase().replace(/\s+/g, '-'), fullFeedUrl);
            }
        });

        localStorage.setItem('dashboardColumns', JSON.stringify(columns));
        event.target.value = '';
    };
    reader.readAsText(file);
});
