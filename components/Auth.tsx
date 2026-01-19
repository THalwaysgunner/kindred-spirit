import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock, User, ArrowRight, Loader2, X } from 'lucide-react';

interface AuthProps {
    onAuthSuccess: () => void;
    onClose: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [success, setSuccess] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                });
                if (error) throw error;
                setSuccess(true);
            }
            if (isLogin) onAuthSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/5 backdrop-blur-[4px] animate-in fade-in duration-500">
            <div
                className="w-full max-w-md bg-white/40 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.08)] border border-white/60 p-10 relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Subtle Glow Overlay */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>

                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 p-2 hover:bg-white/50 rounded-full transition-all hover:scale-110 active:scale-95"
                >
                    <X className="w-5 h-5 text-black" />
                </button>

                {success ? (
                    <div className="text-center py-10 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-green-100">
                            <Mail className="w-10 h-10 text-green-500" />
                        </div>
                        <h1 className="text-3xl font-black text-black mb-4 tracking-tight">Check your email</h1>
                        <p className="text-black font-bold mb-8">
                            We've sent a confirmation link to <span className="text-brand-600">{email}</span>.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-black text-white rounded-2xl font-bold transition-all shadow-xl shadow-black/10 hover:shadow-black/20 active:scale-[0.98]"
                        >
                            Got it
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-10 pt-4">
                            <div className="w-12 h-12 bg-white/60 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white/80">
                                <User className="w-6 h-6 text-brand-600" />
                            </div>
                            <h1 className="text-3xl font-black text-black mb-2 tracking-tight">
                                {isLogin ? 'Welcome Back' : 'Create Account'}
                            </h1>
                            <p className="text-black font-bold text-sm">
                                {isLogin ? 'Sign in to access your dashboard' : 'Join HireChance and get hired'}
                            </p>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            {!isLogin && (
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black group-focus-within:text-brand-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-white/40 border border-white/60 rounded-2xl focus:ring-4 focus:ring-white/40 focus:border-white outline-none transition-all text-black font-bold placeholder:text-black/60 shadow-sm"
                                    />
                                </div>
                            )}

                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black group-focus-within:text-brand-500 transition-colors" />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/40 border border-white/60 rounded-2xl focus:ring-4 focus:ring-white/40 focus:border-white outline-none transition-all text-black font-bold placeholder:text-black/60 shadow-sm"
                                />
                            </div>

                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black group-focus-within:text-brand-500 transition-colors" />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/40 border border-white/60 rounded-2xl focus:ring-4 focus:ring-white/40 focus:border-white outline-none transition-all text-black font-bold placeholder:text-black/60 shadow-sm"
                                />
                            </div>

                            {error && (
                                <p className="text-xs font-black text-red-600 bg-red-50/90 p-4 rounded-2xl border border-red-200 shadow-sm animate-in slide-in-from-top-2">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-black text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group disabled:opacity-50 mt-8 shadow-xl shadow-black/10 hover:shadow-black/20 active:scale-[0.98]"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? 'Sign In' : 'Create Account'}
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-10 text-center">
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-black hover:opacity-70 font-black text-xs uppercase tracking-[0.2em] transition-all py-2"
                            >
                                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                            </button>
                        </div>

                        {isLogin && (
                            <div className="mt-8 p-5 bg-white/40 rounded-3xl border border-white/60 shadow-inner">
                                <p className="text-[10px] text-brand-600 font-black uppercase tracking-[0.15em] text-center">
                                    Create a user first using the "Sign up" toggle above.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
