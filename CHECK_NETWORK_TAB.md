# How to See the Exact Error

The console shows "Database error saving new user" but we need the **actual Supabase error**.

## Step-by-Step:

1. **Open DevTools** (F12)
2. Go to **Network** tab (NOT Console)
3. **Clear** the network log (trash icon or Cmd/Ctrl + Shift + E)
4. **Try signing up** again
5. Look for `/api/auth/signup` in the network list
6. **Click on it** to open details
7. Click the **Response** tab (or **Preview** tab)

**You'll see something like:**
```json
{
  "error": "User already registered",
  "code": "AUTH_ERROR"
}
```

OR

```json
{
  "error": "Password should be at least 6 characters",
  "code": "AUTH_ERROR"
}
```

**Copy that exact JSON response and share it!**

## Also Check Terminal

Look at the terminal where you're running `pnpm dev`:
- You should see: `Supabase Auth signup error:`
- Copy that error message too

---

The 400 error means Supabase Auth is rejecting the request. Common causes:
- Email already exists
- Password too short
- Email format invalid
- Supabase auth settings misconfigured

