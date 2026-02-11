/* ========================================
   StorageService
   Generic localStorage CRUD wrapper
   ======================================== */

class StorageService {
    constructor(prefix = 'diceGames_') {
        this.prefix = prefix;
        this.available = this._checkAvailability();
    }

    _checkAvailability() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, 'ok');
            localStorage.removeItem(test);
            return true;
        } catch {
            console.warn('localStorage non disponibile, i dati non saranno salvati.');
            return false;
        }
    }

    _key(key) {
        return key.startsWith(this.prefix) ? key : this.prefix + key;
    }

    get(key, defaultValue = null) {
        if (!this.available) return defaultValue;
        try {
            const raw = localStorage.getItem(this._key(key));
            if (raw === null) return defaultValue;
            return JSON.parse(raw);
        } catch {
            return defaultValue;
        }
    }

    set(key, value) {
        if (!this.available) return false;
        try {
            localStorage.setItem(this._key(key), JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('Errore salvataggio localStorage:', e.message);
            return false;
        }
    }

    remove(key) {
        if (!this.available) return;
        localStorage.removeItem(this._key(key));
    }

    getAll(filterPrefix = '') {
        if (!this.available) return {};
        const result = {};
        const fullPrefix = this._key(filterPrefix);
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith(fullPrefix)) {
                try {
                    result[k] = JSON.parse(localStorage.getItem(k));
                } catch {
                    result[k] = localStorage.getItem(k);
                }
            }
        }
        return result;
    }

    clear() {
        if (!this.available) return;
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith(this.prefix)) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    }
}

// Singleton instance
export const storage = new StorageService();
export default StorageService;
