@echo off
title Share ElderCare Website Globally via Serveo
cls
echo ==========================================================
echo      ElderCare Website Public Sharing Utility (Serveo)
echo ==========================================================
echo.
echo [1] Checking SSH Key...

if not exist "%USERPROFILE%\.ssh\id_rsa" (
    echo [*] Generating a new SSH key pair...
    ssh-keygen -t rsa -b 2048 -N "" -f "%USERPROFILE%\.ssh\id_rsa"
    echo [v] SSH key generated successfully!
) else (
    echo [v] SSH key already exists.
)

echo.
echo [2] How Serveo Custom Subdomains Work:
echo.
echo     To use the fixed subdomain "eldercare-match-rossarin.serveo.net",
echo     you MUST register your SSH public key.
echo.
echo     - IF NOT REGISTERED: Serveo will assign you a RANDOM url (e.g. xxxx.serveo.net).
echo     - HOW TO REGISTER: Look at the text below. Serveo will output a link like:
echo       "https://console.serveo.net/ssh/keys?add=..."
echo       Copy that link, open it in your browser, and sign in with Google/GitHub to register your key.
echo       Once registered, close this window and run this script again!
echo.
echo ----------------------------------------------------------
echo Connecting to Serveo tunnel...
echo ----------------------------------------------------------
echo.

ssh -o StrictHostKeyChecking=accept-new -R eldercare-match-rossarin:80:localhost:5173 serveo.net

echo.
echo ----------------------------------------------------------
echo [!] If this window is closed, the public link will stop working.
pause
