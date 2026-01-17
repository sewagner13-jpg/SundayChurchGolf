#!/bin/bash

echo "🏌️ Sunday Church Golf - Deployment Script"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created - PLEASE EDIT IT WITH YOUR SETTINGS"
    echo ""
    echo "Required settings:"
    echo "  - DATABASE_URL (get from neon.tech or supabase.com)"
    echo "  - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)"
    echo "  - Email settings (for magic link authentication)"
    echo ""
    read -p "Press Enter after you've edited .env..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Prisma generate failed!"
    exit 1
fi

echo "✅ Prisma client generated"
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

if [ $? -ne 0 ]; then
    echo "❌ Database migration failed!"
    echo "Please check your DATABASE_URL in .env"
    exit 1
fi

echo "✅ Database migrated"
echo ""

# Seed database
echo "🌱 Seeding database with Timberlake CC data..."
npm run seed

if [ $? -ne 0 ]; then
    echo "❌ Database seeding failed!"
    exit 1
fi

echo "✅ Database seeded"
echo ""

# Build the application
echo "🏗️  Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"
echo ""

echo "🎉 Local setup complete!"
echo ""
echo "Next steps:"
echo "  1. Test locally: npm run dev"
echo "  2. Visit: http://localhost:3000"
echo ""
echo "To deploy to Vercel:"
echo "  1. Install Vercel CLI: npm i -g vercel"
echo "  2. Run: vercel"
echo "  3. Follow prompts and add environment variables"
echo ""
