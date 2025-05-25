// Base32 encoding utilities
const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
    let result = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            result += base32Chars[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        result += base32Chars[(value << (5 - bits)) & 31];
    }

    // Add padding
    while (result.length % 8 !== 0) {
        result += '=';
    }

    return result;
}

// Base64 URL-safe decoding
function base64UrlDecode(str) {
    // Add padding if needed
    str += '='.repeat((4 - str.length % 4) % 4);
    // Replace URL-safe characters
    str = str.replace(/-/g, '+').replace(/_/g, '/');

    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Protobuf parsing (simplified for this specific use case)
function parseProtobuf(buffer) {
    const view = new DataView(buffer.buffer);
    let offset = 0;
    const otpParameters = [];

    while (offset < buffer.length) {
        const tag = buffer[offset++];
        const fieldNumber = tag >> 3;
        const wireType = tag & 0x07;

        if (fieldNumber === 1 && wireType === 2) { // OTP parameters
            const length = buffer[offset++];
            const otpData = buffer.slice(offset, offset + length);
            const otp = parseOtpParameter(otpData);
            if (otp) {
                otpParameters.push(otp);
            }
            offset += length;
        } else {
            // Skip unknown fields
            if (wireType === 0) { // varint
                while (buffer[offset] & 0x80) offset++;
                offset++;
            } else if (wireType === 2) { // length-delimited
                const length = buffer[offset++];
                offset += length;
            } else {
                break; // Unknown wire type
            }
        }
    }

    return { otpParameters };
}

function parseOtpParameter(buffer) {
    let secret = null;
    let issuer = null;
    let offset = 0;

    while (offset < buffer.length) {
        const tag = buffer[offset++];
        const fieldNumber = tag >> 3;
        const wireType = tag & 0x07;

        if (fieldNumber === 1 && wireType === 2) { // secret
            const length = buffer[offset++];
            secret = buffer.slice(offset, offset + length);
            offset += length;
        } else if (fieldNumber === 3 && wireType === 2) { // issuer
            const length = buffer[offset++];
            const issuerBytes = buffer.slice(offset, offset + length);
            issuer = new TextDecoder().decode(issuerBytes);
            offset += length;
        } else {
            // Skip other fields
            if (wireType === 0) { // varint
                while (offset < buffer.length && buffer[offset] & 0x80) offset++;
                if (offset < buffer.length) offset++;
            } else if (wireType === 2) { // length-delimited
                if (offset < buffer.length) {
                    const length = buffer[offset++];
                    offset += length;
                }
            } else {
                break;
            }
        }
    }

    return secret ? { secret, issuer } : null;
}

// File handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const loading = document.getElementById('loading');
const resultArea = document.getElementById('resultArea');
const secretValue = document.getElementById('secretValue');
const errorMessage = document.getElementById('errorMessage');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFile);

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFile(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file.');
        return;
    }

    clearResults();
    showLoading(true);

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            showPreview(e.target.result);
            processQRCode(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function processQRCode(img) {
    try {
        // Create canvas to extract image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Decode QR code
        const qrResult = jsQR(imageData.data, imageData.width, imageData.height);

        if (!qrResult) {
            throw new Error('No QR code found in the image. Please make sure the image contains a clear QR code.');
        }

        // Parse the otpauth-migration URL
        const url = qrResult.data;
        if (!url.startsWith('otpauth-migration://offline?data=')) {
            throw new Error('This QR code does not contain Google Authenticator migration data.');
        }

        // Extract base64 data
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const base64Data = urlParams.get('data');

        if (!base64Data) {
            throw new Error('No migration data found in the QR code.');
        }

        // Decode protobuf
        const binaryData = base64UrlDecode(base64Data);
        const payload = parseProtobuf(binaryData);

        // Find the secret for idp.unitn.it
        let foundSecret = null;
        for (const otp of payload.otpParameters) {
            if (otp.issuer === 'idp.unitn.it') {
                foundSecret = base32Encode(otp.secret);
                break;
            }
        }

        if (!foundSecret) {
            throw new Error('No TOTP secret found for idp.unitn.it in this QR code.');
        }

        showResult(foundSecret);

    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function showPreview(src) {
    previewImage.src = src;
    previewImage.classList.add('show');
}

function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
}

function showResult(secret) {
    secretValue.textContent = secret;
    resultArea.classList.add('show');
    
    // Add click event to secret value for copying
    secretValue.addEventListener('click', () => copyToClipboard(secret));
}

function showError(message) {
    errorMessage.innerHTML = `<div class="error"><strong>Error:</strong> ${message}</div>`;
    setTimeout(() => {
        errorMessage.innerHTML = '';
    }, 10000);
}

function clearResults() {
    resultArea.classList.remove('show');
    previewImage.classList.remove('show');
    errorMessage.innerHTML = '';
}

function copySecret() {
    const secret = secretValue.textContent;
    copyToClipboard(secret);
}

function copyToClipboard(secret) {
    const btn = document.querySelector('.copy-btn');
    const originalText = btn.innerHTML;
    
    navigator.clipboard.writeText(secret).then(() => {
        // Success animation
        btn.innerHTML = '✅ Copied!';
        btn.classList.add('copied');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = secret;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Success animation (fallback)
        btn.innerHTML = '✅ Copied!';
        btn.classList.add('copied');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('copied');
        }, 2000);
    });
}