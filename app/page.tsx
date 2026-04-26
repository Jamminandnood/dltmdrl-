'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else router.push('/chat');
  };

  const handleSignUp = async (e: any) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.includes("already registered")) alert("이미 가입된 이메일입니다.");
      else alert(error.message);
    } else alert("가입 완료!");
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>로그인</h1>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
        <input type="email" placeholder="이메일" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="비밀번호" onChange={e => setPassword(e.target.value)} />
        <button onClick={handleLogin}>로그인</button>
        <button onClick={handleSignUp}>회원가입</button>
      </form>
    </div>
  );
}