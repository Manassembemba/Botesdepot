#!/bin/bash
echo "Checking migration status..."
npx supabase migration list

echo ""
echo "Applying remaining migrations..."
npx supabase db push --yes

echo ""
echo "Migration complete! Now test the checkout system."
