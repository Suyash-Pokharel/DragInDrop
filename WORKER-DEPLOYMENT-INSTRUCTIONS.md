# 🚀 Worker Deployment Instructions

## Quick guide to deploy the optimized worker to Render.com

---

## 📋 **FILES TO UPDATE IN YOUR WORKER REPOSITORY**

You need to update these files in your `DragInDrop-Worker` repository:

### **1. package.json**
Add `"type": "module"` to enable ES modules:

```json
{
  "name": "youtube-upload-worker",
  "version": "1.0.0",
  "description": "Node.js web service for handling YouTube video uploads via YouTube Data API v3",
  "main": "index.js",
  "type": "module",  // ← ADD THIS LINE
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "keywords": [
    "youtube",
    "upload",
    "worker",
    "render",
    "video"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "form-data": "^4.0.0",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### **2. index.js**
Replace the entire content with the optimized code from `youtube-worker/index-optimized.js` in this repository.

---

## 🔧 **DEPLOYMENT STEPS**

### **Step 1: Navigate to Worker Repository**
```bash
cd path/to/DragInDrop-Worker
```

### **Step 2: Update package.json**
```bash
# Edit package.json and add "type": "module" after "main"
# Or copy the content from above
```

### **Step 3: Update index.js**
```bash
# Copy the entire content from youtube-worker/index-optimized.js
# in the main DragInDrop repository to index.js in the worker repo
```

### **Step 4: Commit and Push**
```bash
git add package.json index.js
git commit -m "Add ES module support and optimize for free tier"
git push origin main
```

### **Step 5: Wait for Render Auto-Deploy**
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click on your worker service
3. Watch the "Events" tab
4. Wait for "Deploy live" message (~2-3 minutes)

### **Step 6: Verify Deployment**
```bash
# Test health endpoint
curl https://dragindrop-worker.onrender.com/health

# Expected response:
# {"status":"ok","memory":{...}}
```

---

## ⚠️ **COMMON ISSUES**

### **Issue: "MODULE_TYPELESS_PACKAGE_JSON" Warning**
**Solution:** ✅ Fixed by adding `"type": "module"` to package.json

### **Issue: "Cannot use import statement outside a module"**
**Solution:** ✅ Fixed by adding `"type": "module"` to package.json

### **Issue: "require is not defined"**
**Cause:** Mixing CommonJS (`require`) with ES modules (`import`)
**Solution:** Use only `import` statements (already done in optimized code)

### **Issue: Build fails on Render**
**Check:**
1. Verify `package.json` has `"type": "module"`
2. Verify all `import` statements are correct
3. Check Render build logs for specific errors

---

## ✅ **VERIFICATION CHECKLIST**

After deployment, verify:

- [ ] No warnings in Render logs
- [ ] Health endpoint returns 200 OK
- [ ] Worker stays running (doesn't crash)
- [ ] Memory usage is reasonable (~50-100 MB)
- [ ] Test upload works with chunked progress

---

## 📊 **EXPECTED RENDER LOGS**

### **Successful Deployment:**
```
==> Running 'npm start'
> youtube-upload-worker@1.0.0 start
> node index.js

[2026-05-03T10:00:00.000Z] [SERVER] YouTube Upload Worker started on port 10000
[2026-05-03T10:00:00.000Z] [SERVER] Chunk size: 10.00 MB
```

### **Successful Upload:**
```
[2026-05-03T10:05:00.000Z] POST /upload
[2026-05-03T10:05:00.000Z] [UPLOAD] Starting upload job
[2026-05-03T10:05:00.000Z] [DOWNLOAD] Starting video download from Backblaze
[2026-05-03T10:05:10.000Z] [DOWNLOAD] Video downloaded successfully: 109.30 MB
[2026-05-03T10:05:10.000Z] [YOUTUBE] Initiating resumable upload session
[2026-05-03T10:05:11.000Z] [YOUTUBE] Upload session initiated successfully
[2026-05-03T10:05:11.000Z] [YOUTUBE] Uploading video in chunks
[2026-05-03T10:05:11.000Z] [YOUTUBE] Total size: 109.30 MB
[2026-05-03T10:05:11.000Z] [YOUTUBE] Chunk size: 10.00 MB
[2026-05-03T10:05:11.000Z] [YOUTUBE] Uploading chunk: 0% (0-10485759/114609308)
[2026-05-03T10:05:15.000Z] [YOUTUBE] Uploading chunk: 9% (10485760-20971519/114609308)
[2026-05-03T10:05:19.000Z] [YOUTUBE] Uploading chunk: 18% (20971520-31457279/114609308)
...
[2026-05-03T10:06:30.000Z] [YOUTUBE] Upload completed successfully
```

---

## 🎯 **QUICK REFERENCE**

### **Worker Repository Structure:**
```
DragInDrop-Worker/
├── index.js          ← Replace with optimized code
├── package.json      ← Add "type": "module"
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

### **Key Changes:**
1. ✅ `package.json`: Added `"type": "module"`
2. ✅ `index.js`: Chunked upload implementation
3. ✅ Chunk size: 10 MB (optimal for 512 MB memory)
4. ✅ Auto-resume: Handles Render restarts
5. ✅ Progress logging: Every chunk logged

---

## 🔗 **USEFUL LINKS**

- [Render Dashboard](https://dashboard.render.com/)
- [Render Logs](https://dashboard.render.com/web/YOUR_SERVICE_ID/logs)
- [Render Metrics](https://dashboard.render.com/web/YOUR_SERVICE_ID/metrics)
- [Worker Health Check](https://dragindrop-worker.onrender.com/health)

---

## 💡 **TIPS**

1. **Monitor First Deploy:**
   - Watch Render logs carefully
   - Check for any warnings or errors
   - Verify health endpoint works

2. **Test Immediately:**
   - Upload a small video (< 50 MB)
   - Check chunk progress in logs
   - Verify success on YouTube

3. **Keep Logs:**
   - Render keeps logs for 7 days
   - Download important logs if needed
   - Monitor for any issues

---

## 🎉 **SUCCESS!**

Once deployed, your worker will:
- ✅ Handle large video uploads reliably
- ✅ Upload in 10 MB chunks
- ✅ Auto-resume on restarts
- ✅ Stay alive 24/7 (with keep-alive cron)
- ✅ Work perfectly on free tier

---

**Last Updated:** May 3, 2026
**Version:** 1.0.0
