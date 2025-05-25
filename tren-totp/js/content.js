class TOTPAutoFiller {
    constructor() {
        this.secret = null;
        this.init();
    }

    async init() {
        await this.loadSecret();
        if (this.secret) {
            this.fillTOTPCode();
        }
    }

    async loadSecret() {
        try {
            const result = await chrome.storage.local.get(["trentotpSecret"]);
            this.secret = result.trentotpSecret || null;
        } catch (error) {
            console.error("Error loading secret:", error);
        }
    }

    fillTOTPCode() {
        const tokenElement = document.getElementById("tokencode");
        if (tokenElement && this.secret) {
            const totpCode = this.generateTOTP();
            tokenElement.value = totpCode;
            
            // Trigger input event to ensure the form recognizes the change
            tokenElement.dispatchEvent(new Event("input", { bubbles: true }));
            tokenElement.dispatchEvent(new Event("change", { bubbles: true }));

        } else if (!tokenElement) {
            // If element not found immediately, try again after a short delay
            setTimeout(() => this.fillTOTPCode(), 500);
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
}

// Initialize the auto-filler when the page loads
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        new TOTPAutoFiller();
    });
} else {
    new TOTPAutoFiller();
}