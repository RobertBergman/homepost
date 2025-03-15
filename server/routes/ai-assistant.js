// AI Assistant routes
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { respondToQuery, analyzeImage } = require('../services/responses-api');

const router = express.Router();

// Configure file storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../data/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// API endpoint for querying the AI assistant
router.post('/query', express.json(), async (req, res) => {
  try {
    const { query, clientId } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Query must be a non-empty string'
      });
    }
    
    const response = await respondToQuery(query, clientId || 'web-client');
    
    res.json({
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling AI query:', error);
    res.status(500).json({
      error: 'Failed to process query',
      message: error.message
    });
  }
});

// API endpoint for image analysis
router.post('/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image provided',
        message: 'Please upload an image file'
      });
    }
    
    const deviceId = req.body.deviceId || 'web-client';
    
    const analysis = await analyzeImage(req.file.path, deviceId);
    
    // Remove the temporary file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temporary file:', err);
    });
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing image:', error);
    
    // Clean up file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    
    res.status(500).json({
      error: 'Failed to analyze image',
      message: error.message
    });
  }
});

module.exports = router;