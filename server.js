const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/kenter', (req, res) => {
    res.sendFile(path.join(__dirname, 'kenter.html'));
});

// Mock Kenter API endpoint
app.get('/api/kenter/data', (req, res) => {
    try {
        // Read the example.json file
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'example.json'), 'utf8'));
        res.json(data);
    } catch (error) {
        console.error('Error reading example.json:', error);
        res.status(500).json({ error: 'Failed to read example data' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 