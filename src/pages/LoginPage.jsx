// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from '../config/firebase';
// IMPORTANTE: Adicionamos signInWithRedirect e getRedirectResult
import { signInWithRedirect, getRedirectResult } from 'firebase/auth'; 
import { Bot, Mail, Lock, Chrome, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRedirectLoading, setIsRedirectLoading] = useState(true);

  // ==========================================
  // CAPTURA DO RETORNO DO GOOGLE (MOBILE FIX)
  // ==========================================
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        // Se o usuário acabou de voltar da tela do Google, o Firebase finaliza o login aqui.
        const result = await getRedirectResult(auth);
        if (result) {
          toast.success("Bem-vindo via Google!");
        }
      } catch (error) {
        console.error("Erro no Redirect do Google:", error);
        toast.error("O login com o Google foi cancelado ou falhou.");
      } finally {
        setIsRedirectLoading(false);
      }
    };
    checkRedirect();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      // Usando REDIRECT ao invés de POPUP para garantir compatibilidade com PWA e Celular
      await signInWithRedirect(auth, googleProvider);
      // O código para aqui, pois a página será redirecionada.
    } catch (error) {
      setLoading(false);
      toast.error("Falha ao iniciar o login com o Google.");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Conta criada com sucesso!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Login realizado!");
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        toast.error("E-mail ou senha incorretos.");
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error("Este e-mail já está em uso.");
      } else {
        toast.error("Erro ao autenticar. Verifique seus dados.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Enquanto verifica se está voltando do Google, mostra a tela de carregamento para não piscar
  if (isRedirectLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
         <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
         <p className="text-slate-400 font-medium animate-pulse">Conectando ao Google...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl mb-4 shadow-lg shadow-blue-900/30">
            <Bot size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Analista Tático OSM</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Acesse sua prancheta de elite</p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
            <input 
              type="email" 
              placeholder="E-mail de acesso" 
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
            <input 
              type="password" 
              placeholder="Sua senha secreta" 
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !email || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Criar Nova Conta' : 'Entrar na Prancheta')}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-slate-900 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest absolute">Ou acesse rápido via</span>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-slate-100 hover:bg-white disabled:opacity-50 text-slate-900 font-extrabold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 shadow-md"
          >
            <Chrome size={22} className="text-blue-600" /> Entrar com Google
          </button>
        </div>

        <p className="text-center text-slate-400 text-sm mt-8 font-medium">
          {isRegistering ? 'Já possui uma prancheta?' : 'Ainda não é treinador?'}
          <button 
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              // Limpa os campos ao trocar entre login e registro
              setPassword('');
            }}
            className="text-blue-400 font-bold ml-1.5 hover:text-blue-300 hover:underline transition-colors outline-none"
          >
            {isRegistering ? 'Fazer Login' : 'Cadastre-se grátis'}
          </button>
        </p>
      </div>
    </div>
  );
}