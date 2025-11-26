const STORAGE_KEY = 'cgpa_calculator_data';

function saveToStorage(data) {
    try {
        const dataToSave = {
            ...data,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

function loadFromStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return null;
    }
}

function clearStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Error clearing localStorage:', error);
        return false;
    }
}

function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (error) {
        return false;
    }
}