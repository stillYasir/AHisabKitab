import { Invoice, User } from '../types';

const USER_KEY = 'hisaab_current_user';
const DATA_PREFIX = 'hisaab_data_';

export const storageService = {
  // Auth
  login: (username: string, password: string): Promise<User> => {
    return new Promise((resolve) => {
      // Simulating network delay
      setTimeout(() => {
        // In a real app, verify password. Here we just mock persistence.
        localStorage.setItem(USER_KEY, JSON.stringify({ username }));
        resolve({ username });
      }, 500);
    });
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  // Invoices
  getInvoices: (username: string): Invoice[] => {
    const data = localStorage.getItem(`${DATA_PREFIX}${username}`);
    return data ? JSON.parse(data) : [];
  },

  saveInvoice: (username: string, invoice: Invoice): void => {
    const invoices = storageService.getInvoices(username);
    const existingIndex = invoices.findIndex((inv) => inv.id === invoice.id);
    
    if (existingIndex >= 0) {
      invoices[existingIndex] = invoice;
    } else {
      invoices.push(invoice);
    }
    
    localStorage.setItem(`${DATA_PREFIX}${username}`, JSON.stringify(invoices));
  },

  deleteInvoice: (username: string, invoiceId: string): void => {
    const invoices = storageService.getInvoices(username);
    const updated = invoices.filter(inv => inv.id !== invoiceId);
    localStorage.setItem(`${DATA_PREFIX}${username}`, JSON.stringify(updated));
  }
};