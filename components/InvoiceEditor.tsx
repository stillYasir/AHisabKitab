import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Invoice, InvoiceItem, PaymentRow, InvoiceStatus, User } from '../types';
import { storageService } from '../services/storageService';
import { Button } from './Button';
import { ArrowLeft, Save, Plus, Download, Trash2, Copy, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { v4 as uuidv4 } from 'uuid'; // We'll implement a simple ID generator since uuid package isn't guaranteed
// Simple UUID fallback
const generateId = () => Math.random().toString(36).substring(2, 9);

interface InvoiceEditorProps {
  user: User;
  existingInvoiceId: string | null;
  onBack: () => void;
}

export const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ user, existingInvoiceId, onBack }) => {
  // --- State ---
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState<InvoiceStatus>(InvoiceStatus.PENDING);
  const [isSaving, setIsSaving] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    if (existingInvoiceId) {
      const allInvoices = storageService.getInvoices(user.username);
      const found = allInvoices.find(i => i.id === existingInvoiceId);
      if (found) {
        setInvoiceName(found.name);
        setInvoiceDate(found.date);
        setItems(found.items);
        setPayments(found.payments);
        setStatus(found.status);
      }
    } else {
      // Start with one empty row
      addNewRow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingInvoiceId, user.username]);

  // --- Calculations ---

  const calculateRow = (item: InvoiceItem): InvoiceItem => {
    // 1. Calculate TP: Rate - 14.5%
    const tp = item.rate > 0 ? item.rate * (1 - 0.145) : 0;
    
    // 2. Logic for Discount/Extra Charge
    let finalUnit = tp;
    
    if (item.discount !== 0) {
      // Base for Discount logic = TP - 15% (fixed)
      const baseForDiscount = tp * (1 - 0.15);
      
      // If Discount is negative (-X%), implies EXTRA DISCOUNT on the base.
      // If Discount is positive (+X%), implies EXTRA CHARGE on the base.
      // Math: Base * (1 + (X/100)) handles both signs correctly relative to addition/subtraction algebra, 
      // BUT Prompt says: "Subtract... negative %" and "Add... positive %".
      // Usually, discount of 5% means Price * 0.95. 
      // Prompt says: "Negative value (-X%) = Extra Discount... subtract user's additional negative %"
      // Let's stick to strict algebraic interpretation of the prompt's steps:
      
      const percentageDecimal = item.discount / 100;
      
      // If discount is -5, we want to subtract 5% magnitude.
      // If discount is +5, we want to add 5% magnitude.
      // Math: Base + (Base * (percentageDecimal))
      // e.g. -5%: Base + (Base * -0.05) = Base - 0.05*Base. Correct.
      // e.g. +5%: Base + (Base * 0.05). Correct.
      
      finalUnit = baseForDiscount + (baseForDiscount * percentageDecimal);
    } else {
      // "Discount column must remain 0 until user inputs a value. No calculations should run until..."
      // If discount is 0, we just assume standard TP applies without the special "-15%" rule invoked by the discount logic.
      finalUnit = tp;
    }

    // 3. Total Amount
    const totalAmt = finalUnit * item.qty;

    return {
      ...item,
      tp: Number(tp.toFixed(2)),
      totalPerPiece: Number(finalUnit.toFixed(2)),
      totalAmount: Number(totalAmt.toFixed(2))
    };
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const currentItem = { ...newItems[index], [field]: value };
    
    // Recalculate logic if relevant fields change
    if (['rate', 'qty', 'discount'].includes(field)) {
        newItems[index] = calculateRow(currentItem);
    } else {
        newItems[index] = currentItem;
    }
    
    setItems(newItems);
  };

  const addNewRow = () => {
    const newItem: InvoiceItem = {
      id: generateId(),
      name: '',
      qty: 0,
      rate: 0,
      tp: 0,
      discount: 0,
      totalPerPiece: 0,
      totalAmount: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  const deleteRow = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  const duplicateRow = (index: number) => {
    const itemToCopy = items[index];
    const newItem = { ...itemToCopy, id: generateId() };
    const newItems = [...items];
    newItems.splice(index + 1, 0, newItem);
    setItems(newItems);
  };

  // --- Payment Logic ---
  const addPaymentRow = () => {
    setPayments(prev => [...prev, { id: generateId(), narration: '', amount: 0 }]);
  };

  const updatePayment = (index: number, field: keyof PaymentRow, value: any) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
  };

  const deletePayment = (index: number) => {
    const newPayments = [...payments];
    newPayments.splice(index, 1);
    setPayments(newPayments);
  };

  // --- Totals ---
  const grandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = grandTotal - totalPaid;

  // --- Shortcuts & Navigation ---
  const handleKeyDown = (e: React.KeyboardEvent, index: number, field?: string) => {
    // Ctrl + D: Duplicate
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      duplicateRow(index);
    }

    // Arrows
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && field) {
      // Basic grid navigation
      const cols = ['name', 'qty', 'rate', 'tp', 'discount', 'totalPerPiece', 'totalAmount'];
      const colIndex = cols.indexOf(field);
      
      let nextRow = index;
      let nextCol = colIndex;

      if (e.key === 'ArrowUp') nextRow = Math.max(0, index - 1);
      if (e.key === 'ArrowDown') nextRow = Math.min(items.length - 1, index + 1);
      if (e.key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1);
      if (e.key === 'ArrowRight') nextCol = Math.min(cols.length - 1, colIndex + 1);

      // We skip TP, TotalPerPiece, TotalAmount in manual navigation if strictly inputs are desired, 
      // but users might want to copy from calculated fields. Let's allow focus on all inputs.
      // However, calculated fields should probably be read-only inputs to allow focus but not edit.
      
      const elementId = `cell-${nextRow}-${cols[nextCol]}`;
      const el = document.getElementById(elementId);
      if (el) el.focus();
    }
  };

  // --- Persistence ---
  const handleSave = async () => {
    if (!invoiceName) {
      alert("Please enter an Invoice Name");
      return;
    }
    setIsSaving(true);
    
    const invoiceData: Invoice = {
      id: existingInvoiceId || generateId(),
      name: invoiceName,
      date: invoiceDate,
      items,
      payments,
      status,
      totalAmount: grandTotal,
      remainingBalance: remainingBalance,
      createdAt: Date.now()
    };

    storageService.saveInvoice(user.username, invoiceData);
    
    // Simulate slight delay for UX
    await new Promise(r => setTimeout(r, 400));
    setIsSaving(false);
    alert('Invoice saved successfully!');
  };

  // --- PDF Export ---
  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('Hisaab Kitaab', 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Invoice: ${invoiceName}`, 14, 30);
    doc.text(`Date: ${new Date(invoiceDate).toLocaleDateString()}`, 14, 36);
    doc.text(`Status: ${status}`, 14, 42);

    // Items Table
    const tableHead = [['Item Name', 'Qty', 'Rate', 'T.P', 'Disc %', 'Unit Total', 'Total Amt']];
    const tableBody = items.map(item => [
      item.name,
      item.qty.toString(),
      item.rate.toFixed(2),
      item.tp.toFixed(2),
      item.discount === 0 ? '-' : `${item.discount}%`,
      item.totalPerPiece.toFixed(2),
      item.totalAmount.toFixed(2)
    ]);

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: 50,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }, // Slate 800
      styles: { fontSize: 9 }
    });

    // Totals logic
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(10);
    doc.text(`Total Amount: Rs. ${grandTotal.toLocaleString()}`, 140, finalY);
    finalY += 6;

    // Payments
    if (payments.length > 0) {
      doc.text('Payments:', 14, finalY);
      finalY += 5;
      
      const payHead = [['Narration', 'Amount']];
      const payBody = payments.map(p => [p.narration, `Rs. ${p.amount}`]);
      
      autoTable(doc, {
        head: payHead,
        body: payBody,
        startY: finalY,
        theme: 'plain',
        margin: { left: 14, right: 100 },
      });
      
      finalY = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Balance Due: Rs. ${remainingBalance.toLocaleString()}`, 140, finalY);

    doc.save(`${invoiceName.replace(/\s+/g, '_')}_${invoiceDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 bg-slate-800 border-b border-slate-700 p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button variant="secondary" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 md:flex-none space-y-2 md:space-y-0 md:flex md:gap-4">
              <input 
                type="text" 
                placeholder="Invoice Name"
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-64"
                value={invoiceName}
                onChange={(e) => setInvoiceName(e.target.value)}
              />
              <input 
                type="date" 
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
               <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={InvoiceStatus.PENDING}>Pending</option>
                <option value={InvoiceStatus.PAID}>Paid</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <Button variant="success" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-2 md:p-8 max-w-[100vw] overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Items Table */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-lg flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-700 text-slate-300 text-xs uppercase tracking-wider">
                    <th className="p-3 w-8">#</th>
                    <th className="p-3 min-w-[200px]">Item Name</th>
                    <th className="p-3 w-20">Qty</th>
                    <th className="p-3 w-24">Rate</th>
                    <th className="p-3 w-24">T.P (-14.5%)</th>
                    <th className="p-3 w-24">Disc %</th>
                    <th className="p-3 w-28">Unit Total</th>
                    <th className="p-3 w-32 text-right">Row Total</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-750 group">
                      <td className="p-3 text-slate-500 text-sm text-center">{index + 1}</td>
                      <td className="p-2">
                        <input
                          id={`cell-${index}-name`}
                          type="text"
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none text-white text-sm"
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                          placeholder="Item Name"
                        />
                      </td>
                      <td className="p-2">
                         <input
                          id={`cell-${index}-qty`}
                          type="number"
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none text-white text-sm text-center"
                          value={item.qty === 0 ? '' : item.qty}
                          onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                          onKeyDown={(e) => handleKeyDown(e, index, 'qty')}
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2">
                         <input
                          id={`cell-${index}-rate`}
                          type="number"
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none text-white text-sm text-center"
                          value={item.rate === 0 ? '' : item.rate}
                          onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                          onKeyDown={(e) => handleKeyDown(e, index, 'rate')}
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2">
                         <input
                          id={`cell-${index}-tp`}
                          type="number"
                          readOnly
                          className="w-full bg-slate-800 border border-transparent rounded px-2 py-1.5 text-slate-400 text-sm text-center cursor-default focus:outline-none"
                          value={item.tp}
                          tabIndex={-1}
                        />
                      </td>
                      <td className="p-2">
                         <input
                          id={`cell-${index}-discount`}
                          type="number"
                          className={`w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none text-sm text-center ${item.discount < 0 ? 'text-green-400' : item.discount > 0 ? 'text-red-400' : 'text-white'}`}
                          value={item.discount === 0 ? '' : item.discount}
                          onChange={(e) => updateItem(index, 'discount', Number(e.target.value))}
                          onKeyDown={(e) => handleKeyDown(e, index, 'discount')}
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          id={`cell-${index}-totalPerPiece`}
                          type="number"
                          readOnly
                          className="w-full bg-slate-800 border border-transparent rounded px-2 py-1.5 text-slate-300 text-sm text-center font-medium focus:outline-none"
                          value={item.totalPerPiece}
                          tabIndex={-1}
                        />
                      </td>
                      <td className="p-2 text-right font-mono text-blue-300">
                        {item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                       <td className="p-2 text-center">
                        <button 
                          onClick={() => deleteRow(index)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          tabIndex={-1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/50">
               <Button variant="secondary" size="sm" onClick={addNewRow} className="w-full md:w-auto">
                <Plus className="w-4 h-4 mr-2" /> Add Item Row
              </Button>
            </div>
          </div>

          {/* Totals & Payments Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Payments */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-500" /> Payments
                </h3>
              </div>
              
              <div className="space-y-3 mb-4">
                {payments.map((payment, idx) => (
                  <div key={payment.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Narration"
                      className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      value={payment.narration}
                      onChange={(e) => updatePayment(idx, 'narration', e.target.value)}
                    />
                     <input
                      type="number"
                      placeholder="Amount"
                      className="w-32 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 text-right"
                      value={payment.amount === 0 ? '' : payment.amount}
                      onChange={(e) => updatePayment(idx, 'amount', Number(e.target.value))}
                    />
                    <button onClick={() => deletePayment(idx)} className="text-slate-500 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <Button variant="outline" size="sm" onClick={addPaymentRow} className="w-full border-dashed">
                <Plus className="w-4 h-4 mr-2" /> Add Payment
              </Button>
            </div>

            {/* Summary */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-lg flex flex-col justify-center space-y-4">
               <div className="flex justify-between items-center text-slate-400 text-lg">
                 <span>Sub Total:</span>
                 <span>Rs. {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
               
               <div className="flex justify-between items-center text-green-400 text-lg">
                 <span>Total Paid:</span>
                 <span>- Rs. {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
               
               <div className="h-px bg-slate-600 my-2"></div>
               
               <div className="flex justify-between items-center text-2xl font-bold text-white">
                 <span>Balance Due:</span>
                 <span className={remainingBalance > 0 ? 'text-blue-400' : 'text-green-400'}>
                   Rs. {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                 </span>
               </div>
            </div>
          </div>
          
          <div className="text-center text-slate-500 text-sm mt-12 pb-8">
            All Rights Reserved 2025 — Yasir
          </div>
        </div>
      </div>
    </div>
  );
};