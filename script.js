// AI News - Main Script

const UPDATE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const newsList = document.getElementById('newsList');
const lastUpdated = document.getElementById('lastUpdated');
const nextUpdate = document.getElementById('nextUpdate');
const newsCount = document.getElementById('newsCount');
const sourceCount = document.getElementById('sourceCount');
const sourceFilter = document.getElementById('sourceFilter');
const refreshBtn = document.getElementById('refreshBtn');

let allNews = [];
let allSources = new Set();

// News sources configuration - Using RSS feeds
const NEWS_SOURCES = [
    {
        id: 'hackernews',
        name: 'Hacker News',
        icon: '📰',
        api: 'https://hacker-news.firebaseio.com/v0/topstories.json',
        detailApi: 'https://hacker-news.firebaseio.com/v0/item/{id}.json',
        transform: async (data) => {
            const topStories = data.slice(0, 30);
            const news = [];
            for (const id of topStories) {
                try {
                    const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                    const item = await response.json();
                    if (item && item.url && (item.title.toLowerCase().includes('ai') || 
                        item.title.toLowerCase().includes('gpt') ||
                        item.title.toLowerCase().includes('llm') ||
                        item.title.toLowerCase().includes('neural') ||
                        item.title.toLowerCase().includes('model') ||
                        item.title.toLowerCase().includes('machine learning') ||
                        item.title.toLowerCase().includes('deep learning') ||
                        item.title.toLowerCase().includes('openai') ||
                        item.title.toLowerCase().includes('anthropic') ||
                        item.title.toLowerCase().includes('gemini'))) {
                        news.push({
                            title: item.title,
                            url: item.url,
                            source: 'hackernews',
                            time: item.time,
                            score: item.score,
                            description: `Score: ${item.score} | Comments: ${item.descendants || 0}`
                        });
                    }
                } catch (e) {}
            }
            return news;
        }
    },
    {
        id: 'techcrunch',
        name: 'TechCrunch',
        icon: '📰',
        url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
        transform: (xml) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const items = doc.querySelectorAll('item');
            const news = [];
            items.forEach(item => {
                const title = item.querySelector('title');
                const link = item.querySelector('link');
                const desc = item.querySelector('description');
                const pubDate = item.querySelector('pubDate');
                if (title && link) {
                    news.push({
                        title: title.textContent,
                        url: link.textContent,
                        source: 'news',
                        time: pubDate ? new Date(pubDate.textContent).getTime() / 1000 : Date.now() / 1000,
                        description: desc ? desc.textContent.replace(/<[^>]*>/g, '').substring(0, 200) : ''
                    });
                }
            });
            return news;
        }
    },
    {
        id: 'verge',
        name: 'The Verge',
        icon: '🔮',
        url: 'https://www.theverge.com/rss/artificial-intelligence/index.xml',
        transform: (xml) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const items = doc.querySelectorAll('item');
            const news = [];
            items.forEach(item => {
                const title = item.querySelector('title');
                const link = item.querySelector('link');
                const desc = item.querySelector('description');
                const pubDate = item.querySelector('pubDate');
                if (title && link) {
                    news.push({
                        title: title.textContent,
                        url: link.textContent,
                        source: 'news',
                        time: pubDate ? new Date(pubDate.textContent).getTime() / 1000 : Date.now() / 1000,
                        description: desc ? desc.textContent.replace(/<[^>]*>/g, '').substring(0, 200) : ''
                    });
                }
            });
            return news;
        }
    },
    {
        id: 'mit',
        name: 'MIT Tech Review',
        icon: '🔬',
        url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
        transform: (xml) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const items = doc.querySelectorAll('item');
            const news = [];
            items.forEach(item => {
                const title = item.querySelector('title');
                const link = item.querySelector('link');
                const desc = item.querySelector('description');
                const pubDate = item.querySelector('pubDate');
                if (title && link) {
                    news.push({
                        title: title.textContent,
                        url: link.textContent,
                        source: 'news',
                        time: pubDate ? new Date(pubDate.textContent).getTime() / 1000 : Date.now() / 1000,
                        description: desc ? desc.textContent.replace(/<[^>]*>/g, '').substring(0, 200) : ''
                    });
                }
            });
            return news;
        }
    }
];

// Override fetchSource to handle RSS
async function fetchSource(source) {
    try {
        if (source.api) {
            // Hacker News
            if (source.id === 'hackernews') {
                const response = await fetch(source.api);
                const data = await response.json();
                return await source.transform(data);
            }
        }
        
        // RSS feeds - use CORS proxy
        if (source.url) {
            const response = await fetch(CORS_PROXY + encodeURIComponent(source.url));
            if (!response.ok) throw new Error('Failed to fetch');
            const text = await response.text();
            return source.transform(text);
        }
    } catch (error) {
        console.error(`Error fetching ${source.name}:`, error);
        return [];
    }
}

