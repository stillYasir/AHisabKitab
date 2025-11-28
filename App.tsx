import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { InvoiceEditor } from './components/InvoiceEditor';
import { storageService } from './services/storageService';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session
    const currentUser = storageService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
    setCurrentView('dashboard');
    setSelectedInvoiceId(null);
  };

  const handleInvoiceSelect = (id: string | null) => {
    setSelectedInvoiceId(id);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setSelectedInvoiceId(null);
    setCurrentView('dashboard');
  };

  // Render Logic
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentView === 'editor') {
    return (
      <InvoiceEditor 
        user={user} 
        existingInvoiceId={selectedInvoiceId} 
        onBack={handleBackToDashboard} 
      />
    );
  }

  return (
    <Dashboard 
      user={user} 
      onLogout={handleLogout} 
      onSelectInvoice={handleInvoiceSelect} 
    />
  );
}

export default App;