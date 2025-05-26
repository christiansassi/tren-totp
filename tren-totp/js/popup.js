class TOTPGenerator {
    constructor() {
        this.secret = null;
        this.currentView = "main";
        this.totpInterval = null;
        this.init();
    }

    async init() {
        await this.loadSecret();
        this.setupEventListeners();
        this.updateDisplay();
        if (this.secret) {
            this.startTOTPUpdate();
        }
    }

    async loadSecret() {
        try {
            const result = await chrome.storage.local.get(["totpSecret"]);
            this.secret = result.totpSecret || null;
        } catch (error) {
            console.error("Error loading secret:", error);
        }
    }

    async saveSecret(secret) {
        try {
            await chrome.storage.local.set({ totpSecret: secret });
            this.secret = secret;
        } catch (error) {
            console.error("Error saving secret:", error);
        }
    }

    setupEventListeners() {
        // Settings button
        document.getElementById("settingsBtn").addEventListener("click", () => {
            this.showSettings();
        });

        // Back button
        document.getElementById("backBtn").addEventListener("click", () => {
            this.showMain();
        });

        // Secret input validation
        const secretInput = document.getElementById("secretInput");
        secretInput.addEventListener("input", (e) => {
            this.validateSecret(e.target.value);
        });

        // Save button
        document.getElementById("saveBtn").addEventListener("click", () => {
            this.handleSave();
        });

        // TOTP click to copy
        document.getElementById("totpDisplay").addEventListener("click", () => {
            this.copyTOTP();
        });
    }

    showSettings() {
        document.getElementById("mainView").style.display = "none";
        document.getElementById("settingsView").style.display = "flex";
        this.currentView = "settings";
        document.getElementById("secretInput").focus();
    }

    showMain() {
        document.getElementById("settingsView").style.display = "none";
        document.getElementById("mainView").style.display = "flex";
        this.currentView = "main";
        document.getElementById("secretInput").value = "";
        document.getElementById("saveBtn").disabled = true;
    }

    validateSecret(secret) {
        const saveBtn = document.getElementById("saveBtn");
        const cleanSecret = secret.trim().replace(/\s/g, "").toUpperCase();
        const isValid = this.isValidBase32(cleanSecret);
        saveBtn.disabled = !cleanSecret || !isValid;
    }

    isValidBase32(str) {
        // Remove spaces and convert to uppercase
        str = str.replace(/\s/g, "").toUpperCase();
        
        // Base32 alphabet
        const base32Regex = /^[A-Z2-7]+$/;
        
        // Check if string matches base32 pattern and has reasonable length
        // Most TOTP secrets are between 16-32 characters, but we'll be more flexible
        return base32Regex.test(str) && str.length >= 8;
    }

    async handleSave() {
        const secretInput = document.getElementById("secretInput");
        const secret = secretInput.value.trim().replace(/\s/g, "").toUpperCase();
        
        // First check if it's valid base32
        if (!this.isValidBase32(secret)) {
            this.showInvalidSecretAnimation();
            return; // Don't proceed further
        }

        try {
            // Test if the secret can generate a valid TOTP
            const testTOTP = this.testTOTPGeneration(secret);
            if (testTOTP && testTOTP !== "ERROR") {
                // Only save and navigate if TOTP generation is successful
                await this.saveSecret(secret);
                this.showMain(); // Go back to main screen only on success
                this.updateDisplay();
                this.startTOTPUpdate();
            } else {
                // Invalid secret - show shake animation and stay on settings
                this.showInvalidSecretAnimation();
            }
        } catch (error) {
            console.error("Error testing TOTP generation:", error);
            this.showInvalidSecretAnimation();
        }
    }

    showInvalidSecretAnimation() {
        const secretInput = document.getElementById("secretInput");
        
        // Add shake class
        secretInput.classList.add("shake");
        
        // Remove shake class after animation completes
        setTimeout(() => {
            secretInput.classList.remove("shake");
        }, 500);
    }

    testTOTPGeneration(secret) {
        try {
            const time = Math.floor(Date.now() / 1000);
            const timeStep = Math.floor(time / 30);
            
            // Convert base32 secret to bytes
            const secretBytes = this.base32ToBytes(secret);
            
            // Convert time step to 8-byte array
            const timeBuffer = new ArrayBuffer(8);
            const timeView = new DataView(timeBuffer);
            timeView.setUint32(4, timeStep, false); // Big-endian
            
            // HMAC-SHA1
            const hmac = new jsSHA("SHA-1", "ARRAYBUFFER");
            hmac.setHMACKey(secretBytes, "ARRAYBUFFER");
            hmac.update(timeBuffer);
            const hash = hmac.getHMAC("ARRAYBUFFER");
            
            // Dynamic truncation
            const hashArray = new Uint8Array(hash);
            const offset = hashArray[19] & 0xf;
            const code = ((hashArray[offset] & 0x7f) << 24) |
                        ((hashArray[offset + 1] & 0xff) << 16) |
                        ((hashArray[offset + 2] & 0xff) << 8) |
                        (hashArray[offset + 3] & 0xff);
            
            const otp = (code % 1000000).toString().padStart(6, "0");
            return otp;
        } catch (error) {
            return "ERROR";
        }
    }

    updateDisplay() {
        const totpDisplay = document.getElementById("totpDisplay");
        const noTotpMessage = document.getElementById("noTotpMessage");
        const progressBar = document.getElementById("progressBar");

        if (this.secret) {
            const totp = this.generateTOTP();
            totpDisplay.textContent = totp;
            totpDisplay.style.display = "block";
            noTotpMessage.style.display = "none";
            
            // Calculate time remaining and progress
            const time = Math.floor(Date.now() / 1000);
            const timeRemaining = 30 - (time % 30);
            const progress = ((30 - timeRemaining) / 30) * 100;
            
            // Update progress bar
            progressBar.style.width = progress + "%";
            
            // Check if we're in the last 5 seconds of the 30-second cycle
            if (timeRemaining <= 5) {
                totpDisplay.classList.add("expiring");
            } else {
                totpDisplay.classList.remove("expiring");
            }
        } else {
            totpDisplay.style.display = "none";
            noTotpMessage.style.display = "block";
            progressBar.style.width = "0%";
        }
    }

    generateTOTP() {
        if (!this.secret) return "000000";

        try {
            const time = Math.floor(Date.now() / 1000);
            const timeStep = Math.floor(time / 30);
            
            // Convert base32 secret to bytes
            const secretBytes = this.base32ToBytes(this.secret);
            
            // Convert time step to 8-byte array
            const timeBuffer = new ArrayBuffer(8);
            const timeView = new DataView(timeBuffer);
            timeView.setUint32(4, timeStep, false); // Big-endian
            
            // HMAC-SHA1
            const hmac = new jsSHA("SHA-1", "ARRAYBUFFER");
            hmac.setHMACKey(secretBytes, "ARRAYBUFFER");
            hmac.update(timeBuffer);
            const hash = hmac.getHMAC("ARRAYBUFFER");
            
            // Dynamic truncation
            const hashArray = new Uint8Array(hash);
            const offset = hashArray[19] & 0xf;
            const code = ((hashArray[offset] & 0x7f) << 24) |
                        ((hashArray[offset + 1] & 0xff) << 16) |
                        ((hashArray[offset + 2] & 0xff) << 8) |
                        (hashArray[offset + 3] & 0xff);
            
            const otp = (code % 1000000).toString().padStart(6, "0");
            return otp;
        } catch (error) {
            console.error("Error generating TOTP:", error);
            return "ERROR";
        }
    }

    base32ToBytes(base32) {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let bits = "";
        
        // Convert each character to 5-bit binary
        for (let i = 0; i < base32.length; i++) {
            const char = base32[i];
            const index = alphabet.indexOf(char);
            if (index === -1) throw new Error("Invalid base32 character");
            bits += index.toString(2).padStart(5, "0");
        }
        
        // Convert bits to bytes
        const bytes = [];
        for (let i = 0; i < bits.length; i += 8) {
            if (i + 8 <= bits.length) {
                const byte = parseInt(bits.substr(i, 8), 2);
                bytes.push(byte);
            }
        }
        
        return new Uint8Array(bytes).buffer;
    }

    startTOTPUpdate() {
        // Clear existing interval
        if (this.totpInterval) {
            clearInterval(this.totpInterval);
        }
        
        // Update immediately
        this.updateDisplay();
        
        // Update every second
        this.totpInterval = setInterval(() => {
            this.updateDisplay();
        }, 1000);
    }

    async copyTOTP() {
        if (!this.secret) return;
        
        const totp = this.generateTOTP();
        try {
            await navigator.clipboard.writeText(totp);
            // Visual feedback could be added here
        } catch (error) {
            console.error("Failed to copy TOTP:", error);
        }
    }
}

// Initialize the TOTP generator when the popup loads
document.addEventListener("DOMContentLoaded", () => {
    new TOTPGenerator();
});