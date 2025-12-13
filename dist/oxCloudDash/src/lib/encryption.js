/**
 * Encryption utilities for OxView Sync & Share functionality
 * Provides encryption/decryption services using JWT token as encryption key
 */
import { decode } from 'jsonwebtoken';
// Encryption configuration
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_DERIVATION_SALT = 'oxview-encryption-salt-v1';
const IV_LENGTH = 12; // 96 bits for AES-GCM
const TAG_LENGTH = 16; // 128 bits for GCM tag
/**
 * Derive encryption key from JWT token
 * Uses PBKDF2 to derive a stable key from the token
 */
export async function deriveKeyFromToken(token) {
    try {
        // Check if crypto.subtle is available (requires secure context)
        if (!crypto.subtle) {
            throw new Error('Web Crypto API is not available. Please use HTTPS or localhost.');
        }
        // Decode token to get payload (used as additional entropy)
        const decoded = decode(token);
        if (!decoded || !decoded.exp) {
            throw new Error('Invalid token structure');
        }
        // Create a base key material from token + salt + expiration
        const keyMaterial = `${token}:${KEY_DERIVATION_SALT}:${decoded.exp}`;
        // Convert to ArrayBuffer
        const encoder = new TextEncoder();
        const keyData = encoder.encode(keyMaterial);
        // Import the key material
        const baseKey = await crypto.subtle.importKey('raw', keyData, 'PBKDF2', false, ['deriveKey']);
        // Derive AES-GCM key
        const salt = encoder.encode(KEY_DERIVATION_SALT);
        return await crypto.subtle.deriveKey({
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        }, baseKey, {
            name: ENCRYPTION_ALGORITHM,
            length: 256
        }, false, ['encrypt', 'decrypt']);
    }
    catch (error) {
        console.error('Failed to derive encryption key:', error);
        throw new Error('Failed to derive encryption key from token');
    }
}
/**
 * Encrypt data using the provided key
 */
export async function encryptData(data, key) {
    try {
        // Check if crypto.subtle is available (requires secure context)
        if (!crypto.subtle) {
            throw new Error('Web Crypto API is not available. Please use HTTPS or localhost.');
        }
        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        // Encrypt the data
        const encryptedData = await crypto.subtle.encrypt({
            name: ENCRYPTION_ALGORITHM,
            iv: iv
        }, key, data);
        return {
            encryptedData,
            iv: iv.buffer
        };
    }
    catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}
/**
 * Decrypt data using the provided key and IV
 */
export async function decryptData(encryptedData, key, iv) {
    try {
        // Check if crypto.subtle is available (requires secure context)
        if (!crypto.subtle) {
            throw new Error('Web Crypto API is not available. Please use HTTPS or localhost.');
        }
        const decryptedData = await crypto.subtle.decrypt({
            name: ENCRYPTION_ALGORITHM,
            iv: iv
        }, key, encryptedData);
        return decryptedData;
    }
    catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data');
    }
}
/**
 * Encrypt commit data for storage
 */
export async function encryptCommitData(commitData, token) {
    const key = await deriveKeyFromToken(token);
    return await encryptData(commitData, key);
}
/**
 * Decrypt commit data from storage
 */
export async function decryptCommitData(encryptedData, iv, token) {
    const key = await deriveKeyFromToken(token);
    return await decryptData(encryptedData, key, iv);
}
/**
 * Check if token is valid for encryption
 */
export function isTokenValidForEncryption(token) {
    try {
        const decoded = decode(token);
        if (!decoded || !decoded.exp) {
            return false;
        }
        // Check if token is expired (with 5 minute buffer)
        const now = Date.now() / 1000;
        return decoded.exp > (now - 300);
    }
    catch (error) {
        console.error('Token validation failed:', error);
        return false;
    }
}
/**
 * Re-encrypt projects with new token (for token refresh scenarios)
 */
export async function reencryptWithNewToken(oldToken, newToken) {
    try {
        if (!isTokenValidForEncryption(newToken)) {
            throw new Error('New token is not valid for encryption');
        }
        // This would need to be called from a context where we have access to the database
        // For now, we'll provide the function signature and implementation
        console.log('Re-encryption with new token requested');
        // In a real implementation, this would:
        // 1. Decrypt all encrypted projects with old token
        // 2. Re-encrypt them with new token
        // 3. Update the database
    }
    catch (error) {
        console.error('Failed to re-encrypt with new token:', error);
        throw error;
    }
}
/**
 * Clear sensitive data from memory
 */
export function clearSensitiveData() {
    // In browser environment, we can't directly clear memory
    // but we can help garbage collection by nulling references
    if (typeof window !== 'undefined') {
        // Force garbage collection hint (not guaranteed in all browsers)
        if (window.gc) {
            window.gc();
        }
    }
}
/**
 * Encrypt a commit for storage
 */
export async function encryptCommit(commit, token) {
    const { encryptedData, iv } = await encryptCommitData(commit.data, token);
    return {
        encryptedData,
        iv,
        originalCommitId: commit.commitId,
        originalCommitName: commit.commitName,
        originalParent: commit.parent,
        originalCreatedAt: commit.createdAt
    };
}
/**
 * Decrypt a commit from storage
 */
export async function decryptCommit(encryptedCommit, token) {
    const decryptedData = await decryptCommitData(encryptedCommit.encryptedData, encryptedCommit.iv, token);
    return {
        data: decryptedData,
        commitId: encryptedCommit.originalCommitId,
        commitName: encryptedCommit.originalCommitName,
        parent: encryptedCommit.originalParent,
        createdAt: encryptedCommit.originalCreatedAt
    };
}
