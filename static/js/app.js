/**
 * BIGQUERY RELEASE PULSE - FRONTEND APPLICATION SCRIPT
 * Handles rendering, feed fetching, state management, search, filtering, and Twitter intents.
 */

// Application State
let appState = {
    releases: [],          // Raw release entries from server
    filteredData: [],      // Releases matching search & filter criteria
    searchQuery: '',       // Active search term
    activeFilter: 'All',   // Active category chip
    selectedItem: null     // Currently selected item for Twitter dialog
};

// DOM Cache
const dom = {
    refreshBtn: document.getElementById('refresh-btn'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    lastUpdatedText: document.getElementById('last-updated-text'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    filterChips: document.getElementById('filter-chips'),
    releasesFeed: document.getElementById('releases-feed'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    retryBtn: document.getElementById('retry-btn'),
    toastContainer: document.getElementById('toast-container'),
    
    // Modal DOM
    tweetModal: document.getElementById('tweet-modal'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    previewBadge: document.getElementById('preview-item-badge'),
    previewDate: document.getElementById('preview-item-date'),
    previewText: document.getElementById('preview-item-text'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
    publishTweetBtn: document.getElementById('publish-tweet-btn')
};

// Character limits for Twitter
const TWITTER_CHAR_LIMIT = 280;
const TWITTER_URL_LENGTH = 23; // Twitter counts all URLs as 23 characters using t.co

// ==========================================================================
// TOAST NOTIFICATION ENGINE
// ==========================================================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'info') iconClass = 'fa-circle-info';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;
    
    dom.toastContainer.appendChild(toast);
    
    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (toast.parentNode === dom.toastContainer) {
                dom.toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3500);
}

// ==========================================================================
// API CLIENT
// ==========================================================================
async function fetchReleases(force = false) {
    setLoadingState(true);
    
    try {
        const url = `/api/releases${force ? '?force=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const payload = await response.json();
        
        if (!payload.success) {
            throw new Error(payload.error || 'Failed to fetch release notes.');
        }
        
        appState.releases = payload.data;
        updateLastUpdatedText(payload.last_updated, payload.source);
        
        if (payload.warning) {
            showToast(payload.warning, 'error');
        } else if (force) {
            showToast('Feed refreshed successfully!', 'success');
        }
        
        dom.errorState.style.display = 'none';
        applyFiltersAndRender();
        
    } catch (error) {
        console.error('Error loading release notes:', error);
        dom.errorMessage.textContent = `Could not load release notes: ${error.message}`;
        dom.errorState.style.display = 'flex';
        dom.releasesFeed.innerHTML = '';
        dom.emptyState.style.display = 'none';
        showToast('Failed to fetch latest notes.', 'error');
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    if (isLoading) {
        dom.refreshBtn.classList.add('loading');
        dom.refreshBtn.disabled = true;
        
        // Show skeleton animation in feed
        dom.releasesFeed.innerHTML = `
            <div class="skeleton-timeline">
                ${Array(3).fill().map(() => `
                    <div class="skeleton-day">
                        <div class="skeleton-date"></div>
                        <div class="skeleton-cards">
                            <div class="skeleton-card"></div>
                            <div class="skeleton-card"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        dom.emptyState.style.display = 'none';
        dom.errorState.style.display = 'none';
    } else {
        dom.refreshBtn.classList.remove('loading');
        dom.refreshBtn.disabled = false;
    }
}

function updateLastUpdatedText(timestamp, source) {
    const date = new Date(timestamp * 1000);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sourceLabel = source === 'cache' ? 'cached' : 'live';
    dom.lastUpdatedText.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Updated ${timeString} (${sourceLabel})`;
}

// ==========================================================================
// SEARCH & FILTER ENGINE
// ==========================================================================
function applyFiltersAndRender() {
    const query = appState.searchQuery.toLowerCase().trim();
    const filter = appState.activeFilter;
    
    appState.filteredData = appState.releases.map(entry => {
        // Filter the items inside this day entry
        const matchingItems = entry.items.filter(item => {
            const matchesCategory = (filter === 'All' || item.type.toLowerCase() === filter.toLowerCase());
            const matchesSearch = !query || 
                item.type.toLowerCase().includes(query) || 
                item.text_content.toLowerCase().includes(query) ||
                entry.date.toLowerCase().includes(query);
                
            return matchesCategory && matchesSearch;
        });
        
        // Return a copy of the entry with only matching items
        return {
            ...entry,
            items: matchingItems
        };
    }).filter(entry => entry.items.length > 0); // Keep day entry only if it has matching items
    
    renderFeed();
}

// ==========================================================================
// RENDER ENGINE
// ==========================================================================
function renderFeed() {
    dom.releasesFeed.innerHTML = '';
    
    if (appState.filteredData.length === 0) {
        dom.emptyState.style.display = 'flex';
        return;
    }
    
    dom.emptyState.style.display = 'none';
    
    appState.filteredData.forEach((day, index) => {
        const dayBlock = document.createElement('div');
        dayBlock.className = 'day-block';
        dayBlock.style.animationDelay = `${index * 0.05}s`;
        
        // Day sidebar with sticky date info
        const dateSubtext = day.updated ? new Date(day.updated).toLocaleDateString([], { weekday: 'long', year: 'numeric' }) : '';
        
        dayBlock.innerHTML = `
            <div class="day-sidebar">
                <div class="sticky-date">
                    <h2 class="date-heading">${day.date}</h2>
                    <span class="date-subtext">${dateSubtext}</span>
                </div>
            </div>
            <div class="day-content-grid" id="day-grid-${index}"></div>
        `;
        
        dom.releasesFeed.appendChild(dayBlock);
        
        const gridContainer = document.getElementById(`day-grid-${index}`);
        
        // Render each card inside the day block
        day.items.forEach((item, itemIdx) => {
            const card = document.createElement('div');
            const typeClass = `card-${item.type.toLowerCase().replace(/\s+/g, '-')}`;
            card.className = `update-card ${typeClass}`;
            
            // Build direct anchor link for the specific day + heading target
            const itemAnchor = `${day.link}`;
            
            card.innerHTML = `
                <div class="card-header-row">
                    <span class="badge badge-${item.type.toLowerCase().replace(/\s+/g, '-') || 'general'}">${item.type}</span>
                </div>
                <div class="card-content">
                    ${item.html_content}
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-copy-link" title="Copy Direct Link" data-link="${itemAnchor}">
                        <i class="fa-solid fa-link"></i>
                    </button>
                    <button class="btn-icon btn-copy-text" title="Copy Update Text" data-text="${encodeURIComponent(item.text_content)}">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="btn-icon btn-tweet-card" title="Share on X" 
                        data-date="${day.date}" 
                        data-type="${item.type}" 
                        data-text="${encodeURIComponent(item.text_content)}" 
                        data-link="${itemAnchor}">
                        <i class="fa-brands fa-x-twitter"></i>
                    </button>
                </div>
            `;
            
            gridContainer.appendChild(card);
        });
    });
    
    // Attach event listeners to newly rendered elements
    attachCardEvents();
}

function attachCardEvents() {
    // Direct link copy triggers
    document.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const link = btn.getAttribute('data-link');
            navigator.clipboard.writeText(link).then(() => {
                showToast('Release note link copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Copy failed:', err);
                showToast('Failed to copy link.', 'error');
            });
        });
    });
    
    // Update content text copy triggers
    document.querySelectorAll('.btn-copy-text').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = decodeURIComponent(btn.getAttribute('data-text'));
            navigator.clipboard.writeText(text).then(() => {
                showToast('Update content copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Copy failed:', err);
                showToast('Failed to copy text.', 'error');
            });
        });
    });
    
    // Tweet composer triggers
    document.querySelectorAll('.btn-tweet-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const date = btn.getAttribute('data-date');
            const type = btn.getAttribute('data-type');
            const text = decodeURIComponent(btn.getAttribute('data-text'));
            const link = btn.getAttribute('data-link');
            
            openTweetModal({ date, type, text, link });
        });
    });
}

