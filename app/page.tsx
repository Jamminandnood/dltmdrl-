'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 로그인 함수
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert("로그인 실패: " + error.message);
    } else {
      router.push('/chat');
    }
    setLoading(false);
  };

  // 회원가입 함수 (중복 방지 로직 포함)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("already registered") || error.status === 422) {
        alert("이미 가입된 이메일입니다. 로그인을 해주세요!");
      } else {
        alert("가입 중 에러: " + error.message);
      }
    } else {
      alert("회원가입 성공! 이제 로그인을 해보세요.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1c20] p-4 font-sans">
      <div className="w-full max-w-md rounded-2xl bg-[#202227] p-10 shadow-2xl border border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#5865f2] rounded-2xl flex items-center justify-center font-bold text-3xl text-white mb-4 shadow-lg">RC</div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Realtime Chat</h1>
          <p className="text-gray-400 mt-2 text-sm">다시 오신 것을 환영합니다!</p>
        </div>
        
        <form className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">이메일</label>
            <input
              type="email"
              className="w-full rounded-lg bg-[#1a1c20] border border-transparent p-3 text-white outline-none focus:border-[#5865f2] transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">비밀번호</label>
            <input
              type="password"
              className="w-full rounded-lg bg-[#1a1c20] border border-transparent p-3 text-white outline-none focus:border-[#5865f2] transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="flex-1 rounded-lg bg-[#5865f2] py-3 font-bold text-white transition hover:bg-[#4752c4] active:scale-95 disabled:bg-gray-600"
            >
              {loading ? '연결 중...' : '로그인'}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 rounded-lg bg-[#36373d] py-3 font-bold text-white transition hover:bg-[#404249] active:scale-95 disabled:bg-gray-600"
            >
              회원가입
            </button>
          </div>
        </form>
        
        <p className="mt-8 text-center text-[10px] text-gray-500 uppercase tracking-widest">
          Secure Authentication by Supabase
        </p>
      </div>
    </div>
  );
}