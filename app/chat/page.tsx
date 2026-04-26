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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser({ ...user, ...profile });

      // 온라인 접속 알림
      await supabase.from('profiles').update({ is_online: true }).eq('id', user.id);
      
      fetchInitialData();

      const channel = supabase.channel('chat_v3')
        .on('postgres_changes' as any, { event: '*', table: 'messages', schema: 'public' }, () => fetchMessages())
        .on('postgres_changes' as any, { event: '*', table: 'profiles', schema: 'public' }, () => fetchUsers())
        .subscribe();

      const setOffline = () => {
        supabase.from('profiles').update({ is_online: false }).eq('id', user.id).then();
      };

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
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data);
  };

  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content && !imageUrl) return;

    // 정지 상태 체크
    if (currentUser?.mute_until && new Date(currentUser.mute_until) > new Date()) {
      alert(`채팅 금지 상태입니다. (${new Date(currentUser.mute_until).toLocaleTimeString()}까지)`);
      return;
    }

    const { error } = await supabase.from('messages').insert([
      { content, user_id: currentUser.id, image_url: imageUrl || null }
    ]);

    if (error) {
      alert("전송 실패: " + error.message);
    } else {
      setInputText('');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      handleSendMessage(undefined, publicUrl);
    }
  };

  const adminAction = async (type: 'ban' | 'mute' | 'unmute' | 'unban', targetId: string) => {
    let updateData: any = {};
    if (type === 'ban') updateData = { is_banned: true };
    else if (type === 'unban') updateData = { is_banned: false };
    else if (type === 'mute') updateData = { mute_until: new Date(Date.now() + 600000).toISOString() };
    else if (type === 'unmute') updateData = { mute_until: new Date(0).toISOString() };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', targetId);
    if (!error) {
      alert("처리 완료");
      setSelectedUser(null);
      fetchUsers();
    }
  };

  return (
    <div className="flex h-screen bg-[#1a1c20] text-white overflow-hidden">
      {/* 왼쪽 사이드바 (온오프라인 리스트) */}
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20">
        <div className="p-4 font-bold text-xl border-b border-black/10">Realtime Chat</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-green-500 mb-2 uppercase">● 온라인</h3>
            {users.filter(u => u.is_online && !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1 px-2 hover:bg-white/5 rounded cursor-pointer text-sm flex justify-between items-center">
                <span>{u.nickname || u.email.split('@')[0]}</span>
                {u.is_admin && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">ADMIN</span>}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase">○ 오프라인</h3>
            {users.filter(u => !u.is_online && !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1 px-2 text-gray-400 text-sm cursor-pointer hover:bg-white/5 rounded">
                {u.nickname || u.email.split('@')[0]}
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
        <div onClick={() => setShowMySettings(true)} className="p-3 bg-[#18191c] flex items-center gap-3 cursor-pointer hover:bg-[#2b2d31]">
          <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center font-bold text-xs">RC</div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUser?.nickname || "사용자"}</p>
            <p className="text-[10px] text-gray-400 underline">설정</p>
          </div>
        </div>
      </div>

      {/* 중앙 채팅 영역 */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m: any) => (
            <div key={m.id} className="group flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-[#5865f2]">{m.profiles?.nickname || "익명"}</span>
                <span className="text-[10px] text-gray-500">{new Date(m.created_at).toLocaleTimeString()}</span>
                {(currentUser?.id === m.user_id || currentUser?.is_admin) && (
                  <button onClick={() => supabase.from('messages').delete().eq('id', m.id)} className="hidden group-hover:block text-[10px] text-red-400 ml-2">삭제</button>
                )}
              </div>
              {m.content && <div className="bg-[#2e3037] p-3 rounded-r-xl rounded-bl-xl inline-block max-w-[70%] text-sm">{m.content}</div>}
              {m.image_url && <img src={m.image_url} className="mt-2 rounded-lg max-w-sm border border-black/20" />}
            </div>
          ))}
        </div>

        {/* 입력창 (플러스 버튼 포함) */}
        <form onSubmit={handleSendMessage} className="p-4 bg-[#36393f] flex items-center gap-3">
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            <div className="w-9 h-9 bg-[#40444b] rounded-full flex items-center justify-center text-xl text-gray-400 hover:text-white transition">＋</div>
          </label>
          <input 
            className="flex-1 bg-[#40444b] p-3 rounded-xl outline-none text-sm" 
            placeholder="메시지를 입력하세요..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </form>
      </div>

      {/* 관리자 전용 모달 (정지/해제 기능 복구) */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 border border-gray-800 shadow-2xl">
            <h3 className="font-bold text-xl mb-6">{selectedUser.nickname || "사용자"} 관리</h3>
            <div className="space-y-3">
              <input className="w-full bg-[#1a1c20] p-3 rounded-lg text-sm outline-none" placeholder="이름 변경" onChange={e => setEditName(e.target.value)} />
              <button onClick={() => {
                supabase.from('profiles').update({ nickname: editName }).eq('id', selectedUser.id).then(() => { alert("변경됨"); setSelectedUser(null); fetchUsers(); });
              }} className="w-full bg-blue-600 py-2.5 rounded-lg text-sm font-bold">이름 업데이트</button>
              <div className="flex gap-2">
                <button onClick={() => adminAction('mute', selectedUser.id)} className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-bold text-xs">10분 금지</button>
                <button onClick={() => adminAction('unmute', selectedUser.id)} className="flex-1 bg-green-600 py-2 rounded-lg font-bold text-xs">해제</button>
              </div>
              <button onClick={() => adminAction(selectedUser.is_banned ? 'unban' : 'ban', selectedUser.id)} className={`w-full py-2.5 rounded-lg text-sm font-bold ${selectedUser.is_banned ? 'bg-gray-500' : 'bg-red-600'}`}>
                {selectedUser.is_banned ? '차단 해제' : '서버 차단'}
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full mt-2 text-xs text-gray-500">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 내 설정 모달 */}
      {showMySettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#202227] p-8 rounded-2xl w-80">
            <h3 className="font-bold text-xl mb-4">내 닉네임 변경</h3>
            <input className="w-full bg-[#1a1c20] p-3 rounded-lg mb-4 text-sm" placeholder="새 닉네임" onChange={e => setEditName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => {
                supabase.from('profiles').update({ nickname: editName }).eq('id', currentUser.id).then(() => window.location.reload());
              }} className="flex-1 bg-[#5865f2] py-2.5 rounded-lg font-bold">변경</button>
              <button onClick={() => setShowMySettings(false)} className="flex-1 bg-gray-700 py-2.5 rounded-lg">취소</button>
            </div>
            <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="w-full mt-6 text-xs text-red-500">로그아웃</button>
          </div>
        </div>
      )}
    </div>
  );
}