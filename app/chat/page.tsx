'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showMySettings, setShowMySettings] = useState(false);
  const [editName, setEditName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 초기 데이터 로딩 및 실시간 구독
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser({ ...user, ...profile });

      await supabase.from('profiles').update({ is_online: true }).eq('id', user.id);
      fetchInitialData();

      const channel = supabase.channel('chat_v5')
        .on('postgres_changes' as any, { event: '*', table: 'messages', schema: 'public' }, () => fetchMessages())
        .on('postgres_changes' as any, { event: '*', table: 'profiles', schema: 'public' }, () => fetchUsers())
        .subscribe();

      const setOffline = () => supabase.from('profiles').update({ is_online: false }).eq('id', user.id).then();
      window.addEventListener('beforeunload', setOffline);

      return () => {
        setOffline();
        window.removeEventListener('beforeunload', setOffline);
        supabase.removeChannel(channel);
      };
    };
    init();
  }, []);

  const fetchInitialData = () => { fetchMessages(); fetchUsers(); };
  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*, profiles(nickname, id)').order('created_at', { ascending: true });
    if (data) setMessages(data);
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
  };
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data);
  };

  // --- [중요] 정지 및 해제 관리자 액션 ---
  const adminAction = async (type: 'ban' | 'mute' | 'unmute' | 'unban', targetId: string) => {
    let updateData: any = {};
    
    // 10분 정지: 현재시간 + 10분
    if (type === 'mute') {
      updateData = { mute_until: new Date(Date.now() + 600000).toISOString() };
    } 
    // 정지 해제: 아주 먼 과거 시간으로 설정 (가장 확실한 방법)
    else if (type === 'unmute') {
      updateData = { mute_until: new Date(0).toISOString() }; 
    } 
    else if (type === 'ban') {
      updateData = { is_banned: true };
    } 
    else if (type === 'unban') {
      updateData = { is_banned: false };
    }

    console.log("업데이트 시도 데이터:", updateData);

    const { error } = await supabase.from('profiles').update(updateData).eq('id', targetId);

    if (error) {
      alert("관리자 작업 실패: " + error.message);
      console.error(error);
    } else {
      alert(`${type} 처리가 완료되었습니다.`);
      setSelectedUser(null); // 모달 닫기
      fetchUsers(); // 유저 목록 새로고침
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    if (currentUser?.mute_until && new Date(currentUser.mute_until) > new Date()) {
      alert("채팅 금지 상태입니다.");
      return;
    }

    const { error } = await supabase.from('messages').insert([{ content: inputText, user_id: currentUser.id }]);
    if (!error) setInputText('');
  };

  return (
    <div className="flex h-screen bg-[#1a1c20] text-white overflow-hidden">
      {/* 사이드바 */}
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20">
        <div className="p-4 font-bold text-xl border-b border-black/10">Admin Chat</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-green-500 mb-2 uppercase">● 온라인</h3>
            {users.filter(u => u.is_online && !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1 px-2 hover:bg-white/5 rounded cursor-pointer text-sm flex justify-between">
                <span>{u.nickname || u.email.split('@')[0]}</span>
                {u.is_admin && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">ADM</span>}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-red-500 mb-2 uppercase">禁 정지됨</h3>
            {users.filter(u => u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1 px-2 text-red-900/50 text-sm cursor-pointer line-through">
                {u.nickname || u.email.split('@')[0]}
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => setShowMySettings(true)} className="p-3 bg-[#18191c] cursor-pointer hover:bg-[#2b2d31]">
          <p className="text-sm font-bold truncate">{currentUser?.nickname || "나"}</p>
          <p className="text-[10px] text-gray-500">설정</p>
        </div>
      </div>

      {/* 채팅창 */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m: any) => (
            <div key={m.id} className="flex flex-col">
              <span className="text-sm font-bold text-[#5865f2] mb-1">{m.profiles?.nickname || "익명"}</span>
              <div className="bg-[#2e3037] p-3 rounded-lg text-sm max-w-[70%]">{m.content}</div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSendMessage} className="p-4 bg-[#36393f]">
          <input className="w-full bg-[#40444b] p-3 rounded-xl outline-none" placeholder="메시지..." value={inputText} onChange={e => setInputText(e.target.value)} />
        </form>
      </div>

      {/* [수정] 관리자 모달: 버튼이 확실히 보이도록 배치 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 border border-gray-700 shadow-2xl">
            <h3 className="font-bold text-xl mb-6 text-center">{selectedUser.nickname} 관리</h3>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => adminAction('mute', selectedUser.id)} 
                  className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold hover:bg-yellow-400 active:scale-95 transition"
                >
                  10분 정지
                </button>
                <button 
                  onClick={() => adminAction('unmute', selectedUser.id)} 
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-500 active:scale-95 transition"
                >
                  정지 해제
                </button>
              </div>
              <button 
                onClick={() => adminAction(selectedUser.is_banned ? 'unban' : 'ban', selectedUser.id)} 
                className={`w-full py-3 rounded-xl font-bold transition ${selectedUser.is_banned ? 'bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}
              >
                {selectedUser.is_banned ? '서버 차단 해제' : '영구 서버 차단'}
              </button>
              <button onClick={() => setSelectedUser(null)} className="mt-4 text-gray-500 hover:text-white">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}