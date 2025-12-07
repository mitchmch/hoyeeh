
// server/server.js
// Note: This requires 'npm install express mongoose cors dotenv aws-sdk jsonwebtoken bcryptjs fluent-ffmpeg @google/genai'
// SYSTEM REQUIREMENT: FFmpeg must be installed on the host machine.

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();
app.use(express.json());
app.use(cors());

// --- Database Connection ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hoyeeh';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- Database Schema ---
const userSchema = new mongoose.Schema({
  mobileNumber: { type: String, required: true, unique: true },
  pinHash: { type: String, required: true },
  secretWordHash: { type: String, required: true },
  country: { type: String, default: 'XX' }, // XX = International default
  role: { type: String, default: 'user', enum: ['user', 'admin'] },
  isSubscribed: { type: Boolean, default: false },
  subscriptionExpiry: Date,
  currentSessionId: { type: String }, // For single device login enforcement
  myList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
  watchHistory: [{
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
    progress: Number,
    lastWatched: { type: Date, default: Date.now }
  }]
});

const contentSchema = new mongoose.Schema({
  title: String,
  description: String,
  genre: String,
  contentType: { type: String, default: 'movie', enum: ['movie', 'series'] },
  videoKey: String, // Path in DO Space or Full URL
  originalVideoKey: String, // Keep reference to MP4 if transcoded
  isPremium: Boolean,
  thumbnailUrl: String,
  duration: Number,
  isTranscoded: { type: Boolean, default: false }
});

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' }, // Optional (if rating specific content)
  rating: Number, // 1-5
  message: String,
  category: { type: String, enum: ['bug', 'feature', 'content_rating', 'general'], default: 'general' },
  deviceInfo: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Content = mongoose.model('Content', contentSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

// --- Config ---
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'fra1.digitaloceanspaces.com'),
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET
});

