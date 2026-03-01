import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../config/firebase';
import { Bot, Mail, Lock, Chrome, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Bem-vindo!");
    } catch (error) {
      toast.error("Erro ao entrar com Google.");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Conta criada!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Login realizado!");
      }
    } catch (error) {
      toast.error("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg shadow-blue-900/20">
            <Bot size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Analista Tático OSM</h1>
          <p className="text-slate-400 text-sm mt-1">Acesse sua prancheta de elite</p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-slate-500" size={20} />
            <input 
              type="email" placeholder="E-mail" required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-blue-500 transition-all"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-slate-500" size={20} />
            <input 
              type="password" placeholder="Senha" required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-blue-500 transition-all"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase absolute">Ou continue com</span>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Chrome size={20} /> Google
          </button>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-blue-500 font-bold ml-1 hover:underline"
          >
            {isRegistering ? 'Fazer Login' : 'Cadastre-se'}
          </button>
        </p>
      </div>
    </div>
  );
}