// ==========================================================================
// TWEET COMPOSER MODAL SYSTEM
// ==========================================================================
function openTweetModal(item) {
    appState.selectedItem = item;
    
    // Prefill modal item preview info
    dom.previewBadge.className = `badge badge-${item.type.toLowerCase().replace(/\s+/g, '-')}`;
    dom.previewBadge.textContent = item.type;
    dom.previewDate.textContent = item.date;
    dom.previewText.textContent = item.text;
    
    // Format the tweet content: "BigQuery Feature (June 15, 2026): [Description] \n\n#BigQuery #GoogleCloud\n[Link]"
    const prefix = `BigQuery ${item.type} (${item.date}): `;
    const suffix = `\n\n#BigQuery #GoogleCloud\n${item.link}`;
    
    // Calculate max description length based on Twitter short URL allocation
    // 280 (limit) - prefix_len - suffix_len - 23 (standard URL size for t.co) + actual_link_size
    // But since the actual link is in the suffix, we need to subtract the length of the link string and add 23
    const linkStrLen = item.link.length;
    const staticTextLen = prefix.length + suffix.length - linkStrLen;
    const maxDescLen = TWITTER_CHAR_LIMIT - staticTextLen - TWITTER_URL_LENGTH;
    
    let description = item.text;
    if (description.length > maxDescLen) {
        description = description.substring(0, maxDescLen - 3) + '...';
    }
    
    const initialTweetText = `${prefix}${description}${suffix}`;
    dom.tweetTextarea.value = initialTweetText;
    
    updateCharacterCount();
    
    // Show Modal
    dom.tweetModal.classList.add('open');
    dom.tweetModal.setAttribute('aria-hidden', 'false');
    dom.tweetTextarea.focus();
}

