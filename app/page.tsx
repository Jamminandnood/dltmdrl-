'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // 경로가 다르면 수정하세요
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 1. 회원가입 함수 (중복 체크 로직 포함)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');
    
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      // 이메일 중복 시 발생하는 에러 메시지 처리
      if (error.message.includes("already registered") || error.status === 422) {
        alert("이미 가입된 이메일입니다. 로그인을 해주세요!");
      } else {
        alert("가입 중 에러 발생: " + error.message);
      }
    } else if (data.user) {
      // Supabase 설정에 따라 바로 가입되거나 인증 메일이 발송됨
      alert("회원가입 신청이 완료되었습니다!");
    }

    setLoading(false);
  };

  // 2. 로그인 함수
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("로그인 실패: " + error.message);
    } else if (data.user) {
      router.push('/chat'); // 채팅방으로 이동
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-lg">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">채팅 앱 로그인</h1>
        
        <form className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400">이메일</label>
            <input
              type="email"
              className="mt-1 w-full rounded border border-gray-700 bg-gray-700 p-2 text-white outline-none focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@test.com"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400">비밀번호</label>
            <input
              type="password"
              className="mt-1 w-full rounded border border-gray-700 bg-gray-700 p-2 text-white outline-none focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="flex-1 rounded bg-blue-600 py-2 font-bold text-white transition hover:bg-blue-700 disabled:bg-gray-600"
            >
              {loading ? '처리 중...' : '로그인'}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 rounded bg-green-600 py-2 font-bold text-white transition hover:bg-green-700 disabled:bg-gray-600"
            >
              회원가입
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}