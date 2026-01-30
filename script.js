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

// News sources configuration
const NEWS_SOURCES = [
    {
        id: 'hackernews',
        name: 'Hacker News',
        icon: '📰',
        api: 'https://hacker-news.firebaseio.com/v0/topstories.json',
        detailApi: 'https://hacker-news.firebaseio.com/v0/item/{id}.json',
        transform: async (data) => {
            const topStories = data.slice(0, 20);
            const news = [];
            for (const id of topStories) {
                try {
                    const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                    const item = await response.json();
                    if (item && item.url && (item.title.toLowerCase().includes('ai') || 
                        item.title.toLowerCase().includes('gpt') ||
                        item.title.toLowerCase().includes('llm') ||
                        item.title.toLowerCase().includes('neural') ||
                        item.title.toLowerCase().includes('model'))) {
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
        id: 'reddit',
        name: 'Reddit',
        icon: '🤖',
        api: 'https://www.reddit.com/r/ArtificialIntelligence/hot.json?limit=20',
        transform: (data) => {
            const posts = data.data.children;
            return posts.map(post => ({
                title: post.data.title,
                url: `https://reddit.com${post.data.permalink}`,
                source: 'reddit',
                time: post.data.created_utc,
                score: post.data.score,
                description: post.data.selftext ? post.data.selftext.substring(0, 200) : ''
            }));
        }
    },
    {
        id: 'wired',
        name: 'Wired AI',
        icon: '⚡',
        url: 'https://www.wired.com/tag/artificial-intelligence/',
        transform: (html) => {
            // Parse Wired AI articles
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const articles = [];
            doc.querySelectorAll('div.summary-item').forEach(item => {
                const title = item.querySelector('h2 a, h3 a');
                const desc = item.querySelector('.summary-item__dek');
                const link = item.querySelector('a');
                if (title && link) {
                    articles.push({
                        title: title.textContent.trim(),
                        url: link.href,
                        source: 'news',
                        time: Date.now() / 1000,
                        description: desc ? desc.textContent.trim() : ''
                    });
                }
            });
            return articles;
        }
    },
    {
        id: 'mit',
        name: 'MIT AI',
        icon: '🔬',
        url: 'https://www.technologyreview.com/topic/artificial-intelligence',
        transform: (html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const articles = [];
            doc.querySelectorAll('article').forEach(item => {
                const title = item.querySelector('h2 a, h3 a');
                const desc = item.querySelector('p');
                const link = item.querySelector('a');
                if (title && link) {
                    articles.push({
                        title: title.textContent.trim(),
                        url: link.href,
                        source: 'news',
                        time: Date.now() / 1000,
                        description: desc ? desc.textContent.trim() : ''
                    });
                }
            });
            return articles;
        }
    }
];

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