function closeTweetModal() {
    dom.tweetModal.classList.remove('open');
    dom.tweetModal.setAttribute('aria-hidden', 'true');
    appState.selectedItem = null;
}

function updateCharacterCount() {
    const text = dom.tweetTextarea.value;
    
    // Twitter character counts URLs as exactly 23 characters.
    // We search the textarea content for http/https links and calculate character weight.
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    
    // Calculate total character count factoring in Twitter short URLs
    let rawTextWithoutUrls = text;
    urls.forEach(url => {
        rawTextWithoutUrls = rawTextWithoutUrls.replace(url, '');
    });
    
    const calculatedLength = rawTextWithoutUrls.length + (urls.length * TWITTER_URL_LENGTH);
    const charsRemaining = TWITTER_CHAR_LIMIT - calculatedLength;
    
    dom.charCounter.textContent = charsRemaining;
    
    // Colors and statuses depending on remaining characters
    dom.charCounter.className = 'char-counter';
    if (charsRemaining < 0) {
        dom.charCounter.classList.add('danger');
        dom.publishTweetBtn.disabled = true;
    } else if (charsRemaining < 30) {
        dom.charCounter.classList.add('warning');
        dom.publishTweetBtn.disabled = false;
    } else {
        dom.publishTweetBtn.disabled = false;
    }
    
    // Disable if empty
    if (text.trim().length === 0) {
        dom.publishTweetBtn.disabled = true;
    }
}

function publishTweet() {
    const tweetText = dom.tweetTextarea.value;
    if (!tweetText.trim()) return;
    
    // Open Twitter intent in a new tab
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    showToast('Redirected to Twitter composer!', 'info');
}

