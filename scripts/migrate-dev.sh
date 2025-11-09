#!/bin/bash
# Development Database Migration Script
# This script runs all SQL migrations on the fanedit-dev database
# Usage: ./scripts/migrate-dev.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===========================================${NC}"
echo -e "${YELLOW}  FanEdit Development Database Migration  ${NC}"
echo -e "${YELLOW}===========================================${NC}"
echo ""

# Check if required environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}Error: NEXT_PUBLIC_SUPABASE_URL is not set${NC}"
    echo "Please set your dev environment variables first:"
    echo "  export NEXT_PUBLIC_SUPABASE_URL=your-dev-url"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}Error: SUPABASE_SERVICE_ROLE_KEY is not set${NC}"
    echo "Please set your dev service role key first"
    exit 1
fi

# Extract project ref from URL
# Format: https://xxxxx.supabase.co -> xxxxx
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')

echo -e "${YELLOW}Target Database:${NC} $PROJECT_REF"
echo ""
echo -e "${RED}⚠️  WARNING: This will run migrations on the above database${NC}"
echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
read

# Construct the database URL
# Note: You'll need to replace 'postgres' with your actual database password
DB_URL="postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres"

echo -e "${GREEN}🔄 Running migrations...${NC}"
echo ""

# Track success/failure
TOTAL=0
SUCCESS=0
FAILED=0

# Run migrations in order
for file in sql/0*.sql; do
    if [ -f "$file" ]; then
        TOTAL=$((TOTAL + 1))
        echo -e "${YELLOW}Running: $file${NC}"
        
        # Run the migration
        if psql "$DB_URL" -f "$file" -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Success${NC}"
            SUCCESS=$((SUCCESS + 1))
        else
            echo -e "${RED}✗ Failed (may be already applied)${NC}"
            FAILED=$((FAILED + 1))
        fi
        echo ""
    fi
done

echo -e "${YELLOW}===========================================${NC}"
echo -e "${GREEN}Migration Summary:${NC}"
echo -e "  Total files: $TOTAL"
echo -e "  ${GREEN}Successful: $SUCCESS${NC}"
echo -e "  ${RED}Failed/Skipped: $FAILED${NC}"
echo -e "${YELLOW}===========================================${NC}"

if [ $SUCCESS -gt 0 ]; then
    echo -e "${GREEN}✅ Migrations complete!${NC}"
else
    echo -e "${YELLOW}⚠️  No new migrations applied${NC}"
fi

