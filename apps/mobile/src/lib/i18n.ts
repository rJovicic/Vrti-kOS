import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fallbackLng, resources } from '@vrticos/i18n';

void i18n.use(initReactI18next).init({
  resources,
  lng: 'hr',
  fallbackLng,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