// ==========================================================================
// EXPORT SYSTEM (CSV ENGINE)
// ==========================================================================
function exportToCSV() {
    if (appState.filteredData.length === 0) {
        showToast('No filtered data available to export.', 'error');
        return;
    }
    
    const headers = ['Date', 'Category', 'Update Description', 'Reference Link'];
    const rows = [];
    
    appState.filteredData.forEach(entry => {
        entry.items.forEach(item => {
            rows.push([
                entry.date,
                item.type,
                item.text_content,
                entry.link
            ]);
        });
    });
    
    // RFC-4180 CSV Compliant Parser (escapes outer cell commas and doubles internal quotes)
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => {
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(','))
    ].join('\r\n');
    
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const datestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `bigquery_releases_${datestamp}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Successfully exported data to CSV!', 'success');
    } catch (err) {
        console.error('CSV Export failure:', err);
        showToast('Failed to export CSV file.', 'error');
    }
}

// ==========================================================================
// THEME SWITCH SYSTEM (LIGHT / DARK MODE)
// ==========================================================================
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeUI(isLight);
}

function updateThemeUI(isLight) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (isLight) {
            icon.className = 'fa-solid fa-sun';
            showToast('Swapped to light mode!', 'info');
        } else {
            icon.className = 'fa-solid fa-moon';
            showToast('Swapped to dark mode!', 'info');
        }
    }
}

// ==========================================================================
// EVENT LISTENERS & INITS
// ==========================================================================
function setupEventListeners() {
    // Refresh Button
    dom.refreshBtn.addEventListener('click', () => fetchReleases(true));
    
    // Export CSV Button
    dom.exportCsvBtn.addEventListener('click', exportToCSV);
    
    // Theme Toggle Button
    dom.themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Retry Button (Error State)
    dom.retryBtn.addEventListener('click', () => fetchReleases(true));
    
    // Search Box Inputs
    dom.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value;
        if (appState.searchQuery.length > 0) {
            dom.clearSearchBtn.style.display = 'flex';
        } else {
            dom.clearSearchBtn.style.display = 'none';
        }
        applyFiltersAndRender();
    });
    
    // Clear Search Box
    dom.clearSearchBtn.addEventListener('click', () => {
        dom.searchInput.value = '';
        appState.searchQuery = '';
        dom.clearSearchBtn.style.display = 'none';
        applyFiltersAndRender();
        dom.searchInput.focus();
    });
    
    // Category Chips
    dom.filterChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dom.filterChips.querySelector('.chip.active').classList.remove('active');
            chip.classList.add('active');
            
            appState.activeFilter = chip.getAttribute('data-filter');
            applyFiltersAndRender();
        });
    });
    
    // Reset Filters Action
    dom.resetFiltersBtn.addEventListener('click', () => {
        dom.searchInput.value = '';
        appState.searchQuery = '';
        dom.clearSearchBtn.style.display = 'none';
        
        dom.filterChips.querySelector('.chip.active').classList.remove('active');
        dom.filterChips.querySelector('[data-filter="All"]').classList.add('active');
        appState.activeFilter = 'All';
        
        applyFiltersAndRender();
    });
    
    // Tweet composer dynamic textarea listener
    dom.tweetTextarea.addEventListener('input', updateCharacterCount);
    
    // Modal buttons
    dom.closeModalBtn.addEventListener('click', closeTweetModal);
    dom.cancelTweetBtn.addEventListener('click', closeTweetModal);
    dom.publishTweetBtn.addEventListener('click', publishTweet);
    
    // Close modal if user clicks outside of modal card
    dom.tweetModal.addEventListener('click', (e) => {
        if (e.target === dom.tweetModal) {
            closeTweetModal();
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dom.tweetModal.classList.contains('open')) {
            closeTweetModal();
        }
    });
}

// Initial Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
    // Load persisted color scheme theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.className = 'fa-solid fa-sun';
    }
    
    setupEventListeners();
    fetchReleases(false); // Perform cached load on initial load
});
