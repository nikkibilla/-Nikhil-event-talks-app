from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# In-memory cache for parsed release notes
# Structure: { 'data': [...], 'timestamp': float }
CACHE_TIMEOUT = 300  # 5 minutes in seconds
releases_cache = {
    'data': None,
    'timestamp': 0
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    """Fetches the RSS feed from GCP and parses entries using ElementTree and BeautifulSoup."""
    logger.info(f"Fetching fresh release notes from: {FEED_URL}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    root = ET.fromstring(response.content)
    
    entries = []
    for entry in root.findall('atom:entry', namespaces):
        title_el = entry.find('atom:title', namespaces)
        updated_el = entry.find('atom:updated', namespaces)
        id_el = entry.find('atom:id', namespaces)
        link_el = entry.find('atom:link[@rel="alternate"]', namespaces)
        if link_el is None:
            link_el = entry.find('atom:link', namespaces)
            
        content_el = entry.find('atom:content', namespaces)
        
        date = title_el.text.strip() if title_el is not None else "Unknown Date"
        updated = updated_el.text.strip() if updated_el is not None else ""
        entry_id = id_el.text.strip() if id_el is not None else ""
        link = link_el.attrib.get('href', '') if link_el is not None else ""
        
        content_html = content_el.text if content_el is not None else ""
        
        items = []
        if content_html:
            soup = BeautifulSoup(content_html, 'html.parser')
            h3_tags = soup.find_all('h3')
            
            if not h3_tags:
                # Fallback if there are no h3 tags
                items.append({
                    'type': 'General',
                    'html_content': content_html,
                    'text_content': soup.get_text().strip()
                })
            else:
                for h3 in h3_tags:
                    item_type = h3.get_text(strip=True)
                    
                    # Gather sibling nodes after h3 until the next h3 tag
                    sibling_html = []
                    sibling_text = []
                    next_node = h3.next_sibling
                    while next_node and next_node.name != 'h3':
                        if next_node.name:
                            sibling_html.append(str(next_node))
                            sibling_text.append(next_node.get_text().strip())
                        elif isinstance(next_node, str) and next_node.strip():
                            sibling_html.append(next_node)
                            sibling_text.append(next_node.strip())
                        next_node = next_node.next_sibling
                        
                    html_content = "".join(sibling_html).strip()
                    text_content = " ".join(sibling_text).strip()
                    
                    items.append({
                        'type': item_type,
                        'html_content': html_content,
                        'text_content': text_content
                    })
        else:
            items.append({
                'type': 'General',
                'html_content': '',
                'text_content': ''
            })
            
        entries.append({
            'date': date,
            'updated': updated,
            'id': entry_id,
            'link': link,
            'items': items
        })
        
    return entries

@app.route('/')
def index():
    """Renders the main page."""
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    """API endpoint to get the parsed release notes, with caching."""
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if cache is valid and refresh not forced
    if not force_refresh and releases_cache['data'] is not None and (current_time - releases_cache['timestamp'] < CACHE_TIMEOUT):
        logger.info("Serving release notes from cache")
        return jsonify({
            'success': True,
            'source': 'cache',
            'last_updated': releases_cache['timestamp'],
            'data': releases_cache['data']
        })
        
    try:
        data = fetch_and_parse_feed()
        releases_cache['data'] = data
        releases_cache['timestamp'] = current_time
        
        return jsonify({
            'success': True,
            'source': 'live',
            'last_updated': current_time,
            'data': data
        })
    except Exception as e:
        logger.error(f"Error fetching or parsing feed: {e}")
        
        # If live fetch fails, fall back to cached data if available
        if releases_cache['data'] is not None:
            logger.info("Live fetch failed, falling back to cached data")
            return jsonify({
                'success': True,
                'source': 'cache_fallback',
                'last_updated': releases_cache['timestamp'],
                'data': releases_cache['data'],
                'warning': 'Failed to fetch live updates. Showing cached data.'
            })
            
        return jsonify({
            'success': False,
            'error': 'Failed to fetch release notes and no cached data is available.'
        }), 500

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
