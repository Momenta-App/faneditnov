# Simple Auth Setup Instructions

The simple authentication system requires a database table to be created. Follow these steps:

## Step 1: Run the SQL Migration

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `sql/039_simple_auth_users.sql`
4. Click **Run** (or press Cmd/Ctrl + Enter)

Alternatively, you can copy this SQL directly:

```sql
CREATE TABLE IF NOT EXISTS simple_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simple_users_email ON simple_users(email);

INSERT INTO simple_users (email, password_hash)
VALUES (
  'admin@momenta.app',
  '$2b$10$8hmd/0ohTWeGm/JSFH70T.VDBCAatOBxYIVNfsu1Ah2YKekjLhEOi'
)
ON CONFLICT (email) DO NOTHING;
```

## Step 2: Verify Setup

After running the SQL, you can verify it worked by running:

```bash
npx tsx scripts/check-simple-auth.ts
```

This will check if the table exists and if password verification works.

## Login Credentials

- **Email:** `admin@momenta.app`
- **Password:** `Morning-fire444%`

## Troubleshooting

If you get "invalid credentials" after running the migration:

1. Verify the table was created:
   ```sql
   SELECT * FROM simple_users;
   ```

2. Check that the user exists:
   ```sql
   SELECT email FROM simple_users WHERE email = 'admin@momenta.app';
   ```

3. If the user doesn't exist, run the INSERT statement again.

4. If you need to regenerate the password hash, run:
   ```bash
   node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Morning-fire444%', 10).then(hash => console.log(hash));"
   ```
   Then update the SQL file with the new hash and re-run the migration.

