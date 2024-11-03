const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
const columns = [
    { id: 'telecoms', url: proxyUrl + 'https://www.theguardian.com/technology/telecoms/rss' },
    { id: 'broadcasting', url: proxyUrl + 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' }
];

async function fetchFeed(url) {
    try {
        console.log(`Fetching data from ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(data, "text/xml");
        return xml;
    } catch (error) {
        console.error("Error fetching feed:", error);
        return null; // Return null if there's an error to prevent further processing
    }
}

async function populateColumn(columnId, url) {
    const feedContent = document.getElementById(columnId).querySelector('.feed-content');
    const feedData = await fetchFeed(url);
    if (!feedData) return; // Stop if fetchFeed encountered an error

    feedData.querySelectorAll('item').forEach((item) => {
        const title = item.querySelector('title').textContent;
        const link = item.querySelector('link').textContent;

        // Attempt to find an image
        let imageUrl = null;
        const enclosure = item.querySelector('enclosure');
        const mediaContent = item.querySelector('media\\:content, content');

        if (enclosure && enclosure.getAttribute('type').startsWith('image')) {
            imageUrl = enclosure.getAttribute('url');
        } else if (mediaContent && mediaContent.getAttribute('url')) {
            imageUrl = mediaContent.getAttribute('url');
        }

        // Create elements for the article
        const articleContainer = document.createElement('div');
        articleContainer.classList.add('article-container');

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = title;
            img.classList.add('thumbnail');
            articleContainer.appendChild(img);
        }

        const article = document.createElement('a');
        article.href = link;
        article.target = '_blank';
        article.textContent = title;
        article.classList.add('article');
        
        articleContainer.appendChild(article);
        feedContent.appendChild(articleContainer);
    });
}

columns.forEach(column => populateColumn(column.id, column.url));