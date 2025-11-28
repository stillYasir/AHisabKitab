import React, { useState, useEffect } from 'react';
import { Invoice, User, InvoiceStatus } from '../types';
import { storageService } from '../services/storageService';
import { Button } from './Button';
import { Plus, FileText, Search, LogOut, Loader } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onSelectInvoice: (invoiceId: string | null) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onSelectInvoice }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = () => {
      setLoading(true);
      const data = storageService.getInvoices(user.username);
      // Sort by date descending
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setInvoices(data);
      setLoading(false);
    };
    loadData();
  }, [user.username]);

  const filteredInvoices = invoices.filter(inv => 
    inv.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.date.includes(searchTerm)
  );

  const toggleStatus = (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation();
    const updatedInvoice = {
      ...invoice,
      status: invoice.status === InvoiceStatus.PAID ? InvoiceStatus.PENDING : InvoiceStatus.PAID
    };
    storageService.saveInvoice(user.username, updatedInvoice);
    setInvoices(invoices.map(inv => inv.id === invoice.id ? updatedInvoice : inv));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400">Welcome back, {user.username}</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={onLogout} size="sm">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
            <Button onClick={() => onSelectInvoice(null)}>
              <Plus className="w-4 h-4 mr-2" /> Create Invoice
            </Button>
          </div>
        </header>

        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-md leading-5 bg-slate-800 placeholder-slate-500 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search invoices by name or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-20 bg-slate-800 rounded-lg border border-slate-700">
            <FileText className="mx-auto h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No invoices found</h3>
            <p className="mt-1 text-slate-500">Get started by creating a new invoice.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInvoices.map((invoice) => (
              <div 
                key={invoice.id} 
                className="bg-slate-800 rounded-lg border border-slate-700 p-5 hover:border-blue-500 transition-colors cursor-pointer group shadow-lg"
                onClick={() => onSelectInvoice(invoice.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">{invoice.name}</h3>
                    <p className="text-sm text-slate-400">{new Date(invoice.date).toLocaleDateString()}</p>
                  </div>
                  <button 
                    onClick={(e) => toggleStatus(e, invoice)}
                    className={`px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                      invoice.status === InvoiceStatus.PAID 
                        ? 'bg-green-900 text-green-200 border border-green-700' 
                        : 'bg-yellow-900 text-yellow-200 border border-yellow-700'
                    }`}
                  >
                    {invoice.status}
                  </button>
                </div>
                
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span>Items:</span>
                    <span>{invoice.items.length}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total Amount:</span>
                    <span className="text-white">Rs. {invoice.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-700 mt-2">
                    <span className="font-bold text-slate-200">Balance:</span>
                    <span className={`font-bold ${invoice.remainingBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      Rs. {invoice.remainingBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};