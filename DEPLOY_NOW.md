# Deploy Sunday Church Golf App - Quick Guide

## 🚀 Fast Track to Production (15 minutes)

### Step 1: Get a Free Database (2 minutes)

**Option A: Neon (Recommended)**
1. Go to [neon.tech](https://neon.tech)
2. Click "Sign Up" (use GitHub for fastest signup)
3. Create new project: "sunday-church-golf"
4. Copy the connection string that appears
5. Save it - you'll need it in Step 3

**Option B: Supabase**
1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub
3. Create new project
4. Go to Settings > Database > Connection String
5. Copy the "Transaction" pooler string
6. Save it for Step 3

### Step 2: Get Gmail App Password (3 minutes)

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click Security > 2-Step Verification
3. If not enabled, enable it now
4. Scroll down to "App passwords"
5. Select "Mail" and "Other (Custom name)"
6. Type "Sunday Church Golf"
7. Click Generate
8. Copy the 16-character password (no spaces)
9. Save it for Step 3

### Step 3: Configure Environment (1 minute)

Open Terminal and run:

```bash
cd "Sunday Church App"
cp .env.example .env
open .env
```

Edit `.env` and fill in:

```bash
# Paste your database URL from Step 1
DATABASE_URL="postgresql://user:pass@host/db"

# Generate a secret (run this in terminal: openssl rand -base64 32)
NEXTAUTH_SECRET="paste-generated-secret-here"

# For local development
NEXTAUTH_URL="http://localhost:3000"

# Email settings
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="paste-16-char-password-from-step-2"
EMAIL_FROM="your-email@gmail.com"
```

Save the file.

### Step 4: Run Deployment Script (5 minutes)

```bash
cd "Sunday Church App"
./deploy.sh
```

This will:
- Install all dependencies
- Set up the database
- Run migrations
- Seed Timberlake Country Club data
- Build the app

### Step 5: Test Locally (2 minutes)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see:
- ✅ Dashboard loads
- ✅ Click "Players" - see 8 sample players
- ✅ Click "Courses" - see Timberlake Country Club
- ✅ Try creating a new round

If everything works, proceed to Step 6!

### Step 6: Deploy to Vercel (2 minutes)

**First time setup:**

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login
```

**Deploy:**

```bash
# Run from project directory
vercel
```

Answer the prompts:
- Set up and deploy? **Y**
- Which scope? **Your account**
- Link to existing project? **N**
- Project name? **sunday-church-golf** (or press Enter)
- Directory? **./** (press Enter)
- Override settings? **N**

**Add Environment Variables:**

```bash
vercel env add DATABASE_URL
# Paste your production database URL

vercel env add NEXTAUTH_SECRET
# Run: openssl rand -base64 32
# Paste the output

vercel env add NEXTAUTH_URL
# Type: https://sunday-church-golf.vercel.app
# (replace with your actual Vercel URL from previous step)

vercel env add EMAIL_SERVER_HOST
vercel env add EMAIL_SERVER_PORT
vercel env add EMAIL_SERVER_USER
vercel env add EMAIL_SERVER_PASSWORD
vercel env add EMAIL_FROM
```

**Deploy to Production:**

```bash
vercel --prod
```

### Step 7: Run Migrations on Production Database

```bash
# If using the same DATABASE_URL, skip this
# If you have a separate production database:

# Temporarily update .env with production DATABASE_URL
npx prisma migrate deploy
npm run seed
```

### Step 8: Test Production

Visit your Vercel URL (e.g., `https://sunday-church-golf.vercel.app`)

Test:
1. ✅ Sign in with email
2. ✅ Check email for magic link
3. ✅ Click link and verify you're logged in
4. ✅ View Players, Courses
5. ✅ Create a test round
6. ✅ Test scoring on your phone

---

## 🎉 You're Live!

Share the URL with your Sunday Church golf group!

## Troubleshooting

### "Failed to connect to database"
- Check DATABASE_URL is correct
- Ensure database allows connections from Vercel IPs
- For Neon: Database should NOT be paused

### "Magic link not working"
- Use Gmail App Password, not regular password
- Check spam folder
- Verify EMAIL_SERVER_* settings match exactly

### "Build failed on Vercel"
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Try: `vercel env pull` then `npm run build` locally

### Still stuck?

Check the detailed guides:
- DEPLOYMENT.md - Full deployment checklist
- GETTING_STARTED.md - Development setup
- README.md - Technical documentation

---

## Alternative: One-Click Deploy

If you prefer a visual interface:

1. Push code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/sunday-church-golf.git
   git push -u origin main
   ```

2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Add environment variables in the UI
5. Click Deploy

---

**Total time: ~15 minutes to production!** 🚀
