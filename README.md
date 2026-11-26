# College Event Management System - MITS

## Folder structure
    college-event-system/
    |-- web/                      <- the website (front-end)
    |   |-- index.html            open this file to run the app
    |   |-- css/style.css
    |   |-- js/login.js           login + OTP screen
    |   |-- js/app.js             dashboard and all menu options
    |   `-- images/mits_logo.jpg
    |-- backend/                  <- C program for login + email OTP
    |   |-- auth_otp.c
    |   |-- users.data
    |   `-- README.md
    `-- data/                     <- sample record files
        |-- events.data
        `-- students.data

## 1. Run the website
Double-click `web/index.html`. Keep the folders as they are.
Admin sign-in uses the account you configure with the `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables (see [DEPLOY.md](DEPLOY.md)). Demo student login: `student` / `student123`.
The OTP code is shown on screen in demo mode.

## 1b. Deploy online (Vercel + Render)
See [DEPLOY.md](DEPLOY.md): the website runs on Vercel, the Node backend on Render.

## 2. Run the C backend (optional)
    cd backend
    gcc auth_otp.c -o auth
    ./auth
See backend/README.md for sending real emails and adding users.

## 3. Load the record files
Log in as admin, open "Record files", and import data/events.data and data/students.data.

`events.data` format: `ID|Name|Date|Venue|Seats|Paid` where the last column is `1` for a paid event and `0` for a free event. Free events mark every registration as paid automatically.
