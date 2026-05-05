#!/bin/sh
# DEV entrypoint: runs migrate + generate before starting the API.
# In production, migrations should run as a separate CI/CD step.

echo "🔄 Running Prisma migrate deploy..."
if npx prisma migrate deploy; then
  echo "✅ Migrations applied"
else
  echo "⚠️  Migration failed — API will start but may have schema issues"
  echo "⚠️  Debug: docker exec travel-api npx prisma migrate status"
fi

echo "🔄 Regenerating Prisma Client..."
npx prisma generate || { echo "❌ prisma generate failed"; exit 1; }

echo "🚀 Starting API server..."
exec "$@"
