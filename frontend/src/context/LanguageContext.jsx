import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('ethio_tech_lang') || 'en';
  });

  const setLanguage = (lang) => {
    if (lang === 'en' || lang === 'am') {
      setLanguageState(lang);
      localStorage.setItem('ethio_tech_lang', lang);
      document.documentElement.lang = lang;
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key, fallback = '') => {
    const langDict = translations[language] || translations.en;
    if (langDict && key in langDict) {
      return langDict[key];
    }
    const defaultDict = translations.en;
    return defaultDict[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
