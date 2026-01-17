# Deployment Checklist

## Pre-Deployment Setup

### 1. Database Setup (Choose One)

#### Option A: Neon (Recommended for Vercel)
- [ ] Sign up at [neon.tech](https://neon.tech)
- [ ] Create new project
- [ ] Copy connection string from dashboard
- [ ] Save as `DATABASE_URL` in `.env`

#### Option B: Supabase
- [ ] Sign up at [supabase.com](https://supabase.com)
- [ ] Create new project
- [ ] Navigate to Settings > Database
- [ ] Copy "Transaction" pooler connection string
- [ ] Save as `DATABASE_URL` in `.env`

### 2. Email Setup (for Magic Links)

#### Gmail Setup
- [ ] Enable 2-Factor Authentication on Google Account
- [ ] Go to Google Account > Security > 2-Step Verification > App passwords
- [ ] Generate app password for "Mail"
- [ ] Copy 16-character app password
- [ ] Update `.env` with Gmail settings:
  ```
  EMAIL_SERVER_HOST=smtp.gmail.com
  EMAIL_SERVER_PORT=587
  EMAIL_SERVER_USER=your-email@gmail.com
  EMAIL_SERVER_PASSWORD=<16-char-app-password>
  EMAIL_FROM=your-email@gmail.com
  ```

### 3. Local Development

- [ ] Install dependencies: `npm install`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Run migrations: `npx prisma migrate dev --name init`
- [ ] Seed database: `npm run seed`
- [ ] Generate NextAuth secret: `openssl rand -base64 32`
- [ ] Add to `.env`: `NEXTAUTH_SECRET=<generated-secret>`
- [ ] Test locally: `npm run dev`
- [ ] Visit http://localhost:3000
- [ ] Test player CRUD, round creation, scoring

## Vercel Deployment

### 1. Push to GitHub
- [ ] Initialize git: `git init`
- [ ] Add all files: `git add .`
- [ ] Commit: `git commit -m "Initial commit"`
- [ ] Create GitHub repo
- [ ] Add remote: `git remote add origin <your-repo-url>`
- [ ] Push: `git push -u origin main`

### 2. Vercel Setup
- [ ] Sign in to [vercel.com](https://vercel.com)
- [ ] Click "Add New Project"
- [ ] Import your GitHub repository
- [ ] Configure Project:
  - Framework Preset: Next.js
  - Root Directory: ./
  - Build Command: `npm run build`
  - Output Directory: .next

### 3. Environment Variables in Vercel

Add these in Project Settings > Environment Variables:

```
DATABASE_URL=<your-neon-or-supabase-connection-string>
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate-new-one-with-openssl-rand-base64-32>
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=<your-gmail-app-password>
EMAIL_FROM=your-email@gmail.com
```

- [ ] Add all environment variables
- [ ] Ensure all are set for Production, Preview, and Development

### 4. Deploy

- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Visit your app URL

### 5. Run Migrations on Production Database

Option A: Local with production DATABASE_URL
```bash
# Temporarily update .env with production DATABASE_URL
npx prisma migrate deploy
npm run seed
```

Option B: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel env pull .env.production
npx prisma migrate deploy
npm run seed
```

- [ ] Run migrations
- [ ] Run seed script
- [ ] Verify Timberlake Country Club exists
- [ ] Verify default format exists
- [ ] Verify sample players exist

### 6. Post-Deployment Testing

- [ ] Visit production URL
- [ ] Test sign-in with email
- [ ] Check email arrives
- [ ] Click magic link
- [ ] Verify authentication works
- [ ] Navigate to Players page
- [ ] Navigate to Courses page
- [ ] Create a test round
- [ ] Test scoring interface on mobile
- [ ] Lock round and view summary
- [ ] Check stats page

## Production Readiness

### Security
- [ ] All secrets are in environment variables (not hardcoded)
- [ ] `.env` is in `.gitignore`
- [ ] Database connection uses SSL
- [ ] NEXTAUTH_SECRET is unique and strong

### Performance
- [ ] Images optimized (if any added)
- [ ] API routes have error handling
- [ ] Database queries are optimized
- [ ] Proper indexes on frequently queried fields

### Monitoring
- [ ] Check Vercel Analytics
- [ ] Monitor function execution times
- [ ] Set up error tracking (optional: Sentry)

## Common Issues

### "Invalid or expired magic link"
- Check EMAIL_SERVER_* settings
- Verify Gmail app password (not regular password)
- Check spam folder
- Ensure NEXTAUTH_URL matches production URL

### Database connection errors
- Verify DATABASE_URL format
- Check database is not paused (Neon auto-pauses)
- Verify SSL mode if required
- Test connection with Prisma Studio

### Build failures
- Check all dependencies in package.json
- Verify TypeScript has no errors locally
- Check Vercel build logs
- Ensure all environment variables are set

### Scoring not saving
- Check API route logs in Vercel
- Verify browser has localStorage enabled
- Check for CORS issues
- Verify database write permissions

## Maintenance

### Regular Tasks
- Monitor database size (Neon free tier has limits)
- Check error logs in Vercel dashboard
- Review player/round data periodically
- Backup important data

### Updates
- Keep dependencies updated: `npm update`
- Test locally before deploying
- Use Vercel preview deployments for testing

## Support

For issues:
1. Check Vercel build logs
2. Check browser console
3. Check database connection
4. Review environment variables
5. Test locally with same DATABASE_URL

---

**Deployment completed successfully when:**
- ✅ App accessible at production URL
- ✅ Authentication works
- ✅ Can create players
- ✅ Can create rounds
- ✅ Can score rounds
- ✅ Can view summaries
- ✅ Stats page shows data