// Fetch all news
async function fetchAllNews() {
    showLoading();
    allNews = [];
    allSources = new Set();
    
    try {
        // Fetch from multiple sources in parallel
        const promises = NEWS_SOURCES.map(source => fetchSource(source));
        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                allNews = allNews.concat(result.value);
                result.value.forEach(item => allSources.add(item.source));
            }
        });
        
        // Sort by time (newest first)
        allNews.sort((a, b) => b.time - a.time);
        
        // Remove duplicates
        allNews = allNews.filter((item, index, self) =>
            index === self.findIndex(t => t.title === item.title)
        );
        
        updateStats();
        filterAndRender();
        updateTimestamp();
        startAutoRefresh();
    } catch (error) {
        console.error('Error fetching news:', error);
        showError('获取资讯失败，请刷新重试');
    }
}

// Fetch from a single source
async function fetchSource(source) {
    try {
        if (source.api) {
            // Hacker News - uses Firebase API directly (CORS supported)
            if (source.id === 'hackernews') {
                const response = await fetch(source.api);
                const data = await response.json();
                return await source.transform(data);
            }
            // Reddit - uses JSON API
            else if (source.id === 'reddit') {
                const response = await fetch(source.api, {
                    headers: { 'User-Agent': 'AI-News-Bot/1.0' }
                });
                const data = await response.json();
                return source.transform(data);
            }
        }
        
        // Other sources - need CORS proxy
        if (source.url) {
            const response = await fetch(CORS_PROXY + encodeURIComponent(source.url));
            const html = await response.text();
            return source.transform(html);
        }
    } catch (error) {
        console.error(`Error fetching ${source.name}:`, error);
        return [];
    }
}

// Filter and render news
function filterAndRender() {
    const selectedSource = sourceFilter.value;
    
    let filtered = allNews;
    if (selectedSource) {
        filtered = allNews.filter(item => item.source === selectedSource);
    }
    
    renderNews(filtered);
}

// Render news cards
function renderNews(news) {
    if (news.length === 0) {
        newsList.innerHTML = '<div class="loading">没有找到相关资讯</div>';
        return;
    }
    
    newsList.innerHTML = news.map(item => `
        <div class="news-card">
            <div class="news-header">
                <span class="news-source source-${item.source}">
                    ${getSourceIcon(item.source)} ${getSourceName(item.source)}
                </span>
                <span class="news-time">${formatTime(item.time)}</span>
            </div>
            <h3 class="news-title">
                <a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
            </h3>
            ${item.description ? `<p class="news-description">${item.description}</p>` : ''}
            <div class="news-meta">
                ${item.score ? `<span>⭐ ${item.score} points</span>` : ''}
                <span class="news-tag">AI</span>
            </div>
        </div>
    `).join('');
}

// Helper functions
function getSourceIcon(source) {
    const icons = {
        twitter: '🐦',
        reddit: '🤖',
        news: '📰',
        hackernews: '🔧'
    };
    return icons[source] || '📌';
}

function getSourceName(source) {
    const names = {
        twitter: 'Twitter',
        reddit: 'Reddit',
        news: 'AI News',
        hackernews: 'Hacker News'
    };
    return names[source] || source;
}

function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 60 * 1000) {
        const mins = Math.floor(diff / (60 * 1000));
        return `${mins}分钟前`;
    } else if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours}小时前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

function showLoading() {
    newsList.innerHTML = '<div class="loading">加载中...</div>';
}

function showError(message) {
    newsList.innerHTML = `<div class="error">${message}</div>`;
}

function updateTimestamp() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleString('zh-CN');
}

function updateStats() {
    newsCount.textContent = allNews.length;
    sourceCount.textContent = allSources.size;
}

function startAutoRefresh() {
    // Update countdown
    let remaining = UPDATE_INTERVAL;
    const interval = setInterval(() => {
        remaining -= 1000;
        if (remaining <= 0) {
            remaining = UPDATE_INTERVAL;
            fetchAllNews();
        }
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        nextUpdate.textContent = `${hours}小时${mins}分后自动刷新`;
    }, 1000);
}

// Event listeners
refreshBtn.addEventListener('click', fetchAllNews);
sourceFilter.addEventListener('change', filterAndRender);

// Initial load
document.addEventListener('DOMContentLoaded', fetchAllNews);