const DO_BUCKET = process.env.DO_SPACES_BUCKET || 'hoyeeh-media';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'HOYEEH_2024';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Gemini Config
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Middleware ---
const authenticate = async (req, res, next) => {
  let token = req.headers.authorization?.split(' ')[1];
  
  // Also check query param for HLS streams which cannot set headers easily
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if the session is still valid (Single Device Check)
    const user = await User.findById(decoded.id);
    if (!user) {
        return res.status(401).json({ message: 'User not found' });
    }

    if (decoded.sessionId && user.currentSessionId !== decoded.sessionId) {
        return res.status(401).json({ message: 'Session expired. You logged in on another device.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// --- Helper Functions for Transcoding ---
const downloadFile = (bucket, key, localPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    s3.getObject({ Bucket: bucket, Key: key })
      .createReadStream()
      .on('error', reject)
      .pipe(file)
      .on('close', resolve);
  });
};

const uploadDir = async (localDir, bucket, s3Prefix) => {
  const files = fs.readdirSync(localDir);
  for (const file of files) {
    const filePath = path.join(localDir, file);
    const fileContent = fs.readFileSync(filePath);
    const params = {
      Bucket: bucket,
      Key: `${s3Prefix}/${file}`,
      Body: fileContent,
      ACL: 'private',
      ContentType: file.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T'
    };
    await s3.putObject(params).promise();
  }
};

// --- Routes ---
// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// DEBUG: Reset Database
app.post('/api/debug/reset', async (req, res) => {
  try {
    console.log("Resetting Database...");
    await User.deleteMany({});
    // We optionally keep content to avoid re-uploading, or uncomment below to wipe everything
    // await Content.deleteMany({}); 
    console.log("Users cleared.");
    res.json({ success: true, message: 'All users have been reset. Please register a new account.' });
  } catch (err) {
    console.error("Reset failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// AUTOMATIC DEMO LOGIN
app.post('/api/auth/demo', async (req, res) => {
  try {
    const demoMobile = "23799999999";
    const demoPin = "1234";
    const demoSecret = "demo";
    
    let user = await User.findOne({ mobileNumber: demoMobile });
    if (!user) {
        // Create demo user if not exists
        const salt = await bcrypt.genSalt(10);
        const pinHash = await bcrypt.hash(demoPin, salt);
        const secretWordHash = await bcrypt.hash(demoSecret, salt);
        user = new User({ 
            mobileNumber: demoMobile, 
            pinHash, 
            secretWordHash, 
            country: 'CM', 
            role: 'user',
            isSubscribed: true // Give demo user premium
        });
        await user.save();
        console.log("Created Demo User");
    }
    
    // Login logic
    const sessionId = crypto.randomBytes(16).toString('hex');
    user.currentSessionId = sessionId;
    await user.save();
    
    const token = jwt.sign({ id: user._id, role: user.role, sessionId }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({
      token,
      id: user._id,
      mobileNumber: user.mobileNumber,
      country: user.country,
      role: user.role,
      isSubscribed: user.isSubscribed,
      myList: user.myList || [],
      watchHistory: user.watchHistory || []
    });
  } catch (err) {
      console.error("Demo Login Failed", err);
      res.status(500).json({ error: err.message });
  }
});

// 1. Auth (Mobile + PIN)
app.post('/api/auth/register', async (req, res) => {
  try {
    let { mobileNumber, pin, secretWord, adminCode } = req.body;
    
    // Sanitization
    mobileNumber = mobileNumber?.trim();
    pin = pin?.trim();
    secretWord = secretWord?.trim();
    adminCode = adminCode?.trim();

    // Basic Validation
    if (!mobileNumber || !pin || !secretWord) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    if (pin.length !== 4) {
        return res.status(400).json({ message: 'PIN must be 4 digits' });
    }

    // Check existing
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
        return res.status(400).json({ message: 'Mobile number already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);
    const secretWordHash = await bcrypt.hash(secretWord, salt);

    // GeoIP Logic: Check headers provided by CDNs/Cloud providers
    let country = 'XX'; // Default International
    
    const countryHeader = 
        req.headers['cf-ipcountry'] || 
        req.headers['x-vercel-ip-country'] || 
        req.headers['x-app-engine-country'];

    if (countryHeader) {
        country = countryHeader.toUpperCase();
    } else {
        // Fallback for development/local: Check if phone starts with African codes
        if (mobileNumber.startsWith('237')) country = 'CM';
        else if (mobileNumber.startsWith('234')) country = 'NG';
        else if (mobileNumber.startsWith('233')) country = 'GH';
        else if (mobileNumber.startsWith('254')) country = 'KE';
        else if (mobileNumber.startsWith('27')) country = 'ZA';
    }
    
    // Check for admin code
    let role = 'user';
    if (adminCode && adminCode === ADMIN_SECRET) {
        role = 'admin';
    }

    const user = new User({ mobileNumber, pinHash, secretWordHash, country, role });
    await user.save();
    console.log(`User registered: ${mobileNumber} (${country})`);
    res.json({ success: true, role });
  } catch (err) {
    console.error("Registration Error:", err);
    if (err.code === 11000) {
        return res.status(400).json({ message: 'Mobile number already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    let { mobileNumber, pin } = req.body;
    mobileNumber = mobileNumber?.trim();
    pin = pin?.trim();

    const user = await User.findOne({ mobileNumber });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPin = await bcrypt.compare(pin, user.pinHash);
    if (!validPin) return res.status(400).json({ message: 'Invalid PIN' });

    // Generate new Session ID
    const sessionId = crypto.randomBytes(16).toString('hex');
    user.currentSessionId = sessionId;
    await user.save();

    // Added Expiry
    const token = jwt.sign({ id: user._id, role: user.role, sessionId }, JWT_SECRET, { expiresIn: '30d' });
    
    console.log(`User logged in: ${mobileNumber}`);

    res.json({
      token,
      id: user._id,
      mobileNumber: user.mobileNumber,
      country: user.country,
      role: user.role,
      isSubscribed: user.isSubscribed,
      myList: user.myList || [],
      watchHistory: user.watchHistory || []
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-pin', async (req, res) => {
  try {
    let { mobileNumber, secretWord, newPin } = req.body;
    mobileNumber = mobileNumber?.trim();
    secretWord = secretWord?.trim();
    newPin = newPin?.trim();

    const user = await User.findOne({ mobileNumber });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const validSecret = await bcrypt.compare(secretWord, user.secretWordHash);
    if (!validSecret) return res.status(400).json({ message: 'Invalid Secret Word' });

    const salt = await bcrypt.genSalt(10);
    user.pinHash = await bcrypt.hash(newPin, salt);
    
    // Invalidate existing sessions on PIN reset for security
    user.currentSessionId = null;
    await user.save();

    res.json({ success: true, message: 'PIN updated. Please login again.' });
  } catch (err) {
    console.error("Reset PIN Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. User Features & Recommendations
app.get('/api/user/recommendations', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('watchHistory.contentId');
    const allContent = await Content.find({}, 'title genre contentType description');

    // Prepare data for Gemini
    const watchedTitles = user.watchHistory
      .filter(h => h.contentId)
      .map(h => `${h.contentId.title} (${h.contentId.genre})`);
    
    const catalog = allContent.map(c => ({
      id: c._id.toString(),
      info: `${c.title} [${c.contentType}, ${c.genre}] - ${c.description.substring(0, 50)}...`
    }));

    if (watchedTitles.length === 0) {
       // Return generic popular items if no history
       const movies = await Content.find({ contentType: 'movie' }).limit(5);
       const shows = await Content.find({ contentType: 'series' }).limit(5);
       return res.json({ movies, shows });
    }

    // Call Gemini
    const prompt = `
      User History: ${watchedTitles.join(', ')}.
      
      Catalog:
      ${catalog.map(c => c.info + " (ID: " + c.id + ")").join('\n')}

      Task: Recommend 5 movies and 5 TV shows (series) from the Catalog that best match the user's history.
      Return strictly a JSON object with two arrays of IDs: "movieIds" and "showIds".
    `;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            movieIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            showIds: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const result = JSON.parse(response.text);
    
    const recMovies = await Content.find({ _id: { $in: result.movieIds || [] } });
    const recShows = await Content.find({ _id: { $in: result.showIds || [] } });

    res.json({
        movies: recMovies.map(c => ({
            id: c._id,
            title: c.title,
            description: c.description,
            thumbnailUrl: c.thumbnailUrl,
            videoUrl: c.videoKey, 
            genre: c.genre,
            contentType: c.contentType,
            isPremium: c.isPremium,
            duration: c.duration
        })),
        shows: recShows.map(c => ({
            id: c._id,
            title: c.title,
            description: c.description,
            thumbnailUrl: c.thumbnailUrl,
            videoUrl: c.videoKey, 
            genre: c.genre,
            contentType: c.contentType,
            isPremium: c.isPremium,
            duration: c.duration
        }))
    });

  } catch (err) {
    console.error("Gemini Error:", err);
    // Fallback
    const movies = await Content.find({ contentType: 'movie' }).limit(5);
    const shows = await Content.find({ contentType: 'series' }).limit(5);
    res.json({ movies, shows });
  }
});

app.get('/api/user/mylist', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('myList');
    const response = user.myList.map(c => ({
      id: c._id,
      title: c.title,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      videoUrl: c.videoKey,
      genre: c.genre,
      contentType: c.contentType,
      isPremium: c.isPremium,
      duration: c.duration
    }));
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/mylist', authenticate, async (req, res) => {
  try {
    const { contentId } = req.body;
    const user = await User.findById(req.user.id);
    if (!user.myList.includes(contentId)) {
      user.myList.push(contentId);
      await user.save();
    }
    res.json({ success: true, myList: user.myList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/mylist/:contentId', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.myList = user.myList.filter(id => id.toString() !== req.params.contentId);
    await user.save();
    res.json({ success: true, myList: user.myList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/change-settings', authenticate, async (req, res) => {
  try {
    const { newPin, newSecret } = req.body;
    const user = await User.findById(req.user.id);
    
    if (newPin) {
      if (newPin.length !== 4) return res.status(400).json({ message: 'PIN must be 4 digits'});
      const salt = await bcrypt.genSalt(10);
      user.pinHash = await bcrypt.hash(newPin, salt);
    }
    
    if (newSecret) {
      if (newSecret.length < 3) return res.status(400).json({ message: 'Secret too short'});
      const salt = await bcrypt.genSalt(10);
      user.secretWordHash = await bcrypt.hash(newSecret, salt);
    }
    
    await user.save();
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/cancel-subscription', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.isSubscribed = false;
    user.subscriptionExpiry = null;
    await user.save();
    res.json({ success: true, isSubscribed: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feedback Submission
app.post('/api/user/feedback', authenticate, async (req, res) => {
  try {
    const { contentId, rating, message, category, deviceInfo } = req.body;
    
    const feedback = new Feedback({
      user: req.user.id,
      contentId: contentId || undefined,
      rating,
      message,
      category,
      deviceInfo
    });

    await feedback.save();
    res.json({ success: true, message: 'Feedback received' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear Watch History
app.delete('/api/user/history', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.watchHistory = [];
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/progress', authenticate, async (req, res) => {
  try {
    const { contentId, progress } = req.body;
    const user = await User.findById(req.user.id);
    
    const existingIndex = user.watchHistory.findIndex(h => h.contentId.toString() === contentId);
    
    if (existingIndex > -1) {
      user.watchHistory[existingIndex].progress = progress;
      user.watchHistory[existingIndex].lastWatched = new Date();
    } else {
      user.watchHistory.push({ contentId, progress, lastWatched: new Date() });
    }
    
    if (user.watchHistory.length > 20) {
        user.watchHistory.sort((a, b) => b.lastWatched - a.lastWatched);
        user.watchHistory = user.watchHistory.slice(0, 20);
    }
    
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user/continue-watching', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('watchHistory.contentId');
    const history = user.watchHistory
      .filter(item => item.contentId) 
      .map(item => ({
        content: {
            id: item.contentId._id,
            title: item.contentId.title,
            thumbnailUrl: item.contentId.thumbnailUrl,
            duration: item.contentId.duration,
            contentType: item.contentId.contentType
        },
        progress: item.progress,
        lastWatched: item.lastWatched
      }))
      .sort((a, b) => new Date(b.lastWatched) - new Date(a.lastWatched));
      
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Content Management (Admin) & Search
app.get('/api/content', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    let query = {};
    
    // Server-side Search Logic
    if (q) {
        query = {
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { genre: { $regex: q, $options: 'i' } }
            ]
        };
    }
    
    const content = await Content.find(query).sort({ _id: -1 });
    const response = content.map(c => ({
      id: c._id,
      title: c.title,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      videoUrl: c.videoKey, 
      genre: c.genre,
      contentType: c.contentType,
      isPremium: c.isPremium,
      duration: c.duration,
      isTranscoded: c.isTranscoded
    }));
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/upload-url', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  try {
    const { fileName, fileType } = req.body;
    const key = `videos/raw/${Date.now()}_${fileName.replace(/\s+/g, '_')}`;
    
    const url = s3.getSignedUrl('putObject', {
        Bucket: DO_BUCKET,
        Key: key,
        ContentType: fileType,
        ACL: 'private',
        Expires: 300 
    });
    
    res.json({ url, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSCODING ENDPOINT ---
app.post('/api/admin/content/:id/transcode', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  
  // Set longer timeout for this request
  req.setTimeout(600000); // 10 minutes

  const contentId = req.params.id;
  const tempDir = path.join(os.tmpdir(), `transcode_${contentId}`);
  const tempFile = path.join(tempDir, 'input.mp4');
  const outputHlsDir = path.join(tempDir, 'hls');

  try {
    const content = await Content.findById(contentId);
    if (!content) return res.status(404).send('Content not found');
    
    // Check if we have an original file to use
    let sourceKey = content.originalVideoKey || content.videoKey;
    
    // Guard: Do not attempt to download an m3u8 as the source mp4
    if (sourceKey.endsWith('.m3u8')) {
        return res.status(400).json({ 
            error: "Cannot transcode. The source file is already a playlist.", 
            details: "Please re-upload the original MP4 file."
        });
    }

    try {
        await new Promise((resolve, reject) => {
            ffmpeg.getAvailableFormats((err, formats) => {
                if(err) reject(err);
                resolve(formats);
            });
        });
    } catch(e) {
        return res.status(500).json({ 
            error: 'FFmpeg not available on server.',
            details: 'Please install ffmpeg on the host machine.'
        });
    }

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    if (!fs.existsSync(outputHlsDir)) fs.mkdirSync(outputHlsDir);

    console.log(`Downloading ${sourceKey}...`);
    await downloadFile(DO_BUCKET, sourceKey, tempFile);

    console.log(`Transcoding to HLS...`);
    await new Promise((resolve, reject) => {
      ffmpeg(tempFile, { timeout: 432000 })
        .addOptions([
          '-profile:v baseline',
          '-level 3.0',
          '-start_number 0',
          '-hls_time 10',
          '-hls_list_size 0',
          '-f hls'
        ])
        .output(path.join(outputHlsDir, 'output.m3u8'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    console.log(`Uploading HLS segments...`);
    const s3Prefix = `videos/hls/${contentId}`;
    await uploadDir(outputHlsDir, DO_BUCKET, s3Prefix);

    // Update DB - Ensure we keep the original MP4 reference
    if (!content.originalVideoKey) {
        content.originalVideoKey = sourceKey;
    }
    content.videoKey = `${s3Prefix}/output.m3u8`;
    content.isTranscoded = true;
    await content.save();

    console.log(`Transcoding complete for ${contentId}`);
    res.json({ success: true, newUrl: content.videoKey });

  } catch (err) {
    console.error("Transcode Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) { console.error("Cleanup error", e); }
  }
});

app.post('/api/admin/content', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  try {
    const { videoUrl, ...rest } = req.body;
    const content = new Content({ ...rest, videoKey: videoUrl, originalVideoKey: videoUrl });
    await content.save();
    res.json({ ...content.toObject(), id: content._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Content (Edit)
app.put('/api/admin/content/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  try {
    const updates = req.body;
    const content = await Content.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(content ? { ...content.toObject(), id: content._id } : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/content/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  try {
    await Content.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin Users
app.get('/api/admin/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  try {
    const users = await User.find({}, '-pinHash -secretWordHash'); 
    const response = users.map(u => ({
      id: u._id,
      mobileNumber: u.mobileNumber,
      role: u.role,
      country: u.country,
      isSubscribed: u.isSubscribed,
      myList: u.myList
    }));
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/user/:id/reset-pin', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  try {
    const { newPin } = req.body;
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(newPin, salt);
    // Invalidate sessions on admin reset
    await User.findByIdAndUpdate(req.params.id, { pinHash, currentSessionId: null });
    res.json({ success: true, message: 'User PIN reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/user/:id/reset-secret', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
    try {
      const { newSecret } = req.body;
      const salt = await bcrypt.genSalt(10);
      const secretWordHash = await bcrypt.hash(newSecret, salt);
      await User.findByIdAndUpdate(req.params.id, { secretWordHash });
      res.json({ success: true, message: 'User Secret Word reset successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/user/:id/toggle-subscription', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isSubscribed = !user.isSubscribed;
    await user.save();
    res.json({ success: true, isSubscribed: user.isSubscribed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete User
app.delete('/api/admin/user/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
    try {
      await User.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// Admin Stats
app.get('/api/admin/stats', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
    try {
        const userCount = await User.countDocuments();
        const activeSubs = await User.countDocuments({ isSubscribed: true });
        const totalContent = await Content.countDocuments();
        const feedbackCount = await Feedback.countDocuments();
        
        res.json({
            userCount,
            activeSubs,
            totalContent,
            feedbackCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Streaming & Proxying
app.get('/api/stream/manifest/:id', authenticate, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).send('Not found');

    const user = await User.findById(req.user.id);
    if (content.isPremium && !user.isSubscribed) return res.status(403).send('Forbidden');

    if (!content.videoKey.endsWith('.m3u8')) return res.status(400).send('Not HLS');

    const s3Params = { Bucket: DO_BUCKET, Key: content.videoKey };
    
    const data = await s3.getObject(s3Params).promise();
    let playlist = data.Body.toString('utf-8');

    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    
    playlist = playlist.replace(
      /^(.*\.ts)$/gm, 
      `/api/stream/segment/${content.id}/$1?token=${token}`
    );

    res.set('Content-Type', 'application/x-mpegURL');
    res.send(playlist);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

app.get('/api/stream/segment/:id/:segment', authenticate, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).send('Not found');
    
    const baseDir = path.dirname(content.videoKey);
    const segmentKey = `${baseDir}/${req.params.segment}`;

    const url = s3.getSignedUrl('getObject', {
        Bucket: DO_BUCKET,
        Key: segmentKey,
        Expires: 300 // 5 minutes
    });

    res.redirect(url);
  } catch (err) {
    res.status(500).send('Error');
  }
});

app.get('/api/content/:id/sign', authenticate, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).send('Not found');

    const user = await User.findById(req.user.id);
    if (content.isPremium && !user.isSubscribed) {
      return res.status(403).json({ message: 'Subscription required' });
    }

    const type = req.query.type;
    let url;

    // Prefer original MP4 for downloads if available, otherwise fallback
    if (type === 'download' && content.originalVideoKey) {
        url = s3.getSignedUrl('getObject', {
            Bucket: DO_BUCKET,
            Key: content.originalVideoKey,
            Expires: 3600
        });
    } else if (content.isTranscoded) {
      const token = req.headers.authorization?.split(' ')[1] || '';
      url = `/api/stream/manifest/${content.id}?token=${token}`;
    } else {
      url = content.videoKey;
      if (!url.startsWith('http')) {
          url = s3.getSignedUrl('getObject', {
              Bucket: DO_BUCKET,
              Key: content.videoKey,
              Expires: 3600 
          });
      }
    }
    
    const historyItem = user.watchHistory.find(h => h.contentId.toString() === content.id);
    const progress = historyItem ? historyItem.progress : 0;

    res.json({ url, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Payment Webhooks
app.post('/api/webhook/flutterwave', async (req, res) => {
  const { data } = req.body;
  if (data.status === 'successful') {
    console.log(`Payment successful for tx: ${data.tx_ref}`);
  }
  res.sendStatus(200);
});

// 7. Serve Static Files (Production/Deployment Fix)
// This serves the Vite build output if API routes are not hit.
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // If running in development without a build or wrong path
    app.get('*', (req, res) => {
        res.status(404).send('API endpoint not found and static files not present.');
    });
}

const PORT = process.env.PORT || 5000;
// Listen on 0.0.0.0 to allow external access (essential for Docker/Remote environments)
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
