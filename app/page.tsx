"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      if (authMode === "signup") {
        const { data: existingNickname } = await supabase
          .from("messages")
          .select("sender_nickname")
          .eq("sender_nickname", nickname)
          .limit(1);

        if (existingNickname && existingNickname.length > 0) {
          alert("이미 사용 중인 닉네임입니다!");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: nickname } }
        });

        if (error) throw error;
        alert("가입 성공! 이제 로그인해 주세요.");
        setAuthMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign("/chat");
      }
    } catch (err: any) {
      alert(err.message === "User already registered" ? "이미 가입된 이메일입니다." : err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1f22] text-[#dbdee1]">
      <div className="bg-[#2b2d31] p-10 rounded-2xl shadow-2xl w-[420px] flex flex-col items-center">
        <div className="w-14 h-14 bg-[#5865f2] rounded-2xl flex items-center justify-center text-white font-black text-xl mb-6 shadow-lg">RC</div>
        <h1 className="text-2xl font-bold text-white mb-1">Realtime Chat</h1>
        <p className="text-[#b5bac1] text-sm mb-8">로그인하거나 익명으로 입장하세요.</p>

        <div className="flex w-full bg-[#1e1f22] p-1 rounded-lg mb-6">
          <button onClick={() => setAuthMode("login")} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${authMode === "login" ? "bg-[#383a40] text-white shadow" : "text-[#949ba4]"}`}>로그인</button>
          <button onClick={() => setAuthMode("signup")} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${authMode === "signup" ? "bg-[#383a40] text-white shadow" : "text-[#949ba4]"}`}>회원가입</button>
        </div>

        <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
          {authMode === "signup" && (
            <input type="text" placeholder="닉네임" className="w-full p-3 rounded-lg bg-[#1e1f22] border-none outline-none focus:ring-2 focus:ring-[#5865f2] text-white" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
          )}
          <input type="email" placeholder="이메일" className="w-full p-3 rounded-lg bg-[#1e1f22] border-none outline-none focus:ring-2 focus:ring-[#5865f2] text-white" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호" className="w-full p-3 rounded-lg bg-[#1e1f22] border-none outline-none focus:ring-2 focus:ring-[#5865f2] text-white" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button disabled={loading} className="w-full py-3 mt-2 bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50">
            {loading ? "처리 중..." : authMode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
}