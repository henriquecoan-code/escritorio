// Preencha com as credenciais do seu projeto Firebase.
// Nao compartilhe este arquivo publicamente.
// Exemplo:
// window.OB_FIREBASE_CONFIG = {
//   apiKey: "SUA_API_KEY",
//   authDomain: "seu-projeto.firebaseapp.com",
//   projectId: "seu-projeto",
//   storageBucket: "seu-projeto.firebasestorage.app",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef123456"
// };

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBGv2dTJYkJPWH0_tJEl1PKXGHrOhwuvZ8",
  authDomain: "escritorio-7b94e.firebaseapp.com",
  projectId: "escritorio-7b94e",
  storageBucket: "escritorio-7b94e.firebasestorage.app",
  messagingSenderId: "829292607963",
  appId: "1:829292607963:web:7834830744e9e67e7f8ffe",
  measurementId: "G-R3W4EC8KE4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);