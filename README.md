# TREN-TOTP
<div>
    <img src="https://img.shields.io/badge/html5-%23E34F26.svg?style=flat&logo=html5&logoColor=white" alt="HTML"/>
    <img src="https://img.shields.io/badge/javascript-%23323330.svg?style=flat&logo=javascript&logoColor=%23F7DF1E" alt="JavaScript"/>
    <img src="https://img.shields.io/badge/css3-%231572B6.svg?style=flat&logo=css3&logoColor=white" alt="CSS"/>
</div>

## Table of Contents
- [Introduction](#introduction)
- [Disclaimer](#disclaimer)
- [Installation](#installation)
- [Usage](#usage)
    - [Features](#features)
- [Getting Your Secret from Google Authenticator](#getting-your-secret-from-google-authenticator)

## Introduction

**TREN-TOTP** is a lightweight browser extension built to simplify two-factor authentication for the [University of Trento](https://www.unitn.it) portal. Once configured, it automatically generates and inserts TOTP (Time-based One-Time Password) codes whenever prompted by the university's authentication system.

This means you no longer need to manually open an authenticator app or copy and paste codes; the extension handles it for you.

## Disclaimer

This extension does not implement additional security measures to protect your TOTP secret. As visible in the source code, the secret is stored using your browser's local storage. While this is sufficient for the intended purpose of the project, it is not considered a best practice for secure storage of sensitive information. Use at your own discretion.

## Installation

Since the extension is not available on any browser store, it must be installed manually as an unpacked extension:

1. Open your browser’s **Extensions** page (e.g., `chrome://extensions/` for Chrome).
2. Enable **Developer Mode**.
3. Click **"Load unpacked"** and select the `tren-totp` folder containing the extension files.

## Usage

After installation:

1. Click the extension icon in your browser toolbar to open the popup.
2. On first use, click the **Settings (gear) icon**.
3. Paste your **base32 TOTP secret** into the input field and save it.

You can return to this page anytime to update the secret.

### Features:
- Your current TOTP code is displayed in the popup.
- Click the code to **copy it to the clipboard**.
- The code will **blink five seconds before expiration**, giving you a visual cue.
- A **progress bar at the bottom** indicates the remaining validity time.
- When accessing the University of Trento authentication portal (`https://idp.unitn.it/idp/profile/SAML2/Redirect/SSO*`), the extension will **automatically fill in the TOTP field** during login.

## Getting Your Secret from Google Authenticator

If you use **Google Authenticator** and need to extract your TOTP secret:

1. Open the app and tap the **menu (☰)**.
2. Select **"Export accounts"**, and choose your `idp.unitn.it` account.
3. Take a **screenshot of the generated QR code**.
4. Upload the screenshot to the [TOTP QR Code Secret Extractor](https://christiansassi.github.io/tren-totp/) to retrieve your secret key.

---
Made with ❤️ for the University of Trento community.
