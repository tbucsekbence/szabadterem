import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';

// A webes Firebase konfiguráció nem titkos — a hozzáférést a Firestore szabályok
// (firestore.rules) és a Cloud Functions ellenőrzései védik.
const firebaseConfig = {
  apiKey: 'AIzaSyAAAIO_UdTC5Gb3ueWOZgUlW1MyO3PWs3g',
  authDomain: 'szabadterem.firebaseapp.com',
  projectId: 'szabadterem',
  storageBucket: 'szabadterem.firebasestorage.app',
  messagingSenderId: '633986715063',
  appId: '1:633986715063:web:905ee64b7121f1f647ac32',
  measurementId: 'G-FZ1C85BSML',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'hu';
export const db = getFirestore(app);
export const functions = getFunctions(app, 'europe-central2');

isSupported()
  .then((ok) => ok && getAnalytics(app))
  .catch(() => {});
