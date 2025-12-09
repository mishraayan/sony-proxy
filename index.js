const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so your React app can hit this server
app.use(cors());
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('Missing "url" query parameter');
    }

    try {
        // 1. Fetch the requested resource (m3u8 or ts file)
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer', // Get raw data (important for video chunks)
            headers: {
                'Referer': 'https://www.sonyliv.com/',
                'Origin': 'https://www.sonyliv.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // 2. Identify our own host (to rewrite links to point back to us)
        const protocol = req.protocol;
        const host = req.get('host');
        const selfUrl = `${protocol}://${host}/proxy?url=`;

        // 3. Handle M3U8 Playlists (Text Rewrite)
        const contentType = response.headers['content-type'];
        
        if (contentType && (contentType.includes('mpegurl') || url.endsWith('.m3u8'))) {
            // Convert buffer to string
            let m3u8Content = response.data.toString('utf-8');

            // Regex to find all http/https links in the m3u8 and prepend our proxy URL
            // This ensures the player asks US for the next chunk, not Sony directly
            const rewrittenContent = m3u8Content.replace(
                /(https?:\/\/[^\s"']+)/g, 
                (match) => `${selfUrl}${encodeURIComponent(match)}`
            );

            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(rewrittenContent);
        } 
        // 4. Handle Video Chunks (.ts) - Just pass them through
        else {
            res.set('Content-Type', contentType);
            res.send(response.data);
        }

    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).send('Error fetching stream');
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
