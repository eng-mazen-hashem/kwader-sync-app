import React, { createContext, useContext, useEffect, useState } from 'react';

const PrivacyContext = createContext();

export function PrivacyProvider({ children }) {
  const [isPrivacyActive, setIsPrivacyActive] = useState(() => {
    const saved = localStorage.getItem('app-privacy');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('app-privacy', isPrivacyActive ? 'true' : 'false');
    if (isPrivacyActive) {
      document.documentElement.setAttribute('data-privacy', 'active');
    } else {
      document.documentElement.removeAttribute('data-privacy');
    }
  }, [isPrivacyActive]);

  const togglePrivacy = () => setIsPrivacyActive(prev => !prev);

  return (
    <PrivacyContext.Provider value={{ isPrivacyActive, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};
