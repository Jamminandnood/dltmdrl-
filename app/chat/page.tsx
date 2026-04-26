'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]); 
  const [selectedUser, setSelectedUser] = useState<any>(null); // 관리 대상 유저
  const [showMySettings, setShowMySettings] = useState(false); // 내 설정 팝업
  const [editName, setEditName] = useState('');
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser({ ...user, ...profile });
      
      const { data: allUsers } = await supabase.from('profiles').select('*');
      setUsers(allUsers || []);

      // 메시지 불러오기 (테이블명이 messages이고 profiles와 연결되어 있다고 가정)
      const { data: msgData } = await supabase.from('messages').select('*, profiles(nickname)').order('created_at', { ascending: true });
      setMessages(msgData || []);
    };
    init();
  }, []);

  // --- 핵심 함수 시작 ---

  // 1. 이름 변경 함수 (나 혹은 관리자가 타인 변경)
  const handleUpdateName = async (targetId: string) => {
    if (!editName.trim()) return alert("변경할 이름을 입력하세요.");
    const { error } = await supabase.from('profiles').update({ nickname: editName }).eq('id', targetId);
    if (error) {
      alert("이름 변경 실패");
    } else {
      alert("이름이 변경되었습니다.");
      setEditName('');
      window.location.reload(); 
    }
  };

  // 2. 관리자 액션 함수 (금지, 정지) - 이 이름이 틀리면 에러 납니다!
  const adminAction = async (type: 'ban' | 'mute', targetId: string) => {
    if (!currentUser?.is_admin) return alert("권한이 없습니다.");

    let updateData = {};
    if (type === 'ban') {
      updateData = { is_banned: true };
    } else if (type === 'mute') {
      const muteUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      updateData = { mute_until: muteUntil };
    }

    const { error } = await supabase.from('profiles').update(updateData).eq('id', targetId);
    if (error) alert("처리 실패");
    else {
      alert("처리가 완료되었습니다.");
      setSelectedUser(null);
      window.location.reload();
    }
  };

  // --- UI 시작 ---

  return (
    <div className="flex h-screen bg-[#1a1c20] text-white overflow-hidden font-sans">
      {/* 사이드바 */}
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20">
        <div className="p-4 font-bold text-xl border-b border-black/10">Realtime Chat</div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 온라인 사용자 목록 */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">온라인 사용자</h3>
            {users.filter(u => !u.is_banned).map(u => (
              <div 
                key={u.id} 
                onClick={() => currentUser?.is_admin && setSelectedUser(u)} 
                className="py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer flex justify-between items-center text-sm group"
              >
                <span className="group-hover:text-[#5865f2] transition">{u.nickname || u.email.split('@')[0]}</span>
                {u.is_admin && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">ADMIN</span>}
              </div>
            ))}
          </div>

          {/* 오프라인/정지 사용자 */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">정지/오프라인</h3>
            {users.filter(u => u.is_banned).map(u => (
              <div key={u.id} className="py-1.5 px-2 text-gray-600 text-sm italic">{u.nickname || u.email.split('@')[0]} (Banned)</div>
            ))}
          </div>
        </div>

        {/* 왼쪽 하단 프로필 (클릭 시 내 닉네임 변경) */}
        <div onClick={() => setShowMySettings(true)} className="p-3 bg-[#18191c] flex items-center gap-3 cursor-pointer hover:bg-[#2b2d31] transition">
          <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center text-xs font-bold">RC</div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-bold truncate">{currentUser?.nickname || "내 이름"}</div>
            <div className="text-[10px] text-green-400 font-bold uppercase">Online</div>
          </div>
        </div>
      </div>

      {/* 중앙 메시지창 */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#1a1c20]">
          {messages.map((m: any) => (
            <div key={m.id} className="flex flex-col animate-fadeIn">
              <span className="text-xs font-bold text-[#5865f2] mb-1">{m.profiles?.nickname || "익명"}</span>
              <div className="bg-[#2e3037] p-3 rounded-r-xl rounded-bl-xl inline-block max-w-[80%] text-sm">
                {m.content}
              </div>
            </div>
          ))}
        </div>
        {/* 입력바 */}
        <div className="p-4 bg-[#1a1c20]">
          <input className="w-full bg-[#2e3037] p-4 rounded-xl outline-none text-sm placeholder-gray-500 focus:ring-1 focus:ring-[#5865f2]" placeholder="메시지를 입력하고 Enter를 누르세요..." />
        </div>
      </div>

      {/* 내 정보 수정 모달 */}
      {showMySettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 shadow-2xl border border-gray-800">
            <h3 className="font-bold text-xl mb-4">내 정보 수정</h3>
            <input className="w-full bg-[#1a1c20] p-3 rounded-lg mb-4 text-sm outline-none border border-gray-700 focus:border-[#5865f2]" placeholder="바꿀 닉네임 입력" onChange={e => setEditName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => handleUpdateName(currentUser.id)} className="flex-1 bg-[#5865f2] py-2.5 rounded-lg font-bold text-sm">변경하기</button>
              <button onClick={() => setShowMySettings(false)} className="flex-1 bg-gray-700 py-2.5 rounded-lg text-sm">취소</button>
            </div>
            <button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="w-full mt-6 text-xs text-red-500 hover:underline">로그아웃</button>
          </div>
        </div>
      )}

      {/* 관리자 메뉴 모달 (사용자 클릭 시) */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 shadow-2xl border border-gray-800">
            <h3 className="font-bold text-xl mb-2">{selectedUser.nickname}</h3>
            <p className="text-xs text-gray-500 mb-6 font-bold uppercase tracking-widest">Administrator Menu</p>
            <div className="space-y-3">
              <div className="mb-4">
                <input className="w-full bg-[#1a1c20] p-3 rounded-lg text-sm mb-2 outline-none border border-gray-700 focus:border-blue-500" placeholder="이름 강제 변경" onChange={e => setEditName(e.target.value)} />
                <button onClick={() => handleUpdateName(selectedUser.id)} className="w-full bg-blue-600 py-2.5 rounded-lg text-sm font-bold">이름 업데이트</button>
              </div>
              <hr className="border-gray-800 my-4" />
              <button onClick={() => adminAction('mute', selectedUser.id)} className="w-full bg-yellow-500 text-black py-2.5 rounded-lg text-sm font-bold">10분 채팅 금지</button>
              <button onClick={() => adminAction('ban', selectedUser.id)} className="w-full bg-red-600 py-2.5 rounded-lg text-sm font-bold">계정 영구 정지</button>
              <button onClick={() => setSelectedUser(null)} className="w-full mt-4 text-xs text-gray-500 hover:text-white">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}