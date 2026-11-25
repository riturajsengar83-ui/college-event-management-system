# Login + OTP backend (C)

## Files
- `auth_otp.c`  login with username or email, password check, email OTP (2-step login)
- `users.data`  sample users: `username|email|role|salt|hash`

## Build and run
    gcc auth_otp.c -o auth
    ./auth

Sample logins: `admin` or `admin@mits.ac.in` / `admin123`; `student` or `student@mits.ac.in` / `student123`.

## Add a user
    ./auth --hash rahul rahul@mits.ac.in student MyPass123 >> users.data

## Send real emails (optional)
Set these before running (Gmail needs an "app password"):

    export SMTP_URL=smtps://smtp.gmail.com:465
    export SMTP_USER=yourname@gmail.com
    export SMTP_PASS=your-app-password
    export SMTP_FROM=yourname@gmail.com

On Windows (cmd) use `set` instead of `export`. `curl` must be installed.
Without these settings the program runs in demo mode and prints the code.

## Use it in your project
`int login_with_otp(char *role_out)` returns 1 on success and gives "admin" or "student".
Call it at the start of your main(), then open the matching menu.

## Connecting the web page later (API plan)
The C program would run behind a small HTTP server (e.g. libmicrohttpd or Mongoose):

| Step | Request | Server does |
|------|---------|-------------|
| 1 | POST /api/login {id, password} | check password, create OTP, email it, return a short-lived `loginToken` |
| 2 | POST /api/verify {loginToken, otp} | check the code, expiry and attempts, return a session token |
| 3 | POST /api/resend {loginToken} | new code, only after the 30 second wait |

The web page then sends the session token with every later request. Keep the OTP only on the server, never in the page.
